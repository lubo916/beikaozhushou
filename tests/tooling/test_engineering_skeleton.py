"""F02 工程骨架：命令名、版本写法、生成物不进 git、领域两层、安装脚本允许名单、锁文件与各包依赖一致、本地数据库与 CI。"""
import json
import re
import subprocess
import unittest

from _support import ROOT

SCRIPTS = ("dev", "dev:real", "gen", "lint", "typecheck", "test", "build", "test:db", "e2e:smoke", "gallery")
DOMAINS = ("learner", "plan", "map", "practice", "grading", "tutor", "exam", "content", "moderation", "org", "account",
           "billing", "aigov", "compliance", "metrics", "engagement", "support", "platform")
GENERATED = ("packages/params/registry.generated.ts", "packages/contract/src/generated/error-codes.ts",
             "packages/contract/src/generated/permissions.ts", "packages/contract/src/generated/api/endpoints.ts",
             "packages/domains/metrics/core/generated/events.ts", "packages/domains/metrics/core/generated/metrics.ts",
             "apps/learner/src/generated/pages.ts", "packages/db/src/generated/models.ts", "packages/db/generated/prisma/client.ts")


def read_json(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def lock_importers(text):
    """不依赖 YAML 库，按 pnpm 锁文件的固定缩进读出 importers：{目录: {包名: 依赖写法}}。"""
    body = text.split("\nimporters:\n", 1)[1].split("\npackages:\n", 1)[0]
    out, cur, name = {}, None, None
    for line in body.splitlines():
        m = re.match(r"^  (\S[^:]*):( \{\})?$", line)
        if m:
            cur = m.group(1)
            out[cur] = {}
            continue
        m = re.match(r"^      '?([^':]+)'?:$", line)
        if m:
            name = m.group(1)
            continue
        m = re.match(r"^        specifier: (.+)$", line)
        if m and cur is not None:
            out[cur][name] = m.group(1)
    return out


class SkeletonTest(unittest.TestCase):
    def test_root_scripts(self):
        """根 package.json 有 bk verify 用到的全部命令名；生成在检查与启动之前自动运行"""
        scripts = read_json("package.json")["scripts"]
        for name in SCRIPTS:
            self.assertIn(name, scripts)
        for name in ("dev", "dev:real", "lint", "typecheck", "test", "build", "test:db", "e2e:smoke"):
            self.assertTrue(scripts[name].startswith("pnpm run gen && "), name)

    def test_versions(self):
        """engines 按决定卡 D-2026-10-20-F02-r1 写 >=22.18；.nvmrc 为 24；packageManager 为 pnpm 11 的确切版本；.npmrc 不写镜像"""
        pkg = read_json("package.json")
        self.assertEqual(pkg["engines"]["node"], ">=22.18")
        self.assertRegex(pkg["packageManager"], r"^pnpm@11\.\d+\.\d+$")
        self.assertEqual((ROOT / ".nvmrc").read_text(encoding="utf-8").strip(), "24")
        npmrc = ROOT / ".npmrc"
        active = [] if not npmrc.exists() else [
            line for line in npmrc.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith(("#", ";"))]
        self.assertEqual([line for line in active if "registry" in line], [])

    def test_allow_builds(self):
        """pnpm 11 的安装脚本允许名单里有 esbuild 与 Prisma（沙箱与本地都要装得上依赖）"""
        block = (ROOT / "pnpm-workspace.yaml").read_text(encoding="utf-8").split("allowBuilds:", 1)[1]
        for line in ('"@prisma/engines": true', "esbuild: true", "prisma: true"):
            self.assertIn(line, block)

    def test_generated_not_tracked(self):
        """生成物由 pnpm gen 生成，不进 git：.gitignore 忽略，索引里也没有"""
        tracked = subprocess.run(["git", "ls-files", "--", *GENERATED], cwd=ROOT, capture_output=True, text=True, check=True)
        self.assertEqual(tracked.stdout.split(), [])
        ignored = subprocess.run(["git", "check-ignore", "--no-index", *GENERATED], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(sorted(ignored.stdout.split()), sorted(GENERATED))

    def test_domains_two_layers(self):
        """每个领域包都分 core 与 server 两层，公开入口只有这两个"""
        for d in DOMAINS:
            base = f"packages/domains/{d}"
            pkg = read_json(f"{base}/package.json")
            self.assertEqual(pkg["name"], f"@exam-prep/domain-{d}")
            self.assertEqual(pkg["exports"], {"./core": "./core/index.ts", "./server": "./server/index.ts"})
            self.assertTrue((ROOT / base / "core/index.ts").exists(), d)
            self.assertTrue((ROOT / base / "server/index.ts").exists(), d)
            self.assertFalse((ROOT / base / "src").exists(), f"{d} 还留着旧的 src/ 目录")

    def test_lockfile_matches_manifests(self):
        """锁文件的 importers 与每个工作区包的依赖写法一致（否则 pnpm install --frozen-lockfile 会失败）"""
        importers = lock_importers((ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8"))
        manifests = {".": read_json("package.json")}
        for pattern in ("apps/*/package.json", "packages/*/package.json", "packages/domains/*/package.json", "evals/package.json"):
            for p in ROOT.glob(pattern):
                manifests[p.parent.relative_to(ROOT).as_posix()] = json.loads(p.read_text(encoding="utf-8"))
        self.assertEqual(sorted(importers), sorted(manifests))
        for rel, pkg in manifests.items():
            want = {}
            for field in ("dependencies", "devDependencies", "optionalDependencies"):
                want.update(pkg.get(field) or {})
            self.assertEqual(importers[rel], want, rel)

    def test_local_db_and_ci(self):
        """本地 compose 起 PostgreSQL 17（自制镜像，带 pgvector）与 Redis 7；CI 在 push 时跑完整验证"""
        compose = (ROOT / "deploy/compose.dev.yml").read_text(encoding="utf-8")
        self.assertIn("FROM postgres:17", (ROOT / "deploy/postgres/Dockerfile").read_text(encoding="utf-8"))
        self.assertIn("build: ./postgres", compose)
        self.assertIn("image: redis:7", compose)
        ci = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
        for needle in ("push:", "python3 tools/bk.py verify --level full", "pgvector/pgvector:pg17", "redis:7", "playwright install"):
            self.assertIn(needle, ci)


if __name__ == "__main__":
    unittest.main()
