"""表结构解析（ADR-026 决定 4）：归属与数据类别取自 Prisma 三斜线注释；E-OWN-01、E-OWN-02、E-DC-01 的反例。"""
import unittest
from pathlib import Path

from _support import ROOT, spec_tool, temp_repo, write

DOMAIN_MAP = """- code: LRN
  name: learner
  depends: []
- code: PRAC
  name: practice
  depends: [learner]
- code: ORG
  name: org
  depends: []
"""
DATA_CLASSES = """- id: operational
  visibility: {learner: never, org: masked, platform_ops: always}
- id: personal_learning
  visibility: {learner: always, org: by_consent, platform_ops: masked}
"""


def mini_repo(test, schema: dict) -> Path:
    root = temp_repo(test)
    write(root, "docs/product/domain-map.yaml", DOMAIN_MAP)
    write(root, "contracts/data-classes.yaml", DATA_CLASSES)
    for name, text in schema.items():
        write(root, f"contracts/schema/{name}", text)
    return root


class SchemaPrismaTest(unittest.TestCase):
    def test_repo_schema(self):
        """表结构解析：16 张表的归属与列字段的数据类别都取自三斜线注释，归属与文件名一致"""
        tables, problems = spec_tool.parse_prisma_schema(ROOT / "contracts" / "schema")
        self.assertEqual(problems, [])
        self.assertEqual(len(tables), 16)
        self.assertIn("analytics_events", tables)
        for name, t in tables.items():
            self.assertEqual(Path(t["_file"]).stem, t["owner"], name)
            for f in t["fields"]:
                self.assertTrue(f["data_class"], f"{name}.{f['name']}")
        self.assertTrue(tables["analytics_events"]["append_only"])
        self.assertEqual(tables["evidence_events"]["fields"][1]["ref"], "tenants.id")
        self.assertEqual(tables["mastery_levels"]["primary_key"], ["learner_id", "knowledge_point_id"])
        self.assertIn(["exam_key", "version"], tables["exam_profiles"]["unique"])
        self.assertFalse(list((ROOT / "contracts" / "schema").glob("*.yaml")))

    def test_repo_checks_clean(self):
        """仓库当前的表结构通过 E-OWN-01、E-DC-01"""
        repo = spec_tool.Repo(ROOT)
        found = [str(f) for f in spec_tool.check_owner(repo, None) + spec_tool.check_dc(repo, None) if f.code in ("E-OWN-01", "E-DC-01")]
        found += [str(f) for f in repo.load_errors if f.code == "E-SCHEMA-01" and "contracts/schema" in str(f)]
        self.assertEqual(found, [])

    def test_owner_missing_and_mismatch(self):
        """E-OWN-01：模型缺少 @owner，或 @owner 与所在文件的领域不一致，都被拦下"""
        root = mini_repo(self, {
            "org.prisma": "/// 租户\nmodel Tenant {\n  /// @data-class operational\n  id String @id @db.Uuid\n\n  @@map(\"tenants\")\n}\n",
            "practice.prisma": "/// @owner learner\nmodel Session {\n  /// @data-class personal_learning\n  id String @id\n\n  @@map(\"sessions\")\n}\n",
        })
        codes = [(f.code, f.loc) for f in spec_tool.check_owner(spec_tool.Repo(root), None)]
        self.assertIn(("E-OWN-01", "tenants"), codes)
        self.assertEqual(sum(1 for c in codes if c == ("E-OWN-01", "sessions")), 1)

    def test_data_class_missing(self):
        """E-DC-01：列字段缺少 @data-class 被拦下，关系字段不要求标注"""
        root = mini_repo(self, {
            "org.prisma": ("/// @owner org\nmodel Tenant {\n  /// @data-class operational\n  id String @id @db.Uuid\n  name String\n\n"
                           "  users User[] @relation(\"User_tenant_id\")\n\n  @@map(\"tenants\")\n}\n\n"
                           "/// @owner org\nmodel User {\n  /// @data-class nonexistent\n  id String @id @db.Uuid\n"
                           "  /// @data-class operational\n  tenant_id String @db.Uuid\n"
                           "  tenant Tenant @relation(\"User_tenant_id\", fields: [tenant_id], references: [id])\n\n  @@map(\"users\")\n}\n"),
        })
        found = {(f.code, f.loc) for f in spec_tool.check_dc(spec_tool.Repo(root), None)}
        self.assertIn(("E-DC-01", "tenants.name"), found)
        self.assertIn(("E-DC-01", "users.id"), found)
        self.assertNotIn(("E-DC-01", "users.tenant"), found)
        self.assertNotIn(("E-DC-01", "tenants.users"), found)

    def test_learner_tables_written_elsewhere(self):
        """E-OWN-02：learner 以外的领域经 Prisma 客户端写证据表被拦下"""
        root = mini_repo(self, {
            "learner.prisma": ("/// @owner learner\nmodel EvidenceEvent {\n  /// @data-class personal_learning\n  id String @id @db.Uuid\n\n"
                               "  @@map(\"evidence_events\")\n}\n"),
        })
        write(root, "packages/domains/practice/src/submit.ts", "export const save = (db) => db.evidenceEvent.create({ data: {} });\n")
        write(root, "packages/domains/learner/src/record.ts", "export const save = (db) => db.evidenceEvent.create({ data: {} });\n")
        found = [f for f in spec_tool.check_owner(spec_tool.Repo(root), None) if f.code == "E-OWN-02"]
        self.assertEqual(len(found), 1)
        self.assertIn("practice", found[0].file)

    def test_leftover_yaml(self):
        """contracts/schema 中残留的 YAML 表定义报 E-SCHEMA-01（表结构只有一个来源）"""
        root = mini_repo(self, {"legacy.yaml": "table: legacy\nowner: org\nfields: []\n"})
        repo = spec_tool.Repo(root)
        _ = repo.tables
        self.assertTrue(any(f.code == "E-SCHEMA-01" and "YAML" in f.msg for f in repo.load_errors))


if __name__ == "__main__":
    unittest.main()
