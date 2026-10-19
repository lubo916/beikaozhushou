"""spec_tool gen 的 0.1b 产物（计划 C1–C5、C8）：内容、gen --check 的覆盖与手改检出。"""
import re
import unittest

from _support import ROOT, spec_tool, temp_repo

SOURCES = ["contracts/params.yaml", "contracts/errors.yaml", "contracts/permissions.yaml", "contracts/events.yaml",
           "contracts/metrics.yaml", "contracts/schema", "design/screens/learner", "design/tokens.json", "design/tokens.resolver.json"]
OUTPUT_KEYS = ["params_out", "pages_out", "errors_out", "permissions_out", "events_out", "metrics_out", "db_models_out",
               "tokens_out", "tokens_tailwind_out"]


class GeneratorsTest(unittest.TestCase):
    def setUp(self):
        self.repo = spec_tool.Repo(ROOT)

    def test_params_registry(self):
        """参数登记产物只含数据与类型，integer 标记取自 YAML 默认值是否为整数"""
        (path, (text, _, _)), = spec_tool.gen_params_output(self.repo).items()
        self.assertEqual(path, "packages/params/registry.generated.ts")
        self.assertNotIn("function", text)
        for name, e in self.repo.params.items():
            d = e.get("default")
            want = "true" if isinstance(d, int) and not isinstance(d, bool) else "false"
            line = next(ln for ln in text.splitlines() if ln.startswith(f'  "{name}"'))
            self.assertTrue(line.rstrip(",").endswith(f"integer: {want} }}"), name)
        for t in ("export type ParamName", "export type ParamValue"):
            self.assertIn(t, text)

    def test_pages(self):
        """学员端页面清单含页面 ID、标题、模式与各视图的 ID 和模式（视图未写模式取页面模式）"""
        (_, (text, _, _)), = spec_tool.gen_pages_output(self.repo).items()
        self.assertEqual(len(re.findall(r'^  \{ id: "S\d{2}"', text, re.M)), 35)
        self.assertIn('{ id: "test", mode: "immersive" }', text)
        s01 = next(ln for ln in text.splitlines() if '"S01"' in ln)
        self.assertIn('{ id: "first", mode: "standalone" }', s01)
        self.assertIn('{ id: "off", mode: "standard" }', text)

    def test_contract_and_metrics_registries(self):
        """错误码、权限、事件与指标产物覆盖登记的全部条目"""
        out = {}
        out.update(spec_tool.gen_contract_registry_outputs(self.repo))
        out.update(spec_tool.gen_metrics_registry_outputs(self.repo))
        errors = out["packages/contract/src/generated/error-codes.ts"][0]
        for code, e in self.repo.errors.items():
            self.assertIn(f'"{code}": {{ httpStatus: {e["http_status"]}, messageKey: "{e["message_key"]}" }}', errors)
        perms = out["packages/contract/src/generated/permissions.ts"][0]
        for aid in self.repo.actions:
            self.assertIn(f'"{aid}": [', perms)
        self.assertIn('"learner.evidence.record": [],', perms)
        events = out["packages/domains/metrics/src/generated/events.ts"][0]
        metrics = out["packages/domains/metrics/src/generated/metrics.ts"][0]
        for name in self.repo.analytics_events:
            self.assertIn(f'"{name}":', events)
        for mid in self.repo.metrics:
            self.assertIn(f'"{mid}":', metrics)

    def test_db_models(self):
        """数据库表元数据：按租户隔离与只追加取自 Prisma 注释"""
        (_, (text, _, _)), = spec_tool.gen_db_models_output(self.repo).items()
        self.assertIn('AnalyticsEvent: { table: "analytics_events", owner: "metrics", tenantScoped: true, appendOnly: true,', text)
        self.assertIn('Tenant: { table: "tenants", owner: "org", tenantScoped: false, appendOnly: false,', text)

    def _generated_repo(self):
        root = temp_repo(self, SOURCES)
        repo = spec_tool.Repo(root)
        for path, (content, _, _) in spec_tool.gen_outputs(repo).items():
            spec_tool.write_text(root / path, content)
        return root

    def test_check_covers_all_outputs(self):
        """gen --check 覆盖计划 C 节的全部产物：生成后一致，删除任一产物报 E-GEN-01"""
        root = self._generated_repo()
        self.assertEqual([str(f) for f in spec_tool.check_gen(spec_tool.Repo(root), None)], [])
        for key in OUTPUT_KEYS:
            rel = spec_tool.CFG["gen"][key]
            p = root / rel
            saved = p.read_text(encoding="utf-8")
            p.unlink()
            found = [f for f in spec_tool.check_gen(spec_tool.Repo(root), None) if f.file == rel]
            self.assertEqual([f.code for f in found], ["E-GEN-01"], rel)
            spec_tool.write_text(p, saved)

    def test_hand_edit_detected(self):
        """手改任一生成物都被 gen --check 检出（E-GEN-02）"""
        root = self._generated_repo()
        for key in OUTPUT_KEYS:
            rel = spec_tool.CFG["gen"][key]
            p = root / rel
            saved = p.read_text(encoding="utf-8")
            spec_tool.write_text(p, saved + "\n/* 手改 */\n")
            found = [f for f in spec_tool.check_gen(spec_tool.Repo(root), None) if f.file == rel]
            self.assertEqual([f.code for f in found], ["E-GEN-02"], rel)
            spec_tool.write_text(p, saved)

    def test_source_change_marks_stale(self):
        """源改动而产物未重新生成时报过期（E-GEN-01），不误报手改"""
        root = self._generated_repo()
        p = root / "contracts" / "errors.yaml"
        p.write_text(p.read_text(encoding="utf-8").replace("error.common.bad_request", "error.common.bad_request_v2"), encoding="utf-8")
        found = [(f.code, f.file) for f in spec_tool.check_gen(spec_tool.Repo(root), None)]
        self.assertEqual(found, [("E-GEN-01", "packages/contract/src/generated/error-codes.ts")])


if __name__ == "__main__":
    unittest.main()
