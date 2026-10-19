import { QueryClient } from "@tanstack/react-query";

/** 学员端唯一的查询客户端。接口只经 packages/contract 生成的钩子调用，不手写请求函数（ADR-025）。 */
export const queryClient: QueryClient = new QueryClient();
