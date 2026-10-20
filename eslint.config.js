// ESLint 10 扁平配置（0.1b 计划 A3）。禁用库清单与 scripts/engineering/dependency-policy.json 共用一处；
// 样式字面量检查由 scripts/engineering/check_style_literals.py 执行（pnpm lint 一并运行），依赖方向由 dependency-cruiser 执行。
// 领域两层（F02）：页面组件不引用领域包，只有界面的假数据层 src/mocks/ 能引用领域的 core；领域 core 与 packages/shared 是纯函数。
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
const serverLibs = { regex: "^(fastify|bullmq|ioredis|pino|@prisma/.+)$", message: "服务端依赖不进界面应用（ADR-026 决定 1）" };
const uiAppPatterns = [
  {
    regex: "^@exam-prep/(db|ai|domain-[^/]+)(/.*)?$",
    message: "界面应用只依赖 ui、contract、params、shared 四个包；页面组件不引用领域包（ADR-026 决定 3）",
  },
  serverLibs,
];
// 假数据层（api-rules 第 4 节）：真规则跑在假数据里，所以能引用领域的 core 入口；server、数据库包与 AI 网关不行
const mockPatterns = [
  { regex: "^@exam-prep/(db|ai)(/.*)?$", message: "假数据层不引用数据库包与 AI 网关" },
  { regex: "^@exam-prep/domain-[^/]+(/(?!core$).*)?$", message: "假数据层只引用领域包的 core 入口（@exam-prep/domain-<领域>/core）" },
  serverLibs,
];
const NODE_BUILTINS = ["buffer", "child_process", "crypto", "fs", "http", "https", "net", "os", "path", "stream", "url", "util"];
const nodeBuiltins = `^(node:.+|${NODE_BUILTINS.join("|")})(/.*)?$`;
// 领域 core（tech.md「领域两层」）：纯函数，浏览器的假数据层与服务器共用
const corePatterns = [
  { regex: "^(fastify|bullmq|ioredis|pino|openai|@prisma/.+)(/.*)?$", message: "领域 core 是纯函数，不引用服务端依赖" },
  { regex: "^@exam-prep/(db|ai|ui)(/.*)?$", message: "领域 core 不引用数据库包、AI 网关与界面组件" },
  { regex: "^@exam-prep/domain-[^/]+(/(?!core$).*)?$", message: "领域 core 只引用其他领域的 core 入口，不引用 server" },
  { regex: "^@exam-prep/contract$", message: "领域 core 只用 @exam-prep/contract/errors（主入口带界面请求钩子）" },
  { regex: "^(\\.\\.?/)+(.*/)?server(/.*)?$", message: "领域 core 不引用 server 层" },
  { regex: nodeBuiltins, message: "领域 core 在浏览器里也要能跑，不引入 node 内置模块" },
];
// packages/shared：前后端共用的纯函数与常量，工作区包里只可引用 @exam-prep/params
const sharePatterns = [
  { regex: "^@exam-prep/(?!params$).+$", message: "packages/shared 只可引用 @exam-prep/params" },
  { regex: "^(fastify|bullmq|ioredis|pino|openai|@prisma/.+)(/.*)?$", message: "packages/shared 是纯函数，不引用服务端依赖" },
  { regex: nodeBuiltins, message: "packages/shared 前后端都要能跑，不引入 node 内置模块" },
];
const IMPURE_GLOBALS = ["process", "Buffer", "fetch", "XMLHttpRequest", "localStorage", "sessionStorage", "document", "window"];
const impureMessage = "领域 core 与 packages/shared 是纯函数：运行环境、当前时间与输入输出由调用方传入";
const impureGlobals = IMPURE_GLOBALS.map((name) => ({ name, message: impureMessage }));
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
    files: ["apps/{learner,org,admin}/src/mocks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...bannedPaths, declarativeRouter], patterns: [...bannedPatterns, ...mockPatterns] }],
    },
  },
  {
    files: ["packages/domains/*/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...bannedPaths, declarativeRouter], patterns: [...bannedPatterns, ...corePatterns] }],
      "no-restricted-globals": ["error", ...impureGlobals],
    },
  },
  {
    files: ["packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...bannedPaths, declarativeRouter], patterns: [...bannedPatterns, ...sharePatterns] }],
      "no-restricted-globals": ["error", ...impureGlobals],
    },
  },
  {
    // 裸数字（红线 2）：领域规则里的阈值、比例、上限、天数只经参数访问器读；确需例外的行写 eslint-disable-next-line 并注明理由
    files: ["packages/domains/*/core/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-magic-numbers": [
        "error",
        { ignore: [0, 1, -1], ignoreArrayIndexes: true, ignoreEnums: true, ignoreNumericLiteralTypes: true, ignoreTypeIndexes: true },
      ],
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
