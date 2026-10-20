"""V3 内容一致性检查的移植（F01 交接单列出、交给 F02 的几项）：考试名不写进领域代码（红线 1）、代码读的参数都已登记、
表的归属与数据类别、地基文档体积、生成物与来源一致；没人用的参数只提示、不报错。反例只在临时目录里构造。
裸数字（红线 2）由 ESLint 检查（eslint.config.js 的 @typescript-eslint/no-magic-numbers，tests/lint/layers.test.ts）。"""
import json
import re
import subprocess
import unittest

from _support import ROOT, temp_repo, write

CODE_SUFFIXES = {".ts", ".tsx"}
SKIP_PARTS = {"node_modules", "generated", "dist", ".cache"}
PRISMA_SCALARS = {"String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes", "Unsupported"}
PARAM_RES = (re.compile(r"""\bparam\(\s*["']([^"']+)["']"""), re.compile(r"""\bPARAMS\[\s*["']([^"']+)["']\s*\]"""))
OWN_TARGETS = "params,errors,permissions,metrics,pages,models"


def code_files(root, *dirs, tests=True):
    for d in dirs:
        for p in sorted((root / d).rglob("*")) if (root / d).exists() else []:
            rel = p.relative_to(root)
            if p.suffix in CODE_SUFFIXES and not SKIP_PARTS & set(rel.parts) and (tests or ".test." not in p.name):
                yield p


def exam_names(root):
    """演示考试的 ID、名称、简称与别名（fixtures/exams/*/profile.json）。"""
    names = set()
    for p in sorted((root / "fixtures/exams").glob("*/profile.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        names.update(v for v in (data.get("exam_id"), data.get("name"), data.get("short_name"), *(data.get("aliases") or [])) if v)
    return names


def exam_name_problems(root):
    """红线 1：领域代码不按考试写分支，代码里不出现考试 ID、名称或别名（考试差异只放数据与配置）。"""
    names = sorted(exam_names(root))
    out = []
    for p in code_files(root, "packages/domains"):
        text = p.read_text(encoding="utf-8")
        out += [f"{p.relative_to(root).as_posix()}：出现考试名“{n}”（考试差异只放数据与配置）" for n in names if n in text]
    return out


def param_problems(root):
    """代码里用 param("…") 或 PARAMS["…"] 读的参数名都要在 contracts/params.yaml 登记；返回（问题，没人用的参数）。"""
    known = set(re.findall(r"^- name:\s*(\S+)\s*$", (root / "contracts/params.yaml").read_text(encoding="utf-8"), re.M))
    out, used = [], set()
    for p in code_files(root, "apps", "packages", tests=False):
        text = p.read_text(encoding="utf-8")
        for name in (n for r in PARAM_RES for n in r.findall(text)):
            used.add(name)
            if name not in known:
                out.append(f"{p.relative_to(root).as_posix()}：参数 {name} 没有在 contracts/params.yaml 登记")
    return out, sorted(known - used)


def data_classes(root):
    """数据类别 → 是否写了机构可见规则（visibility 里有 org）。"""
    out, cur = {}, None
    for line in (root / "contracts/data-classes.yaml").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^- id:\s*(\S+)", line)
        if m:
            cur = m.group(1)
            out[cur] = False
        elif cur and re.match(r"^\s+visibility:\s*\{.*\borg:", line):
            out[cur] = True
    return out


def schema_problems(root):
    """表的归属与数据类别（docs/history/v3/conventions/data.md 规则 1、2）：模型的 @owner 与文件名一致，每个列字段都有登记过的
    @data-class，每个数据类别都写了机构可见规则；证据（EvidenceEvent）与掌握档（MasteryLevel）只能归 learner。"""
    classes = data_classes(root)
    files = {p: p.read_text(encoding="utf-8").splitlines() for p in sorted((root / "packages/db/prisma/schema").glob("*.prisma"))}
    enums = {m.group(1) for lines in files.values() for l in lines if (m := re.match(r"^\s*enum\s+(\w+)\s*\{", l))}
    out, owners = [], {}
    for p, lines in files.items():
        rel = p.relative_to(root).as_posix()
        doc, model, field_doc = [], None, []
        for line in lines:
            t = line.strip()
            if model is None:
                m = re.match(r"^model\s+(\w+)\s*\{$", t)
                if t.startswith("///"):
                    doc.append(t[3:].strip())
                elif m:
                    model, field_doc = m.group(1), []
                    owner = next((d.split()[1] for d in doc if d.startswith("@owner ")), None)
                    owners[model] = owner
                    if owner != p.stem:
                        out.append(f"{rel}：{model} 的 @owner 是 {owner}，应与文件名 {p.stem} 一致")
                    doc = []
                elif t and not t.startswith("//"):
                    doc = []
                continue
            if t == "}":
                model = None
            elif t.startswith("///"):
                field_doc.append(t[3:].strip())
                continue
            elif (m := re.match(r"^(\w+)\s+([A-Za-z]\w*)", t)) and not t.startswith("@@") and (m.group(2) in PRISMA_SCALARS | enums):
                cls = next((d.split()[1] for d in field_doc if d.startswith("@data-class ")), None)
                if cls is None:
                    out.append(f"{rel}：{model}.{m.group(1)} 缺少 /// @data-class")
                elif cls not in classes:
                    out.append(f"{rel}：{model}.{m.group(1)} 的数据类别 {cls} 没有在 contracts/data-classes.yaml 登记")
            field_doc = []
    out += [f"contracts/data-classes.yaml：数据类别 {c} 缺少机构可见规则（visibility.org）" for c, ok in classes.items() if not ok]
    out += [f"{m} 只能归 learner 领域（只有 learner 能写证据与掌握档）" for m in ("EvidenceEvent", "MasteryLevel") if owners.get(m, "learner") != "learner"]
    return out


def doc_size_problems(root):
    """文档体积：AGENTS.md 不超过 150 行，地基文档（docs/baseline/）每份不超过 300 行。"""
    limits = [(root / "AGENTS.md", 150)] + [(p, 300) for p in sorted((root / "docs/baseline").rglob("*.md"))]
    out = []
    for p, limit in limits:
        n = len(p.read_text(encoding="utf-8").splitlines()) if p.exists() else 0
        if n > limit:
            out.append(f"{p.relative_to(root).as_posix()}：{n} 行，超过 {limit} 行（新增规则先问：能不能做成检查？）")
    return out


class ContentConsistencyTest(unittest.TestCase):
    def test_repo(self):
        """仓库当前：考试名、参数、表结构、文档体积四项都没有问题"""
        problems, unused = param_problems(ROOT)
        problems += exam_name_problems(ROOT) + schema_problems(ROOT) + doc_size_problems(ROOT)
        self.assertEqual(problems, [])
        if unused:
            print(f"\n  提示：{len(unused)} 个参数还没有代码引用（如 {unused[0]}），接业务代码后会逐步用上")

    def test_generated_match_sources(self):
        """生成物与来源一致（pnpm gen --check；Orval 与 Prisma 要装好依赖，这里只比对 packages/codegen 自己生成的部分）"""
        r = subprocess.run(["node", "packages/codegen/src/main.ts", "--check", f"--only={OWN_TARGETS}"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_exam_name_counterexample(self):
        """反例：领域代码里写考试名被拦下"""
        root = temp_repo(self, copies=("fixtures/exams",))
        write(root, "packages/domains/plan/core/rule.ts", 'export const isKj = (name: string) => name === "初级会计";\n')
        self.assertTrue(any("初级会计" in p for p in exam_name_problems(root)))

    def test_param_counterexample(self):
        """反例：读了没登记的参数被拦下；测试文件里故意读未登记参数的类型反例不算"""
        root = temp_repo(self, copies=("contracts/params.yaml",))
        write(root, "packages/domains/plan/core/rule.ts", 'import { param } from "@exam-prep/params";\nexport const x = () => param("plan.nope");\n')
        write(root, "packages/params/index.test.ts", 'param("unknown");\n')
        problems, _ = param_problems(root)
        self.assertEqual([p for p in problems if "plan.nope" in p], problems)
        self.assertEqual(len(problems), 1)

    def test_schema_counterexample(self):
        """反例：@owner 与文件名不一致、字段缺 @data-class、证据表不归 learner 都被拦下"""
        root = temp_repo(self, copies=("contracts/data-classes.yaml",))
        write(root, "packages/db/prisma/schema/plan.prisma",
              "/// @owner learner\nmodel EvidenceEvent {\n  /// @data-class personal_learning\n  id String @id\n  note String\n}\n")
        problems = schema_problems(root)
        self.assertTrue(any("应与文件名 plan 一致" in p for p in problems), problems)
        self.assertTrue(any("EvidenceEvent.note 缺少" in p for p in problems), problems)
        write(root, "packages/db/prisma/schema/plan.prisma", "/// @owner plan\nmodel EvidenceEvent {\n  /// @data-class personal_learning\n  id String @id\n}\n")
        self.assertTrue(any("只能归 learner" in p for p in schema_problems(root)))

    def test_doc_size_counterexample(self):
        """反例：地基文档超过 300 行被拦下"""
        root = temp_repo(self)
        write(root, "AGENTS.md", "x\n")
        write(root, "docs/baseline/long.md", "x\n" * 301)
        self.assertTrue(any("long.md" in p for p in doc_size_problems(root)))


if __name__ == "__main__":
    unittest.main()
