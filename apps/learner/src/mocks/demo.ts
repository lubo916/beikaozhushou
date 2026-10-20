// 四个演示考试的数据（fixtures/exams/，vocabulary.md 第 9 节）：数据里的考试 ID 是目录名，kj/js/en/ds 只是切换键（F04-Q1）。
// 这里只整理结构；读文件在 fixtures.ts（Vite 的 import.meta.glob），测试与离线脚本可以直接把文件内容传进来。

export interface DemoLearner {
  readonly id: string;
  readonly display_name: string;
  readonly is_guest: boolean;
}

export interface IndexFixture {
  readonly default_key: string;
  readonly learner: DemoLearner;
  readonly exams: readonly { readonly key: string; readonly exam_id: string; readonly role: string }[];
}

export interface ProfileFixture {
  readonly exam_id: string;
  readonly name: string;
  readonly short_name?: string;
  readonly evaluation_rule: { readonly type: string };
  readonly [key: string]: unknown;
}

export interface PointFixture {
  readonly id: string;
  readonly name: string;
  readonly knowledge_types: readonly string[];
  readonly default_target_level?: number | null;
}

export interface ChapterFixture {
  readonly id: string;
  readonly name: string;
  readonly knowledge_point_count: number;
  readonly sample_points: readonly PointFixture[];
}

export interface MapFixture {
  readonly exam_id: string;
  readonly map_id: string;
  readonly map_version: number;
  readonly source: string;
  readonly note?: string;
  readonly chapters: readonly ChapterFixture[];
}

export interface QuestionFixture {
  readonly id: string;
  readonly version: number;
  readonly question_type: string;
  readonly response_form: string;
  readonly credibility: string;
  readonly knowledge_point_ids: readonly string[];
  readonly stem: string;
  readonly options?: readonly string[];
  readonly label?: string;
  readonly hints?: readonly string[];
  readonly answer?: readonly number[];
  readonly [key: string]: unknown;
}

export interface CardFixture {
  readonly id: string;
  readonly knowledge_point_id: string;
  readonly card_type: string;
  readonly front: string;
  readonly back: string;
}

export interface TaskFixture {
  readonly id: string;
  readonly segment: string;
  readonly source: string;
  readonly title: string;
  readonly minutes: number;
  readonly question_ids: readonly string[];
  readonly card_ids: readonly string[];
  readonly knowledge_point_ids: readonly string[];
}

export interface MasteryFixture {
  readonly knowledge_point_id: string;
  readonly level: number;
  readonly target_level?: number | null;
  readonly evidence_sufficient: boolean;
  readonly pending_verification: boolean;
  readonly in_scope: boolean;
}

export interface LearnerFixture {
  readonly exam_id: string;
  readonly goal: { readonly target_score: number | null; readonly target_date: string; readonly primary: boolean };
  readonly mastery: readonly MasteryFixture[];
  readonly today_tasks: readonly TaskFixture[];
  readonly mistake_retry_task: { readonly id: string; readonly minutes_per_question: number };
  /** 计划、提议、笔记、资料、通知的示例（结构见契约 Plan、Proposal、Note、Material、Notification）。 */
  readonly plan: Readonly<Record<string, unknown>>;
  readonly proposals: readonly unknown[];
  readonly notes: readonly unknown[];
  readonly materials: readonly unknown[];
  readonly notifications: readonly unknown[];
}

export interface DemoExam {
  /** 切换键：kj、js、en、ds。 */
  readonly key: string;
  /** 考试 ID（目录名）。 */
  readonly examId: string;
  readonly role: string;
  readonly profile: ProfileFixture;
  readonly map: MapFixture;
  readonly questions: readonly QuestionFixture[];
  readonly cards: readonly CardFixture[];
  readonly learner: LearnerFixture;
}

export interface DemoFixtures {
  readonly defaultKey: string;
  readonly learner: DemoLearner;
  readonly exams: readonly DemoExam[];
}

/** files：以 fixtures/exams/<考试 ID>/<文件名>.json 结尾的路径 → 文件内容。 */
export function buildDemoFixtures(index: IndexFixture, files: Readonly<Record<string, unknown>>): DemoFixtures {
  const pick = (examId: string, name: string): unknown => {
    const hit = Object.entries(files).find(([path]) => path.endsWith(`fixtures/exams/${examId}/${name}.json`));
    if (hit === undefined) throw new Error(`演示数据缺文件：fixtures/exams/${examId}/${name}.json`);
    return hit[1];
  };
  const exams = index.exams.map(({ key, exam_id, role }): DemoExam => {
    const content = pick(exam_id, "questions") as { readonly questions: QuestionFixture[]; readonly cards: CardFixture[] };
    return {
      key,
      examId: exam_id,
      role,
      profile: pick(exam_id, "profile") as ProfileFixture,
      map: pick(exam_id, "knowledge-map") as MapFixture,
      questions: content.questions,
      cards: content.cards,
      learner: pick(exam_id, "learner") as LearnerFixture,
    };
  });
  return { defaultKey: index.default_key, learner: index.learner, exams };
}
