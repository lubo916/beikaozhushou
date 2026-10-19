// 服务端可用的入口：只含错误码与 ApiError，不加载请求钩子与界面依赖。
export { ApiError, isApiError, type ApiErrorDetails, type ErrorBody } from "./api-error.ts";
export { ERROR_CODES, isErrorCode, type ErrorCode } from "./generated/error-codes.ts";
