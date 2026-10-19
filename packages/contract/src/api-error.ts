import { ERROR_CODES, isErrorCode, type ErrorCode } from "./generated/error-codes.ts";

export type ApiErrorDetails = Record<string, unknown>;

/** 错误响应体（docs/conventions/api.md 规则 3）：code 取自 contracts/errors.yaml。 */
export interface ErrorBody {
  code: ErrorCode;
  message_key: string;
  details: ApiErrorDetails;
}

/** 统一错误：领域代码抛出后由 apps/api 按 code 输出；界面的 fetcher 把非 2xx 响应解析为它。 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly messageKey: string;
  readonly details: ApiErrorDetails;

  constructor(code: ErrorCode, details: ApiErrorDetails = {}) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_CODES[code].httpStatus;
    this.messageKey = ERROR_CODES[code].messageKey;
    this.details = details;
  }

  toBody(): ErrorBody {
    return { code: this.code, message_key: this.messageKey, details: this.details };
  }
}

/** 识别 ApiError；模块被重复加载时 instanceof 失效，按名称与登记的 code 识别。 */
export function isApiError(value: unknown): value is ApiError {
  if (value instanceof ApiError) return true;
  return value instanceof Error && value.name === "ApiError" && isErrorCode((value as { code?: unknown }).code);
}
