import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("ESLint 忽略本地运行产物", () => {
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: resolve(ROOT, "eslint.config.js") });

  it.each([".bk/inbox/bk-v0002-F02-r1-done/repo/apps/learner/src/App.tsx", ".bk/toolchain/node/lib/example.js"])(
    "不检查 %s",
    async (file) => {
      expect(await eslint.isPathIgnored(resolve(ROOT, file))).toBe(true);
    },
  );

  it.each(["apps/learner/src/App.tsx", "packages/db/src/client.ts"])("继续检查正常源码 %s", async (file) => {
    expect(await eslint.isPathIgnored(resolve(ROOT, file))).toBe(false);
  });
});
