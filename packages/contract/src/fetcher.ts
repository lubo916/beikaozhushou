import { ApiError, type ApiErrorDetails } from "./api-error.ts";
import { ERROR_CODES, isErrorCode, type ErrorCode } from "./generated/error-codes.ts";

/** 接口前缀：前后端同域，/api 转给 API 服务（ADR-026 决定 6）。 */
export const API_BASE_PATH = "/api";

/** 生成的钩子统一经此发请求（Orval 的 mutator）：2xx 返回解析后的响应体，非 2xx 抛出 ApiError。 */
export async function customFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveUrl(url), init);
  const body = await readBody(response);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

export function resolveUrl(url: string): string {
  if (/^https?:\/\//.test(url) || url === API_BASE_PATH || url.startsWith(`${API_BASE_PATH}/`)) return url;
  return `${API_BASE_PATH}${url.startsWith("/") ? url : `/${url}`}`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  if (!(response.headers.get("content-type") ?? "").includes("json")) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 按 HTTP 状态取通用错误码（COMMON_*）；没有对应时为 COMMON_INTERNAL。 */
export function codeForStatus(status: number): ErrorCode {
  const codes = Object.keys(ERROR_CODES) as ErrorCode[];
  return codes.find((code) => code.startsWith("COMMON_") && ERROR_CODES[code].httpStatus === status) ?? "COMMON_INTERNAL";
}

/** 非 2xx 响应 → ApiError：响应体是登记的统一错误体时沿用其 code 与 details，否则按状态取通用错误码。 */
export function toApiError(status: number, body: unknown): ApiError {
  if (isRecord(body) && isErrorCode(body["code"])) {
    const details: ApiErrorDetails = isRecord(body["details"]) ? body["details"] : {};
    return new ApiError(body["code"], details);
  }
  return new ApiError(codeForStatus(status), { status });
}
