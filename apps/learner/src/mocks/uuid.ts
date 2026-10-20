// 客户端生成 UUIDv7（api-rules 第 1 节）：前 48 位是毫秒时间，版本位 7、变体位 10，其余随机。
const BYTE = 256;
const TIME_BYTES = 6;
const VERSION_INDEX = 6;
const VARIANT_INDEX = 8;

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let ms = Math.max(0, Math.floor(now));
  for (let i = TIME_BYTES - 1; i >= 0; i -= 1) {
    bytes[i] = ms % BYTE;
    ms = Math.floor(ms / BYTE);
  }
  bytes[VERSION_INDEX] = ((bytes[VERSION_INDEX] ?? 0) & 0x0f) | 0x70;
  bytes[VARIANT_INDEX] = ((bytes[VARIANT_INDEX] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
