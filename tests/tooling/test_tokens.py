"""设计令牌生成（计划 C7，ADR-025 的“基础值 + 主题覆盖”两层）：修饰器、别名、重名、透明色与阴影、Tailwind 主题。"""
import json
import unittest

from _support import ROOT, spec_tool, temp_repo, write

BASE = {
    "color": {"ink": {"$type": "color", "$value": "#1A2130"}, "scrim": {"$type": "color", "$value": {"colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.4}},
              "alias": {"$type": "color", "$value": "{color.ink}"}},
    "size": {"breakpoint": {"tablet": {"$type": "dimension", "$value": {"value": 700, "unit": "px"}}}},
    "shadow": {"card": {"$type": "shadow", "$value": [{"color": "#1A213029", "offsetX": {"value": 0, "unit": "px"},
                                                         "offsetY": {"value": 2, "unit": "px"}, "blur": {"value": 8, "unit": "px"},
                                                         "spread": {"value": 0, "unit": "px"}},
                                                        {"color": "{color.scrim}", "offsetX": {"value": 0, "unit": "px"},
                                                         "offsetY": {"value": 0, "unit": "px"}, "blur": {"value": 1, "unit": "px"},
                                                         "spread": {"value": 0, "unit": "px"}, "inset": True}]}},
}


def resolver(modifiers):
    return {"version": "2025.10", "sets": [{"sources": [{"$ref": "tokens.json"}]}], "modifiers": modifiers}


class TokensTest(unittest.TestCase):
    def tokens_repo(self, base=None, modifiers=()):
        root = temp_repo(self)
        write(root, "design/tokens.json", json.dumps(base or BASE, ensure_ascii=False))
        write(root, "design/tokens.resolver.json", json.dumps(resolver(list(modifiers)), ensure_ascii=False))
        return spec_tool.Repo(root)

    def outputs(self, repo):
        out = spec_tool.gen_tokens_output(repo)
        return out[spec_tool.CFG["gen"]["tokens_out"]][0], out[spec_tool.CFG["gen"]["tokens_tailwind_out"]][0]

    def test_repo_tokens(self):
        """令牌：基础值在 :root，修饰器按 data-* 属性覆盖，依赖机构配置的 brand.org 构建时跳过"""
        css, theme = self.outputs(spec_tool.Repo(ROOT))
        self.assertIn(":root {\n  --color-bg-canvas: #EEF1F5;", css)
        self.assertIn(':root[data-vision="cvd"] {\n  --color-status-success: #1F6FB2;', css)
        self.assertIn(':root[data-text="large"] {', css)
        self.assertNotIn('data-brand="org"', css)
        self.assertIn("brand.org", css.splitlines()[1])
        self.assertIn("--font-family-sans: \"HarmonyOS Sans SC\"", css)
        self.assertIn("--font-size-small: 12.5px;", css)

    def test_tailwind_theme(self):
        """Tailwind 主题先清空默认主题，再把令牌变量映射为主题变量；容器断点写字面值"""
        _, theme = self.outputs(spec_tool.Repo(ROOT))
        self.assertIn("@theme {\n  --*: initial;", theme)
        self.assertIn("--container-tablet: 700px;", theme)
        self.assertIn("--color-bg-canvas: var(--color-bg-canvas);", theme)
        self.assertIn("--font-sans: var(--font-family-sans);", theme)
        self.assertIn("--text-body: var(--font-size-body);", theme)
        self.assertNotIn("--size-viewport-min", theme)

    def test_alpha_color_and_shadow(self):
        """令牌：支持带透明度的颜色与 shadow 类型，别名输出为 var() 引用"""
        css, _ = self.outputs(self.tokens_repo())
        self.assertIn("--color-scrim: color(srgb 0 0 0 / 0.4);", css)
        self.assertIn("--color-alias: var(--color-ink);", css)
        self.assertIn("--shadow-card: 0px 2px 8px 0px #1A213029, inset 0px 0px 1px 0px var(--color-scrim);", css)

    def test_new_modifier_needs_no_generator_change(self):
        """令牌：新增修饰器或上下文（如 data-scheme）不需要改生成器"""
        repo = self.tokens_repo(modifiers=[{"name": "scheme", "default": "light", "contexts": {
            "light": [], "dark": [{"color": {"ink": {"$type": "color", "$value": "#F5F7FA"}}}]}}])
        css, _ = self.outputs(repo)
        self.assertIn(':root[data-scheme="dark"] {\n  --color-ink: #F5F7FA;\n}', css)

    def test_unresolved_alias_fails(self):
        """令牌：未解析的别名即生成失败"""
        base = json.loads(json.dumps(BASE))
        base["color"]["alias"]["$value"] = "{color.missing}"
        with self.assertRaises(spec_tool.GenError) as cm:
            spec_tool.gen_tokens_output(self.tokens_repo(base))
        self.assertIn("{color.missing}", cm.exception.msg)

    def test_duplicate_name_fails(self):
        """令牌：两条路径生成同名变量即生成失败"""
        base = json.loads(json.dumps(BASE))
        base["color"]["ink-x"] = {"$type": "color", "$value": "#000000"}
        base["color"]["ink"] = {"x": {"$type": "color", "$value": "#111111"}}
        base["color"]["alias"]["$value"] = "{color.ink-x}"
        with self.assertRaises(spec_tool.GenError) as cm:
            spec_tool.gen_tokens_output(self.tokens_repo(base))
        self.assertIn("重名", cm.exception.msg)

    def test_modifier_unknown_token_fails(self):
        """令牌：修饰器覆盖基础令牌中不存在的令牌即生成失败"""
        repo = self.tokens_repo(modifiers=[{"name": "vision", "default": "default", "contexts": {
            "default": [], "cvd": [{"color": {"nope": {"$type": "color", "$value": "#000000"}}}]}}])
        with self.assertRaises(spec_tool.GenError):
            spec_tool.gen_tokens_output(repo)

    def test_alias_cycle_fails(self):
        """令牌：别名循环即生成失败"""
        base = {"color": {"a": {"$type": "color", "$value": "{color.b}"}, "b": {"$type": "color", "$value": "{color.a}"}}}
        with self.assertRaises(spec_tool.GenError) as cm:
            spec_tool.gen_tokens_output(self.tokens_repo(base))
        self.assertIn("循环", cm.exception.msg)

    def test_modifier_alias_cycle_fails(self):
        """令牌：修饰器中的自身引用或经基础别名形成的循环都报 E-GEN-03"""
        for value in ("{color.ink}", "{color.alias}"):
            with self.subTest(value=value):
                repo = self.tokens_repo(modifiers=[{"name": "scheme", "contexts": {
                    "dark": [{"color": {"ink": {"$value": value}}}]}}])
                found = spec_tool.check_gen(repo, None)
                self.assertEqual([f.code for f in found], ["E-GEN-03"])
                self.assertIn("循环", found[0].msg)

    def test_modifier_alias_passes(self):
        """令牌：修饰器可引用其他基础令牌，输出保留 var() 引用"""
        repo = self.tokens_repo(modifiers=[{"name": "scheme", "contexts": {
            "dark": [{"color": {"ink": {"$value": "{color.scrim}"}}}]}}])
        css, _ = self.outputs(repo)
        self.assertIn(':root[data-scheme="dark"] {\n  --color-ink: var(--color-scrim);\n}', css)

    def test_check_reports_gen_error(self):
        """令牌来源有误时 gen --check 报 E-GEN-03，不写出产物"""
        base = json.loads(json.dumps(BASE))
        base["color"]["alias"]["$value"] = "{color.missing}"
        found = spec_tool.check_gen(self.tokens_repo(base), None)
        self.assertEqual([f.code for f in found], ["E-GEN-03"])


if __name__ == "__main__":
    unittest.main()
