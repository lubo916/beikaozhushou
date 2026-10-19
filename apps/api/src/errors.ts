import type { FastifyInstance } from "fastify";
import { ApiError, ERROR_CODES, isApiError, type ErrorBody, type ErrorCode } from "@exam-prep/contract/errors";

export interface ErrorResponse {
  readonly status: number;
  readonly body: ErrorBody;
  /** 未预期异常：响应不回显细节，日志记录完整异常与请求 ID。 */
  readonly unexpected: boolean;
}

/** Fastify 自带错误码 → 统一错误码。 */
const FASTIFY_CODES: Readonly<Record<string, ErrorCode>> = {
  FST_ERR_CTP_INVALID_JSON_BODY: "COMMON_BAD_REQUEST",
  FST_ERR_CTP_EMPTY_JSON_BODY: "COMMON_BAD_REQUEST",
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: "COMMON_BAD_REQUEST",
  FST_ERR_CTP_BODY_TOO_LARGE: "COMMON_PAYLOAD_TOO_LARGE",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "COMMON_UNSUPPORTED_MEDIA_TYPE",
  FST_ERR_VALIDATION: "COMMON_VALIDATION",
};

function fields(error: unknown): Record<string, unknown> {
  return typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
}

function clientCode(status: number): ErrorCode {
  const codes = Object.keys(ERROR_CODES) as ErrorCode[];
  return codes.find((c) => c.startsWith("COMMON_") && ERROR_CODES[c].httpStatus === status) ?? "COMMON_BAD_REQUEST";
}

function issues(validation: unknown[]): { path: string; message: string }[] {
  return validation.map((v) => {
    const f = fields(v);
    return { path: String(f["instancePath"] ?? ""), message: String(f["message"] ?? "") };
  });
}

function respond(error: ApiError, unexpected = false): ErrorResponse {
  return { status: error.status, body: error.toBody(), unexpected };
}

/** 任意异常 → 统一错误体 {code, message_key, details}（docs/conventions/api.md 规则 3）。 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (isApiError(error)) return respond(error);
  const f = fields(error);
  if (Array.isArray(f["validation"])) return respond(new ApiError("COMMON_VALIDATION", { issues: issues(f["validation"]) }));
  const mapped = typeof f["code"] === "string" ? FASTIFY_CODES[f["code"]] : undefined;
  if (mapped) return respond(new ApiError(mapped));
  const status = typeof f["statusCode"] === "number" ? f["statusCode"] : undefined;
  if (status !== undefined && status >= 400 && status < 500) return respond(new ApiError(clientCode(status)));
  return respond(new ApiError("COMMON_INTERNAL"), true);
}

/** 统一错误输出：请求体解析失败、未知路由、请求体过大、媒体类型不支持、未预期异常与领域代码抛出的 ApiError。 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const res = toErrorResponse(error);
    if (res.unexpected) request.log.error({ err: error }, "未预期异常");
    else request.log.info({ code: res.body.code }, "请求被拒绝");
    return reply.code(res.status).send(res.body);
  });
  app.setNotFoundHandler((_request, reply) => {
    const error = new ApiError("COMMON_NOT_FOUND");
    return reply.code(error.status).send(error.toBody());
  });
}
