// 开发控制（api-rules 第 5 节）：演示考试切换（kj/js/en/ds）、?state= 强制页面状态、时间旅行与 VITE_REAL 都在接口层这一处，
// 页面不为测试写特殊分支。纯逻辑：页面地址、真实时钟与保存位置都由调用方传入（浏览器里由 index.ts 接上）。
import { PAGE_STATE_CODES, type PageStateCode } from "@exam-prep/shared/vocab";

/** 切换结果存哪里（浏览器里用 sessionStorage，刷新后还在）。 */
export interface ControlStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface DevControlOptions {
  readonly examKeys: readonly string[];
  readonly defaultExamKey: string;
  /** 走真接口的领域（VITE_REAL=plan,practice）。 */
  readonly realDomains?: readonly string[];
  /** 当前页面地址的查询串，用来读 ?state=；默认为空。 */
  readonly search?: () => string;
  /** 真实时钟（毫秒）；默认 Date.now。 */
  readonly clock?: () => number;
  readonly store?: ControlStore;
}

const EXAM_KEY = "bk.dev.exam";
const OFFSET_KEY = "bk.dev.clock_offset_ms";

export class DevControl {
  readonly examKeys: readonly string[];
  readonly realDomains: ReadonlySet<string>;
  #examKey: string;
  #offset: number;
  #version = 0;
  readonly #listeners = new Set<() => void>();
  readonly #search: () => string;
  readonly #clock: () => number;
  readonly #store: ControlStore | undefined;

  constructor(options: DevControlOptions) {
    this.examKeys = options.examKeys;
    this.realDomains = new Set(options.realDomains ?? []);
    this.#search = options.search ?? (() => "");
    this.#clock = options.clock ?? (() => Date.now());
    this.#store = options.store;
    const saved = this.#store?.get(EXAM_KEY) ?? null;
    this.#examKey = saved !== null && this.examKeys.includes(saved) ? saved : options.defaultExamKey;
    const offset = Number(this.#store?.get(OFFSET_KEY) ?? "0");
    this.#offset = Number.isFinite(offset) ? offset : 0;
  }

  /** 给 React 的 useSyncExternalStore 用：订阅变化、取版本号。 */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly version = (): number => this.#version;

  examKey(): string {
    return this.#examKey;
  }

  setExam(key: string): void {
    if (!this.examKeys.includes(key)) throw new RangeError(`没有这个演示考试：${key}（可选 ${this.examKeys.join("、")}）`);
    this.#examKey = key;
    this.#store?.set(EXAM_KEY, key);
    this.#changed();
  }

  /** 页面地址里的 ?state=（七态加锁定的代码，vocabulary.md 第 7 节）；不认识的取值按正常处理。 */
  forcedState(): PageStateCode {
    const value = new URLSearchParams(this.#search()).get("state");
    return PAGE_STATE_CODES.find((code) => code === value) ?? "normal";
  }

  /** 模拟的“现在”：真实时钟加上时间旅行的偏移。 */
  now(): number {
    return this.#clock() + this.#offset;
  }

  clockOffset(): number {
    return this.#offset;
  }

  travelTo(instant: number): void {
    this.#setOffset(instant - this.#clock());
  }

  resetClock(): void {
    this.#setOffset(0);
  }

  isReal(owner: string): boolean {
    return this.realDomains.has(owner);
  }

  #setOffset(offset: number): void {
    this.#offset = offset;
    if (offset === 0) this.#store?.remove(OFFSET_KEY);
    else this.#store?.set(OFFSET_KEY, String(offset));
    this.#changed();
  }

  #changed(): void {
    this.#version += 1;
    for (const listener of this.#listeners) listener();
  }
}

/** VITE_REAL=plan,practice → ["plan", "practice"]。 */
export function parseRealDomains(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
