// 界面入口：错误码、权限、ApiError、请求函数与由 contracts/openapi.yaml 生成的类型和钩子（pnpm contract:gen）。
// 服务端只用 @exam-prep/contract/errors 与 @exam-prep/contract/permissions；Zod 结构与模拟数据分别在 ./zod 与 ./msw。
export { ApiError, isApiError, type ApiErrorDetails, type ErrorBody } from "./api-error.ts";
export { API_BASE_PATH, customFetch, toApiError } from "./fetcher.ts";
export { ERROR_CODES, isErrorCode, type ErrorCode } from "./generated/error-codes.ts";
export { ACTION_ROLES, ROLES, isActionId, isRole, roleAllowed, type ActionId, type Role } from "./generated/permissions.ts";
export * from "./generated/api/endpoints.ts";
export * from "./generated/api/endpoints.schemas.ts";
