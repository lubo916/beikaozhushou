// 用 Vite 的 import.meta.glob 读 fixtures/exams/：再加一个演示考试只加数据，不改代码。只在浏览器与 Vitest 里用。
import { buildDemoFixtures, type DemoFixtures, type IndexFixture } from "./demo.ts";

const FILES = import.meta.glob("../../../../fixtures/exams/*/*.json", { eager: true, import: "default" });
const INDEX = import.meta.glob("../../../../fixtures/exams/index.json", { eager: true, import: "default" });

export function loadDemoFixtures(): DemoFixtures {
  const index = Object.values(INDEX)[0];
  if (index === undefined) throw new Error("找不到 fixtures/exams/index.json");
  return buildDemoFixtures(index as IndexFixture, FILES);
}
