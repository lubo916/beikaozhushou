// V01 本地预备：只复制本工作树由 pnpm gen 生成的相同 MSW 工作线程；不改共享源码。
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = process.cwd();
const org = JSON.parse(await readFile(resolve(root, "apps/org/package.json"), "utf8"));
if (org.name !== "@exam-prep/org") throw new Error("请在 V4 工作树根目录执行");
const source = resolve(root, "apps/learner/public/mockServiceWorker.js");
const target = resolve(root, "apps/org/public/mockServiceWorker.js");
const content = await readFile(source);
await mkdir(resolve(root, "apps/org/public"), { recursive: true });
await copyFile(source, target);
const hash = value => createHash("sha256").update(value).digest("hex");
if (hash(content) !== hash(await readFile(target))) throw new Error("工作线程校验不一致");
process.stdout.write(`机构端 MSW 生成产物已就绪：${hash(content)}\n`);
