// ESLint 10 扁平配置（0.1b 计划 A3）。禁用库清单与 scripts/engineering/dependency-policy.json 共用一处；
// 样式字面量检查由 scripts/engineering/check_style_literals.py 执行（pnpm lint 一并运行），依赖方向由 dependency-cruiser 执行。
import { readFileSync } from "node:fs";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const policy = JSON.parse(readFileSync(new URL("./scripts/engineering/dependency-policy.json", import.meta.url), "utf8"));

const bannedPaths = Object.entries(policy.banned).map(([name, message]) => ({ name, message }));
const bannedPatterns = Object.entries(policy.banned_patterns).map(([regex, message]) => ({ regex, message }));
const declarativeRouter = {
  name: "react-router",
  importNames: ["createBrowserRouter", "createHashRouter", "createMemoryRouter", "createStaticRouter", "RouterProvider"],
  message: "React Router 只用声明式路由（ADR-025）：用 BrowserRouter、Routes、Route",
};
const uiAppPatterns = [
  {
    regex: "^@exam-prep/(db|ai|domain-[^/]+)(/.*)?$",
    message: "界面应用只依赖 @exam-prep/ui、@exam-prep/contract、@exam-prep/params（ADR-026 决定 3）",
  },
  { regex: "^(fastify|bullmq|ioredis|pino|@prisma/.+)$", message: "服务端依赖不进界面应用（ADR-026 决定 1）" },
];
const fetchMessage = "界面应用只经 packages/contract 生成的钩子访问接口，不手写请求（ADR-025）";
const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  URL: "readonly",
  require: "readonly",
  module: "writable",
  __dirname: "readonly",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/generated/**",
      "**/*.generated.*",
      "**/.cache/**",
      ".test-results/**",
      "coverage/**",
      "build-artifacts/**",
      ".pack/**",
      "docs/**",
      "design/**",
      "contracts/**",
      "fixtures/**",
      "work/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "no-console": "error",
      "no-restricted-imports": ["error", { paths: [...bannedPaths, declarativeRouter], patterns: bannedPatterns }],
    },
  },
  {
    files: ["apps/{learner,org,admin}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: fetchMessage }, { name: "XMLHttpRequest", message: fetchMessage }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: fetchMessage },
        { object: "globalThis", property: "fetch", message: fetchMessage },
        { object: "self", property: "fetch", message: fetchMessage },
      ],
      "no-restricted-imports": ["error", { paths: [...bannedPaths, declarativeRouter], patterns: [...bannedPatterns, ...uiAppPatterns] }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["scripts/**", "*.config.{js,ts}", ".dependency-cruiser.cjs"],
    rules: { "no-console": "off" },
  },
];
