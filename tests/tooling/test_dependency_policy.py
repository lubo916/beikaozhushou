"""依赖登记检查（版本锁与禁用库，含 ADR-025 决定 1 的版本陷阱）的反例；反例只在临时目录中构造，不进仓库。"""
import json
import unittest

from _support import ROOT, load_engineering, temp_repo, write

deps = load_engineering("check_dependencies")


def workspace(test, app_deps=None, root_extra=None, files=()):
    root = temp_repo(test)
    write(root, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\nminimumReleaseAge: 10080\n')
    write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
    pkg = {"name": "exam-prep", "private": True, "packageManager": "pnpm@11.0.0", "engines": {"node": ">=24 <25"},
           "devDependencies": {"typescript": "6.0.3"}}
    pkg.update(root_extra or {})
    write(root, "package.json", json.dumps(pkg))
    write(root, "packages/params/package.json", json.dumps({"name": "@exam-prep/params"}))
    write(root, "apps/learner/package.json", json.dumps({"name": "@exam-prep/learner",
                                                         "dependencies": {"react": "19.2.5", "@exam-prep/params": "workspace:*", **(app_deps or {})}}))
    for rel in files:
        write(root, rel, "{}\n")
    return root


class DependencyPolicyTest(unittest.TestCase):
    def problems(self, root):
        return deps.check(root)

    def test_clean_workspace(self):
        """合规的工作区通过依赖登记检查"""
        self.assertEqual(self.problems(workspace(self)), [])

    def test_repo_workspace(self):
        """仓库当前的工作区通过依赖登记检查（锁文件由 pnpm install 生成后才算完整）"""
        found = [p for p in deps.check(ROOT) if not p.startswith("pnpm-lock.yaml")]
        self.assertEqual(found, [])

    def test_range_rejected(self):
        """版本锁：^ 范围写法被拦下"""
        found = self.problems(workspace(self, {"zod": "^4.1.0"}))
        self.assertTrue(any("zod" in p and "精确版本" in p for p in found), found)

    def test_typescript_7_rejected(self):
        """版本陷阱：TypeScript 7 被拦下"""
        found = self.problems(workspace(self, root_extra={"devDependencies": {"typescript": "7.0.0"}}))
        self.assertTrue(any("typescript" in p and "大版本" in p for p in found), found)

    def test_prisma_8_rc_rejected(self):
        """版本陷阱：Prisma 8 的候选版被拦下"""
        found = self.problems(workspace(self, {"prisma": "8.0.0-rc.1"}))
        self.assertTrue(any("prisma" in p for p in found), found)
        found = self.problems(workspace(self, {"prisma": "8.0.0"}))
        self.assertTrue(any("prisma" in p and "大版本" in p for p in found), found)

    def test_banned_library_rejected(self):
        """禁用库：axios、moment、framer-motion 与 jsdom 被拦下"""
        found = self.problems(workspace(self, {"axios": "1.7.0", "moment": "2.30.1", "framer-motion": "12.0.0", "jsdom": "26.0.0"}))
        for name in ("axios", "moment", "framer-motion", "jsdom"):
            self.assertTrue(any(name in p and "禁用库" in p for p in found), name)

    def test_unregistered_rejected(self):
        """未登记的依赖被拦下"""
        found = self.problems(workspace(self, {"left-pad": "1.3.0"}))
        self.assertTrue(any("left-pad" in p and "未登记" in p for p in found), found)

    def test_config_traps_rejected(self):
        """配置陷阱：.eslintrc、tailwind.config、npm 锁文件与 package.json 的 pnpm 字段被拦下"""
        found = self.problems(workspace(self, root_extra={"pnpm": {"overrides": {}}},
                                        files=("apps/learner/.eslintrc.json", "apps/learner/tailwind.config.js", "package-lock.json")))
        for needle in (".eslintrc.json", "tailwind.config.js", "package-lock.json", "pnpm 字段"):
            self.assertTrue(any(needle in p for p in found), needle)

    def test_workspace_protocol(self):
        """工作区包之间必须写 workspace:*"""
        found = self.problems(workspace(self, {"@exam-prep/params": "0.0.0"}))
        self.assertTrue(any("workspace:*" in p for p in found), found)

    def test_package_manager_major(self):
        """根 package.json 的 packageManager 必须是登记的 pnpm 大版本，并有锁文件"""
        root = workspace(self, root_extra={"packageManager": "pnpm@10.12.1"})
        (root / "pnpm-lock.yaml").unlink()
        found = self.problems(root)
        self.assertTrue(any("packageManager" in p for p in found), found)
        self.assertTrue(any(p.startswith("pnpm-lock.yaml") for p in found), found)


if __name__ == "__main__":
    unittest.main()
