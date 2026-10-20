// 用法：node packages/ui/scripts/gen-tokens.ts [--check]
// 读 design/tokens.json 与 tokens.resolver.json，生成 packages/ui/src/generated/ 下的 tokens.css 与 tailwind-theme.css。
// --check 只比对、不写盘，不一致时退出码 1（pnpm test 里由 packages/ui/scripts/repo-guards.test.ts 运行）。
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTokenCss } from "./tokens-build.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TOKENS = "design/tokens.json";
const RESOLVER = "design/tokens.resolver.json";
const OUTPUTS = {
  tokensCss: "packages/ui/src/generated/tokens.css",
  tailwindCss: "packages/ui/src/generated/tailwind-theme.css",
} as const;

function read(rel: string): string {
  try {
    return readFileSync(ROOT + rel, "utf8");
  } catch {
    return "";
  }
}

const tokensText = read(TOKENS);
const resolverText = read(RESOLVER);
const sha = createHash("sha256").update(`${tokensText}\n${resolverText}`).digest("hex").slice(0, 12);
const built = buildTokenCss(JSON.parse(tokensText), JSON.parse(resolverText), sha);
const check = process.argv.includes("--check");
const stale = (Object.keys(OUTPUTS) as (keyof typeof OUTPUTS)[]).filter((key) => read(OUTPUTS[key]) !== built[key]);
if (stale.length === 0) {
  process.stdout.write("令牌生成物：已是最新\n");
} else if (check) {
  process.stdout.write(`✗ ${stale.map((key) => OUTPUTS[key]).join("、")} 与 ${TOKENS} 不一致：运行 node packages/ui/scripts/gen-tokens.ts\n`);
  process.exitCode = 1;
} else {
  for (const key of stale) writeFileSync(ROOT + OUTPUTS[key], built[key]);
  process.stdout.write(`✓ 令牌生成物：已更新 ${stale.map((key) => OUTPUTS[key]).join("、")}\n`);
}
