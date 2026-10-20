// 依赖方向（0.1b 计划 A4，ADR-026 决定 3；F02 改为领域两层）：pnpm deps:graph 执行，pnpm lint 一并运行。
// 领域之间的方向取 docs/product/domain-map.yaml 的 depends（单向无环）；领域包的公开入口只有 core/index.ts 与 server/index.ts。
// 页面组件不引用领域包；只有界面的假数据层 src/mocks/ 能引用领域的 core（api-rules 第 4 节）；core 与 packages/shared 是纯函数。
const fs = require("node:fs");
const path = require("node:path");

function readDomainMap() {
  const text = fs.readFileSync(path.join(__dirname, "docs/product/domain-map.yaml"), "utf8");
  const domains = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^- /.test(line)) {
      current = { name: "", depends: [] };
      domains.push(current);
    }
    const m = current && line.match(/^\s*-?\s*(name|depends):\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1] === "name") current.name = m[2];
    else
      current.depends = m[2]
        .replace(/[[\]]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return domains.filter((d) => d.name);
}

// pnpm 的实路径同样含最后一级 node_modules，无需嵌套可选量词。
const SERVER_LIBS = "node_modules/(?:fastify|bullmq|ioredis|pino|@prisma/[^/]+)/";
const UI_APPS = "^apps/(?:learner|org|admin)/";
const UI_MOCKS = "^apps/(?:learner|org|admin)/src/mocks/";
const DOMAIN_CORE = "^packages/domains/[^/]+/core/";
const DOMAIN_ENTRY = "^packages/domains/[^/]+/(?:core|server)/index\\.ts$";
const NOT_TEST = "\\.test\\.ts$";

const domainDirection = readDomainMap().map((d) => ({
  name: `domain-direction-${d.name}`,
  severity: "error",
  comment: `领域 ${d.name} 只能依赖 ${d.depends.join("、") || "（无）"}（docs/product/domain-map.yaml）`,
  from: { path: `^packages/domains/${d.name}/` },
  to: { path: "^packages/domains/", pathNot: `^packages/domains/(?:${[d.name, ...d.depends].join("|")})/` },
}));

module.exports = {
  forbidden: [
    {
      name: "ui-apps-allowed-packages",
      severity: "error",
      comment: "界面应用不引用 db、ai 与服务端应用；领域包只能由 src/mocks/ 引用 core（见下两条）",
      from: { path: UI_APPS },
      to: { path: "^(?:packages/(?:db|ai)/|apps/(?:api|worker)/)" },
    },
    {
      name: "ui-pages-no-domains",
      severity: "error",
      comment: "页面组件不引用领域包：规则结果只经接口钩子拿（api-rules 第 3、4 节）",
      from: { path: UI_APPS, pathNot: UI_MOCKS },
      to: { path: "^packages/domains/" },
    },
    {
      name: "ui-mocks-domain-core-only",
      severity: "error",
      comment: "假数据层只引用领域的 core 入口（真规则跑在假数据里），不引用 server 与 core 的内部文件",
      from: { path: UI_MOCKS },
      to: { path: "^packages/domains/", pathNot: "^packages/domains/[^/]+/core/index\\.ts$" },
    },
    {
      name: "ui-apps-no-server-libs",
      severity: "error",
      comment: "服务端依赖不进界面应用",
      from: { path: UI_APPS },
      to: { path: SERVER_LIBS },
    },
    {
      name: "ui-apps-no-node-builtins",
      severity: "error",
      comment: "界面代码在浏览器运行，不引入 node 内置模块（vite.config.ts 除外）",
      from: { path: "^apps/(?:learner|org|admin)/src/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "ui-isolated",
      severity: "error",
      comment: "packages/ui 不依赖 params、contract、domains、db、ai",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/(?:params|contract|domains|db|ai)/" },
    },
    {
      name: "params-no-node-builtins",
      severity: "error",
      comment: "@exam-prep/params 的主入口在浏览器与服务端共用，不引入 node 内置模块",
      from: { path: "^packages/params/", pathNot: NOT_TEST },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "domain-core-pure",
      severity: "error",
      comment: "领域 core 是纯函数：不引用 db、ai、ui、任何领域的 server 层与 apps",
      from: { path: DOMAIN_CORE, pathNot: NOT_TEST },
      to: { path: "^(?:packages/(?:db|ai|ui)/|packages/domains/[^/]+/server/|apps/)" },
    },
    {
      name: "domain-core-no-server-libs",
      severity: "error",
      comment: "领域 core 不引用服务端依赖",
      from: { path: DOMAIN_CORE, pathNot: NOT_TEST },
      to: { path: SERVER_LIBS },
    },
    {
      name: "domain-core-no-node-builtins",
      severity: "error",
      comment: "领域 core 在浏览器里也要能跑，不引入 node 内置模块",
      from: { path: DOMAIN_CORE, pathNot: NOT_TEST },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "shared-pure",
      severity: "error",
      comment: "packages/shared 只可引用 packages/params，不引用其他工作区包、apps 与服务端依赖",
      from: { path: "^packages/shared/", pathNot: NOT_TEST },
      to: { path: `^(?:packages/(?!shared/|params/)|apps/)|${SERVER_LIBS}` },
    },
    {
      name: "shared-no-node-builtins",
      severity: "error",
      comment: "packages/shared 前后端都要能跑，不引入 node 内置模块",
      from: { path: "^packages/shared/", pathNot: NOT_TEST },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "domains-via-entry",
      severity: "error",
      comment: "领域之间只经对方的公开入口（core/index.ts 或 server/index.ts）",
      from: { path: "^packages/domains/([^/]+)/" },
      to: { path: "^packages/domains/[^/]+/", pathNot: "^packages/domains/$1/|^packages/domains/[^/]+/(?:core|server)/index\\.ts$" },
    },
    {
      name: "apps-use-domain-entries",
      severity: "error",
      comment: "apps/api 与 apps/worker 只经领域包的公开入口装配",
      from: { path: "^apps/(?:api|worker)/" },
      to: { path: "^packages/domains/[^/]+/", pathNot: DOMAIN_ENTRY },
    },
    {
      name: "domains-no-cycles",
      severity: "error",
      comment: "领域依赖单向无环",
      from: { path: "^packages/domains/" },
      to: { circular: true },
    },
    ...domainDirection,
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "依赖无法解析：先运行 pnpm install 与 pnpm gen",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(?:^|/)(?:dist|coverage|\\.cache)/|^packages/db/generated/" },
    tsPreCompilationDeps: true,
    moduleSystems: ["es6", "cjs"],
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css"],
    },
  },
};
