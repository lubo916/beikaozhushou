// 依赖方向（0.1b 计划 A4，ADR-026 决定 3）：pnpm deps:graph 执行，verify 一并运行。
// 领域之间的方向取 docs/product/domain-map.yaml 的 depends（单向无环）。
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
      comment: "界面应用只依赖 packages/ui、packages/contract、packages/params，不引用 domains、db、ai 与服务端应用",
      from: { path: "^apps/(?:learner|org|admin)/" },
      to: { path: "^(?:packages/(?:domains|db|ai)/|apps/(?:api|worker)/)" },
    },
    {
      name: "ui-apps-no-server-libs",
      severity: "error",
      comment: "服务端依赖不进界面应用",
      from: { path: "^apps/(?:learner|org|admin)/" },
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
      from: { path: "^packages/params/", pathNot: "\\.test\\.ts$" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "domains-via-entry",
      severity: "error",
      comment: "领域之间只经对方的包入口（src/index.ts）",
      from: { path: "^packages/domains/([^/]+)/" },
      to: { path: "^packages/domains/[^/]+/", pathNot: "^packages/domains/$1/|^packages/domains/[^/]+/src/index\\.ts$" },
    },
    {
      name: "apps-use-domain-entries",
      severity: "error",
      comment: "apps/api 与 apps/worker 只经领域包入口装配",
      from: { path: "^apps/(?:api|worker)/" },
      to: { path: "^packages/domains/[^/]+/", pathNot: "^packages/domains/[^/]+/src/index\\.ts$" },
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
      comment: "依赖无法解析：先运行 pnpm install、python3 scripts/spec_tool.py gen 与 pnpm db:generate",
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
