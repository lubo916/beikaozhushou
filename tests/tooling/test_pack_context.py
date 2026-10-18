"""Regression checks for self-contained task packs; no application dependencies."""
import copy
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import yaml

PROJECT = Path(__file__).resolve().parents[2]
module_spec = importlib.util.spec_from_file_location("pack_tool", PROJECT / "scripts/spec_tool.py")
tool = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(tool)


class PackContextTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.config = copy.deepcopy(tool.DEFAULT_CONFIG)
        self.patch = patch.multiple(tool, ROOT=self.root, CFG=self.config)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def repo(self, refs=None):
        self.write("docs/product/roadmap.yaml", yaml.safe_dump([
            {"id": "TEST-01", "title": "Fixture", "domain": "platform", "release": "R1", "depends": [], "covers": []}]))
        fm = {"id": "TEST-01", "status": "draft", "refs": refs or {}}
        self.write("docs/domains/platform/features/TEST-01.md",
                   "---\n" + yaml.safe_dump(fm) + "---\n# Fixture\n\n## 1 Goal\nFixture only.\n")
        return tool.Repo(self.root)

    def test_api_slice_resolves_transitive_and_cyclic_local_components(self):
        repo = self.repo({"api": ["readFixture"]})
        self.write("contracts/openapi.yaml", yaml.safe_dump({
            "paths": {"/fixture": {"get": {"operationId": "readFixture", "x-owner": "platform",
                "responses": {"200": {"$ref": "#/components/responses/FixtureResponse"}}}}},
            "components": {"responses": {"FixtureResponse": {"content": {"application/json": {
                "schema": {"$ref": "#/components/schemas/FixtureNode"}}}}},
                "schemas": {"FixtureNode": {"type": "object", "description": "TRANSITIVE_CONTEXT_MARKER",
                    "properties": {"child": {"$ref": "#/components/schemas/FixtureNode"}}}}}}))
        result, sources = tool._contract_slices(repo, repo.specs["TEST-01"])
        self.assertIn("TRANSITIVE_CONTEXT_MARKER", result)
        self.assertEqual(result.count("TRANSITIVE_CONTEXT_MARKER"), 1)
        self.assertIn("contracts/openapi.yaml", sources)

    def test_model_anchor_is_included_without_the_following_section(self):
        repo = self.repo({"models": ["fixture#chosen"]})
        self.write("docs/models/fixture.md",
                   '# Model\n\n## Chosen <a id="chosen"></a>\nMODEL_CONTEXT_MARKER\n'
                   '\n## Other <a id="other"></a>\nDO_NOT_INCLUDE_MARKER\n')
        result, meta = tool.build_pack(repo, "TEST-01")
        self.assertIn("MODEL_CONTEXT_MARKER", result)
        self.assertNotIn("DO_NOT_INCLUDE_MARKER", result)
        self.assertIn("docs/models/fixture.md", meta["sources"])

    def test_companion_contract_is_required_and_in_the_source_manifest(self):
        repo = self.repo()
        self.write("docs/fixture-contract.md", "# Companion\nCONTEXT_SOURCE_MARKER\n")
        self.config["pack"] = {"context_sources": {"TEST-01": ["docs/fixture-contract.md"]}}
        result, meta = tool.build_pack(repo, "TEST-01")
        self.assertTrue("docs/fixture-contract.md" in result, "missing required companion link")
        self.assertIn("docs/fixture-contract.md", meta["sources"])
        self.assertIn("docs/fixture-contract.md", meta["required_sources"])

    def test_missing_companion_contract_prevents_pack_generation(self):
        repo = self.repo()
        self.config["pack"] = {"context_sources": {"TEST-01": ["docs/missing.md"]}}
        with self.assertRaises(ValueError):
            tool.build_pack(repo, "TEST-01")

    def test_explicit_paths_determine_ui_rules_and_omit_server_domain(self):
        repo = self.repo()
        self.config["pack"] = {"feature_paths": {"TEST-01": ["packages/ui/**", "apps/learner/**", "tests/**"]}}
        self.write("packages/ui/AGENTS.md", "# UI\n\n## UI rules\nUI_CONTEXT_MARKER\n")
        self.assertEqual(repo.feature_paths("TEST-01"), ["packages/ui/**", "apps/learner/**", "tests/**"])
        result, meta = tool.build_pack(repo, "TEST-01")
        self.assertIn("UI_CONTEXT_MARKER", result)
        self.assertIn("packages/ui/AGENTS.md", meta["sources"])
        self.assertNotIn("packages/domains/platform/**", result)

    def test_learner_shell_pack_includes_all_route_registration_sources(self):
        with patch.object(tool, "ROOT", PROJECT):
            with patch.object(tool, "CFG", tool.load_config()):
                repo = tool.Repo()
                result, meta = tool.build_pack(repo, "PLAT-01")
                for pid in ("S06", "S09", "S17", "S28", "S34"):
                    with self.subTest(page=pid):
                        self.assertTrue(f"### {pid} " in result, f"pack missing {pid} metadata")
                        self.assertIn(f"design/screens/learner/{pid}.yaml", meta["sources"])
                self.assertTrue("views:" in result, "pack missing view registration")
                self.assertTrue("when: 危机信号" in result, "pack missing S28 view context")
                self.assertFalse("S06-01" in result, "layout reference includes business items")
                self.assertLessEqual(meta["chars"], tool.CFG["budgets"]["pack_chars"])

    def test_isolated_root_generation_does_not_write_to_source_checkout(self):
        self.write("contracts/params.yaml", "[]\n")
        before = (PROJECT / "packages/params/index.ts").read_bytes()
        result = subprocess.run([sys.executable, str(PROJECT / "scripts/spec_tool.py"),
                                 "--root", str(self.root), "gen"], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", "replace"))
        self.assertTrue((self.root / "packages/params/index.ts").exists())
        self.assertEqual((PROJECT / "packages/params/index.ts").read_bytes(), before)

    def test_isolated_artifacts_are_relative_to_the_temporary_root(self):
        self.write("contracts/params.yaml", "[]\n")
        result = subprocess.run([sys.executable, str(PROJECT / "scripts/spec_tool.py"),
                                 "--root", str(self.root), "gen", "--artifacts", "isolated-report"],
                                capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", "replace"))
        self.assertTrue((self.root / "isolated-report/coverage.md").exists())
        self.assertFalse((PROJECT / "isolated-report").exists())

    def test_isolated_artifacts_reject_relative_and_absolute_escape(self):
        self.write("fixture/contracts/params.yaml", "[]\n")
        for destination in ("../escaped", str(self.root / "escaped")):
            with self.subTest(destination=destination):
                result = subprocess.run([sys.executable, str(PROJECT / "scripts/spec_tool.py"),
                    "--root", str(self.root / "fixture"), "gen", "--artifacts", destination],
                    capture_output=True)
                self.assertEqual(result.returncode, 2)
                self.assertFalse((self.root / "escaped").exists())
                self.assertFalse((self.root / "fixture/packages/params/index.ts").exists())


if __name__ == "__main__":
    unittest.main()
