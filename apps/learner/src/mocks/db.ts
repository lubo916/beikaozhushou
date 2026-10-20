// 内存仓库（api-rules 第 4 节）：启动时装入四个演示考试；写操作真的改变内存数据——做完一题，错题本与今日清单跟着变。
// 规则还没实现的部分（掌握档、证据强度、今日清单的排法、错题回炉与验收）先用 fixtures 的示例值或最简单的占位做法，
// 返回里标 data_source: "sample"；规则卡落地后（B 任务）改调 packages/domains/<领域>/core 的纯函数，存储仍在这里。
// 幂等记录也存在这里（真实后端同样随数据一起保存），重置演示数据时一起清掉。
import { ApiError } from "@exam-prep/contract/errors";
import { PARAMS, param, type ParamName } from "@exam-prep/params";
import { addDays, diffDays, today, type DaySettings, type LearningDay } from "@exam-prep/shared/today";
import { VOCAB } from "@exam-prep/shared/vocab";
import type { DemoExam, DemoFixtures, QuestionFixture, TaskFixture } from "./demo.ts";
import { uuidv7 } from "./uuid.ts";

const SAMPLE = "sample";
const SEGMENTS = ["consolidate", "advance", "closing"] as const;
const SOLUTION_KEYS = [
  "answer",
  "explanation",
  "option_notes",
  "common_wrong_option",
  "group_miss_rate",
  "scoring_points",
  "sample_answer",
];
const QUESTION_OPTIONAL_KEYS = ["options", "label", "hints"];
const CONFIDENCES: readonly string[] = ["sure", "vague", "guess", "off"];
const STRENGTH_ORDER: readonly string[] = ["weak", "medium", "strong"];
const CURSOR_RE = /^o(\d+)$/;

type Body = Record<string, unknown>;

/** 一条作答（只追加）。 */
export interface AttemptRecord {
  readonly id: string;
  readonly questionId: string;
  readonly day: LearningDay;
  readonly correct: boolean | null;
}

interface MistakeRecord {
  readonly id: string;
  readonly questionId: string;
  readonly examId: string;
  readonly knowledgePointIds: readonly string[];
  readonly createdAt: string;
  readonly createdDay: LearningDay;
  status: string;
  wrongCount: number;
  correctStreak: number;
  lastAnsweredAt: string;
  nextDueDay: LearningDay;
  lastRetryDay: LearningDay | null;
}

interface ExamState {
  readonly attempts: AttemptRecord[];
  readonly mistakes: Map<string, MistakeRecord>;
}

const isRecord = (value: unknown): value is Body => typeof value === "object" && value !== null && !Array.isArray(value);

function pick(source: Readonly<Record<string, unknown>>, keys: readonly string[]): Body {
  const present = keys.filter((key) => source[key] !== undefined);
  return Object.fromEntries(present.map((key) => [key, source[key]]));
}

function sameAnswer(selected: readonly number[], answer: readonly number[]): boolean {
  const a = [...new Set(selected)].sort();
  const b = [...new Set(answer)].sort();
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** 证据强度的占位做法（示例；正式规则见规则卡 R01）：蒙对记待验证，模糊或关闭把握度最高记中证据，再按题目可信度封顶。 */
function sampleStrength(graded: boolean, correct: boolean | null, confidence: string, credibility: string): string {
  if (!graded) return "pending";
  if (correct !== true) return "negative";
  if (confidence === "guess") return "pending";
  const base = confidence === "sure" ? "strong" : "medium";
  const caps: Readonly<Record<string, string>> = param("learner.evidence.credibility_caps");
  const cap = caps[credibility] ?? base;
  return STRENGTH_ORDER.indexOf(cap) < STRENGTH_ORDER.indexOf(base) ? cap : base;
}

/** 这道错题今天要不要回炉：到期了，或者今天已经按期做过（做过也留在清单里，显示已完成）。 */
function isDue(mistake: MistakeRecord, day: LearningDay): boolean {
  if (mistake.status === "graduated" || mistake.createdDay === day) return false;
  return mistake.nextDueDay <= day || mistake.lastRetryDay === day;
}

function newestFirst(a: MistakeRecord, b: MistakeRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** 游标分页（api-rules 第 1 节）：游标对前端不透明；每页条数不超过参数 api.page.max_limit。 */
function page(items: readonly unknown[], cursor: string | null, limit: string | null): Body {
  const max = param("api.page.max_limit");
  const asked = limit === null ? max : Number(limit);
  if (!Number.isInteger(asked) || asked < 1) throw new ApiError("COMMON_VALIDATION", { field: "limit" });
  const match = cursor === null ? null : CURSOR_RE.exec(cursor);
  if (cursor !== null && match === null) throw new ApiError("COMMON_VALIDATION", { field: "cursor" });
  const start = match === null ? 0 : Number(match[1]);
  const end = start + Math.min(asked, max);
  const next = end < items.length ? `o${end}` : null;
  return { items: items.slice(start, end), next_cursor: next, data_source: SAMPLE };
}

function taskView(task: TaskFixture, answered: ReadonlySet<string>): Body {
  const answeredCount = task.question_ids.filter((id) => answered.has(id)).length;
  const total = task.question_ids.length;
  const status = answeredCount === 0 ? "todo" : answeredCount < total ? "in_progress" : "done";
  return {
    id: task.id,
    segment: task.segment,
    source: task.source,
    title: task.title,
    minutes: task.minutes,
    status,
    question_ids: [...task.question_ids],
    card_ids: [...task.card_ids],
    knowledge_point_ids: [...task.knowledge_point_ids],
    question_count: total,
    answered_count: answeredCount,
  };
}

function mistakeView(m: MistakeRecord): Body {
  return {
    id: m.id,
    question_id: m.questionId,
    exam_id: m.examId,
    knowledge_point_ids: [...m.knowledgePointIds],
    status: m.status,
    tags: [],
    wrong_count: m.wrongCount,
    correct_streak: m.correctStreak,
    created_at: m.createdAt,
    last_answered_at: m.lastAnsweredAt,
    next_due_day: m.nextDueDay,
  };
}

export class MockDb {
  readonly fixtures: DemoFixtures;
  readonly #states = new Map<string, ExamState>();
  readonly #events: unknown[] = [];
  readonly #replies = new Map<string, Promise<unknown>>();

  constructor(fixtures: DemoFixtures) {
    this.fixtures = fixtures;
  }

  /** 清掉作答、错题、埋点与幂等记录，回到刚装入演示数据时的样子。 */
  reset(): void {
    this.#states.clear();
    this.#events.length = 0;
    this.#replies.clear();
  }

  /** 幂等（api-rules 第 1 节）：同一个键只执行一次；正在执行的也算，并发的重复请求拿到同一个结果。 */
  once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = this.#replies.get(key);
    if (existing !== undefined) return existing as Promise<T>;
    const pending = run();
    this.#replies.set(key, pending);
    return pending;
  }

  /** 某个考试的全部作答（只追加；给测试与排查用）。 */
  attempts(examId: string): readonly AttemptRecord[] {
    return [...this.#state(examId).attempts];
  }

  /** 用户时区与日界线：参数 account.day.time_zone、account.day.start_hour（F04 登记；学员自己改过的设置以后由 account 领域给）。 */
  daySettings(): DaySettings {
    return { timeZone: param("account.day.time_zone"), dayStartHour: param("account.day.start_hour") };
  }

  learningDay(now: number): LearningDay {
    return today(now, this.daySettings());
  }

  examByKey(key: string): DemoExam {
    const exam = this.fixtures.exams.find((e) => e.key === key);
    if (exam === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_key: key });
    return exam;
  }

  examById(examId: string): DemoExam {
    const exam = this.fixtures.exams.find((e) => e.examId === examId);
    if (exam === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_id: examId });
    return exam;
  }

  #state(examId: string): ExamState {
    let state = this.#states.get(examId);
    if (state === undefined) {
      state = { attempts: [], mistakes: new Map() };
      this.#states.set(examId, state);
    }
    return state;
  }

  /** 示范接口 /me/context：当前用户、当前目标考试与今天（exam 为 null 表示还没有目标）。 */
  meContext(exam: DemoExam | null, now: number): Body {
    const settings = this.daySettings();
    const day = today(now, settings);
    const { learner } = this.fixtures;
    const body: Body = {
      user: { id: learner.id, display_name: learner.display_name, is_guest: learner.is_guest },
      today: day,
      now: new Date(now).toISOString(),
      time_zone: settings.timeZone,
      day_start_hour: settings.dayStartHour,
    };
    if (exam !== null) {
      const { profile, learner: state, map } = exam;
      body["goal"] = {
        exam_id: exam.examId,
        exam_name: profile.name,
        short_name: profile.short_name ?? profile.name,
        evaluation_rule: profile.evaluation_rule.type,
        target_score: state.goal.target_score,
        target_date: state.goal.target_date,
        days_to_target: diffDays(day, state.goal.target_date),
        map_id: map.map_id,
      };
    }
    return body;
  }

  knowledgePoint(pointId: string): Body {
    for (const exam of this.fixtures.exams) {
      for (const chapter of exam.map.chapters) {
        const point = chapter.sample_points.find((p) => p.id === pointId);
        if (point !== undefined) {
          return { ...point, map_id: exam.map.map_id, exam_id: exam.examId, chapter_id: chapter.id, chapter_name: chapter.name };
        }
      }
    }
    throw new ApiError("COMMON_NOT_FOUND", { point_id: pointId });
  }

  findQuestion(questionId: string): { readonly exam: DemoExam; readonly question: QuestionFixture } {
    for (const exam of this.fixtures.exams) {
      const question = exam.questions.find((q) => q.id === questionId);
      if (question !== undefined) return { exam, question };
    }
    throw new ApiError("COMMON_NOT_FOUND", { question_id: questionId });
  }

  /** 题目（揭晓前不含答案与解析）。 */
  questionView(questionId: string): Body {
    const { exam, question } = this.findQuestion(questionId);
    return {
      id: question.id,
      version: question.version,
      exam_id: exam.examId,
      question_type: question.question_type,
      response_form: question.response_form,
      credibility: question.credibility,
      knowledge_point_ids: [...question.knowledge_point_ids],
      stem: question.stem,
      ...pick(question, QUESTION_OPTIONAL_KEYS),
    };
  }

  /** 答案与解析：作答过才给（揭晓前不给，PRAC_REVEAL_LOCKED）。 */
  solution(questionId: string): Body {
    const { exam, question } = this.findQuestion(questionId);
    if (!this.#state(exam.examId).attempts.some((a) => a.questionId === questionId)) {
      throw new ApiError("PRAC_REVEAL_LOCKED", { question_id: questionId });
    }
    return { question_id: question.id, ...pick(question, SOLUTION_KEYS) };
  }

  card(cardId: string): Body {
    for (const exam of this.fixtures.exams) {
      const card = exam.cards.find((c) => c.id === cardId);
      if (card !== undefined) return { ...card };
    }
    throw new ApiError("COMMON_NOT_FOUND", { card_id: cardId });
  }

  /** 某知识点的下一道题：今天还没做过的优先。 */
  nextQuestion(pointId: string, day: LearningDay): Body {
    for (const exam of this.fixtures.exams) {
      const candidates = exam.questions.filter((q) => q.knowledge_point_ids.includes(pointId));
      if (candidates.length === 0) continue;
      const attempts = this.#state(exam.examId).attempts;
      const doneToday = new Set(attempts.filter((a) => a.day === day).map((a) => a.questionId));
      const next = candidates.find((q) => !doneToday.has(q.id)) ?? candidates[0];
      if (next !== undefined) return this.questionView(next.id);
    }
    throw new ApiError("COMMON_NOT_FOUND", { point_id: pointId });
  }

  /** 提交作答并揭晓：追加一条作答；选择题自动判分，做错进错题本，今日清单的题组跟着变。 */
  submitAnswer(input: unknown, now: number): Body {
    const body = isRecord(input) ? input : {};
    const questionId = typeof body["question_id"] === "string" ? body["question_id"] : "";
    const { exam, question } = this.findQuestion(questionId);
    const confidence = body["confidence"];
    if (typeof confidence !== "string" || !CONFIDENCES.includes(confidence)) {
      throw new ApiError("PRAC_CONFIDENCE_REQUIRED", { question_id: questionId });
    }
    if (body["question_version"] !== question.version) {
      throw new ApiError("COMMON_VALIDATION", { field: "question_version", expected: question.version });
    }
    const response = isRecord(body["response"]) ? body["response"] : {};
    const raw = Array.isArray(response["selected"]) ? response["selected"] : [];
    const selected = raw.filter((v): v is number => Number.isInteger(v));
    const graded = question.response_form === "choice" && question.answer !== undefined;
    const correct = graded && question.answer !== undefined ? sameAnswer(selected, question.answer) : null;
    const day = this.learningDay(now);
    const at = new Date(now).toISOString();
    const state = this.#state(exam.examId);
    const attempt: AttemptRecord = { id: uuidv7(now), questionId, day, correct };
    state.attempts.push(attempt);
    const mistake = graded ? this.#recordMistake(state, exam, question, correct === true, day, at) : null;
    return {
      attempt_id: attempt.id,
      question_id: questionId,
      graded,
      correct,
      evidence_strength: sampleStrength(graded, correct, confidence, question.credibility),
      mistake_id: mistake?.id ?? null,
      solution: { question_id: question.id, ...pick(question, SOLUTION_KEYS) },
      data_source: SAMPLE,
    };
  }

  /** 错题的占位做法（示例；正式规则见规则卡 R03）：做错进错题本，按参数 practice.mistake.review_intervals 安排回炉。 */
  #recordMistake(
    state: ExamState,
    exam: DemoExam,
    question: QuestionFixture,
    correct: boolean,
    day: LearningDay,
    at: string,
  ): MistakeRecord | null {
    const intervals = param("practice.mistake.review_intervals");
    const gap = (step: number): number => intervals[Math.min(step, intervals.length - 1)] ?? 0;
    const existing = state.mistakes.get(question.id);
    if (existing === undefined) {
      if (correct) return null;
      const created: MistakeRecord = {
        id: uuidv7(Date.parse(at)),
        questionId: question.id,
        examId: exam.examId,
        knowledgePointIds: [...question.knowledge_point_ids],
        createdAt: at,
        createdDay: day,
        status: "new",
        wrongCount: 1,
        correctStreak: 0,
        lastAnsweredAt: at,
        nextDueDay: addDays(day, gap(0)),
        lastRetryDay: null,
      };
      state.mistakes.set(question.id, created);
      return created;
    }
    if (existing.status === "graduated") return existing;
    if (existing.nextDueDay <= day) existing.lastRetryDay = day;
    existing.lastAnsweredAt = at;
    if (correct) {
      existing.correctStreak += 1;
      existing.status = existing.correctStreak >= param("practice.mistake.graduate_correct_count") ? "awaiting_check" : "retrying";
      existing.nextDueDay = addDays(day, gap(existing.correctStreak));
    } else {
      existing.wrongCount += 1;
      existing.correctStreak = 0;
      existing.status = "retrying";
      existing.nextDueDay = addDays(day, gap(0));
    }
    return existing;
  }

  /** 今日清单（示例）：fixtures 里的任务，按今天的作答算进度；到期的错题合成一项“错题回炉”放在巩固段最前面。 */
  todayList(exam: DemoExam, day: LearningDay): Body {
    const state = this.#state(exam.examId);
    const answered = new Set(state.attempts.filter((a) => a.day === day).map((a) => a.questionId));
    const tasks = exam.learner.today_tasks.map((task) => taskView(task, answered));
    const due = [...state.mistakes.values()].filter((m) => isDue(m, day));
    if (due.length > 0) {
      const template = exam.learner.mistake_retry_task;
      const retry: TaskFixture = {
        id: template.id,
        segment: "consolidate",
        source: "mistake_retry",
        title: VOCAB.task_source.mistake_retry,
        minutes: due.length * template.minutes_per_question,
        question_ids: due.map((m) => m.questionId),
        card_ids: [],
        knowledge_point_ids: [...new Set(due.flatMap((m) => m.knowledgePointIds))],
      };
      tasks.unshift(taskView(retry, answered));
    }
    const segments = SEGMENTS.map((segment) => ({ segment, tasks: tasks.filter((t) => t.segment === segment) }));
    return { day, exam_id: exam.examId, segments, data_source: SAMPLE };
  }

  /** 错题列表：新的在前，游标分页。 */
  listMistakes(exam: DemoExam, cursor: string | null, limit: string | null): Body {
    const all = [...this.#state(exam.examId).mistakes.values()].sort(newestFirst);
    return page(all.map(mistakeView), cursor, limit);
  }

  /** 学习计划（示例值；计划引擎落地前标 data_source: sample）。 */
  currentPlan(exam: DemoExam): Body {
    return { ...exam.learner.plan, data_source: SAMPLE };
  }

  listProposals(exam: DemoExam, cursor: string | null, limit: string | null): Body {
    return page(exam.learner.proposals, cursor, limit);
  }

  listNotes(exam: DemoExam, cursor: string | null, limit: string | null): Body {
    return page(exam.learner.notes, cursor, limit);
  }

  listMaterials(exam: DemoExam, cursor: string | null, limit: string | null): Body {
    return page(exam.learner.materials, cursor, limit);
  }

  listNotifications(exam: DemoExam, cursor: string | null, limit: string | null): Body {
    return page(exam.learner.notifications, cursor, limit);
  }

  /** 掌握方格（示例值）：fixtures 里有的用示例，没有的按未学、证据不足。 */
  masteryGrid(mapId: string): Body {
    const exam = this.fixtures.exams.find((e) => e.map.map_id === mapId);
    if (exam === undefined) throw new ApiError("COMMON_NOT_FOUND", { map_id: mapId });
    const seeds = new Map(exam.learner.mastery.map((m) => [m.knowledge_point_id, m]));
    const cells: Body[] = [];
    for (const chapter of exam.map.chapters) {
      for (const point of chapter.sample_points) {
        const seed = seeds.get(point.id);
        cells.push({
          knowledge_point_id: point.id,
          level: seed?.level ?? 0,
          target_level: seed?.target_level ?? point.default_target_level ?? null,
          evidence_sufficient: seed?.evidence_sufficient ?? false,
          pending_verification: seed?.pending_verification ?? false,
          in_scope: seed?.in_scope ?? true,
        });
      }
    }
    return { map_id: mapId, cells, data_source: SAMPLE };
  }

  /** 全部登记参数的当前取值（经参数访问器，已夹在登记区间内）。 */
  params(): Body {
    return Object.fromEntries((Object.keys(PARAMS) as ParamName[]).map((name) => [name, param(name)]));
  }

  trackEvent(event: unknown): void {
    this.#events.push(event);
  }

  events(): readonly unknown[] {
    return this.#events;
  }
}
