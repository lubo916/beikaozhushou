// S09 的数据（ui-rules 第 8 节、api-rules 第 3 节）：页面只经生成的钩子拿数据；“该显示七态里的哪一态”、视图键与筛选条件也在这里，
// 页面组件只管显示。?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足、锁定给特定数据），页面不为测试写分支。
// 筛选只比对接口给的值（是否达标、标记、资料覆盖等），不自己算业务数字。
import {
  getGetKnowledgeMapOverviewQueryKey,
  isApiError,
  useGetKnowledgeMapOverview,
  type S09Chapter,
  type S09MapOverview,
  type S09Point,
} from "@exam-prep/contract";
import { MASTERY_RANKS, type MasteryRank } from "@exam-prep/shared/vocab";

/** 网络或服务异常自动再试一次（约一秒后出结果，F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 整页的状态。 */
export type MapState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";
/** 照常显示时顶上的提示条：断网时用的是上次的数据、底图只读（受限）、整张图证据不够（数据不足）。锁定只落在“性价比阶梯”着色上。 */
export type MapNotice = "offline" | "restricted" | "insufficient_data";

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface MapQuery {
  readonly data: S09MapOverview | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface MapView {
  readonly state: MapState;
  readonly data: S09MapOverview | undefined;
  readonly notices: readonly MapNotice[];
  /** 地图体检不通过：“性价比阶梯”着色置灰，写明原因与“去修复”（S09-10）。 */
  readonly locked: boolean;
}

/** 没联网：请求没拿到回应（不是接口回的错误），或浏览器报告离线、查询被暂停。 */
function isOffline(query: MapQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 空态：这个考试还没有启用知识地图（一章都没有）。 */
export function isEmptyMap(data: S09MapOverview): boolean {
  return data.chapters.length === 0;
}

export function mapView(query: MapQuery): MapView {
  const { data } = query;
  if (data !== undefined) {
    const notices: MapNotice[] = [];
    if (isOffline(query)) notices.push("offline");
    if (data.access === "extension_only") notices.push("restricted");
    if (!data.evidence_sufficient) notices.push("insufficient_data");
    return { state: isEmptyMap(data) ? "empty" : "normal", data, notices, locked: !data.health.passed };
  }
  const none = { data, notices: [], locked: false };
  if (isOffline(query)) return { state: "offline", ...none };
  if (query.status === "pending") return { state: "loading", ...none };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", ...none };
  return { state: "error", ...none };
}

/** 本页的数据钩子：生成的钩子，加上重试策略与七态判断。 */
export function useKnowledgeMapOverview(): MapView & { readonly retry: () => void } {
  const query = useGetKnowledgeMapOverview({ query: { queryKey: getGetKnowledgeMapOverviewQueryKey(), retry: shouldRetry } });
  return { ...mapView(query), retry: () => void query.refetch() };
}

/** 四个视图（S09-01）。?view= 用这些键；没写或写错时，手机默认大纲树（S09-18），其余默认方格。 */
export const VIEW_KEYS = ["grid", "tree", "graph", "list"] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

export function viewFromSearch(value: string | null, narrow: boolean): ViewKey {
  return VIEW_KEYS.find((key) => key === value) ?? (narrow ? "tree" : "grid");
}

/** 六种着色（S09-02，叫法照 vocabulary.md 第 9 节）。 */
export const COLORINGS = ["mastery", "target", "frequency", "forgetting", "roi", "material"] as const;
export type Coloring = (typeof COLORINGS)[number];

/** 筛选（S09-03）：常用的一排，其余收在“更多筛选”里。 */
export const QUICK_FILTERS = ["unreached", "weak", "has_mistakes", "insufficient", "high_frequency"] as const;
export const REACH_FILTERS = ["reached", "unreached"] as const;
export const OTHER_FILTERS = ["due_review", "no_material", "out_of_scope"] as const;
export type FilterKey = (typeof QUICK_FILTERS)[number] | (typeof REACH_FILTERS)[number] | (typeof OTHER_FILTERS)[number];

export interface Filters {
  /** 选了的筛选片：每一片都要满足。 */
  readonly keys: readonly FilterKey[];
  /** 重要度：满足其一即可；空表示不限。 */
  readonly importance: readonly number[];
  /** 掌握档：满足其一即可；空表示不限。 */
  readonly levels: readonly number[];
}

export const NO_FILTERS: Filters = { keys: [], importance: [], levels: [] };

export function hasFilters(filters: Filters): boolean {
  return filters.keys.length > 0 || filters.importance.length > 0 || filters.levels.length > 0;
}

/** 从选了的筛选片里挑出属于某一组的。 */
export function pick<K extends FilterKey>(group: readonly K[], keys: readonly FilterKey[]): K[] {
  return keys.filter((key): key is K => (group as readonly FilterKey[]).includes(key));
}

/** 把某一组的筛选片换成新选的，其他组不动。 */
export function replaceGroup(filters: Filters, group: readonly FilterKey[], next: readonly FilterKey[]): Filters {
  return { ...filters, keys: [...filters.keys.filter((key) => !group.includes(key)), ...next] };
}

function matchesKey(point: S09Point, key: FilterKey): boolean {
  switch (key) {
    case "unreached":
      return point.in_scope && point.target_level !== undefined && !point.reached;
    case "reached":
      return point.reached;
    case "weak":
    case "high_frequency":
    case "due_review":
    case "has_mistakes":
      return point.flags.includes(key);
    case "insufficient":
      return !point.evidence_sufficient;
    case "no_material":
      return point.material === "none";
    case "out_of_scope":
      return !point.in_scope;
  }
}

export function matchesFilters(point: S09Point, filters: Filters): boolean {
  return (
    filters.keys.every((key) => matchesKey(point, key)) &&
    (filters.importance.length === 0 || filters.importance.includes(point.importance)) &&
    (filters.levels.length === 0 || filters.levels.includes(point.level))
  );
}

/** 接口给的档位序号转成掌握档类型（契约限定 0–5，越界的按最低档显示）。 */
export function toRank(value: number): MasteryRank {
  return MASTERY_RANKS.find((rank) => rank === value) ?? 0;
}

export interface Located {
  readonly point: S09Point;
  readonly chapter: S09Chapter;
}

/** 知识点 ID → 知识点与所在章（选中的知识点卡片、关系图取名字用）。 */
export function indexPoints(chapters: readonly S09Chapter[]): ReadonlyMap<string, Located> {
  return new Map(chapters.flatMap((chapter) => chapter.points.map((point): [string, Located] => [point.id, { point, chapter }])));
}

/** 集合里有就去掉、没有就加上（折叠、展开用）。 */
export function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
