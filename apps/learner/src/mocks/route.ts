// 假数据路由的写法：defineRoute("<operationId>", 解析函数, 选项)。operationId 必须是契约里有的（类型检查会拦），
// 解析函数返回响应体（JSON），出错抛 ApiError（错误码见 contracts/errors.yaml）；规则还没实现的在返回里写 data_source: "sample"。
import type { OperationId } from "@exam-prep/contract/operations";
import type { LearningDay } from "@exam-prep/shared/today";
import type { DevControl } from "./control.ts";
import type { MockDb } from "./db.ts";
import type { DemoExam } from "./demo.ts";

/** ?state= 里要按接口给出不同数据的四种；加载、出错、离线由接口层统一处理。 */
export type VariantState = "empty" | "insufficient_data" | "restricted" | "locked";

export interface MockContext {
  readonly db: MockDb;
  readonly control: DevControl;
  /** 当前目标考试（开发工具条或 ?exam= 选的演示考试）。 */
  readonly exam: DemoExam;
  /** 模拟的“现在”（毫秒，含时间旅行）。 */
  readonly now: number;
  /** 按用户时区与日界线算出的学习日。 */
  readonly day: LearningDay;
  /** 路径参数（按契约里的名字，如 examId）。 */
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly headers: Headers;
}

export type MockResolver = (ctx: MockContext) => unknown;

export interface MockRoute {
  readonly operationId: OperationId;
  readonly resolve: MockResolver;
  /** 成功时的状态码：有响应体默认 200，没有响应体默认 204。 */
  readonly status?: number;
  /** ?state= 为 empty、insufficient_data、restricted、locked 时用的数据；没写就按正常数据（restricted 没写时回 403）。 */
  readonly variants?: Partial<Record<VariantState, MockResolver>>;
}

export function defineRoute(
  operationId: OperationId,
  resolve: MockResolver,
  options: Omit<MockRoute, "operationId" | "resolve"> = {},
): MockRoute {
  return { ...options, operationId, resolve };
}
