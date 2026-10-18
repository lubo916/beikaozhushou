"""Check the source palette against the declared text/control contrast standard."""
import copy
import itertools
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def overlay(base, change):
    for key, value in change.items():
        if isinstance(value, dict) and "$value" not in value:
            overlay(base.setdefault(key, {}), value)
        else:
            base[key] = copy.deepcopy(value)


def value_at(tokens, path, visited=()):
    if path in visited:
        raise AssertionError(f"Cyclic token alias {path}")
    node = tokens
    for key in path.split("."):
        node = node[key]
    value = node["$value"]
    if isinstance(value, str) and value.startswith("{"):
        return value_at(tokens, value[1:-1], (*visited, path))
    return value


def luminance(hex_color):
    channels = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in channels]
    return sum(x * weight for x, weight in zip(linear, (.2126, .7152, .0722)))


class TokenContrastTests(unittest.TestCase):
    def test_source_palette_in_every_compiled_theme(self):
        source = json.loads((ROOT / "design/tokens.json").read_text(encoding="utf-8"))
        resolver = json.loads((ROOT / "design/tokens.resolver.json").read_text(encoding="utf-8"))
        self.assertEqual([m["name"] for m in resolver["modifiers"]], ["scheme", "brand", "vision", "text"])
        for scheme, vision, text in itertools.product(("light", "dark"), ("default", "cvd"), ("default", "large")):
            with self.subTest(scheme=scheme, vision=vision, text=text):
                tokens = copy.deepcopy(source)
                context = {"scheme": scheme, "brand": "platform", "vision": vision, "text": text}
                for modifier in resolver["modifiers"]:
                    for change in modifier["contexts"][context[modifier["name"]]]:
                        overlay(tokens, change)
                pairs = [(f"color.ink.{ink}", f"color.bg.{bg}", 4.5)
                         for ink in ("primary", "secondary", "tertiary")
                         for bg in ("canvas", "surface", "sunk")]
                pairs += [(f"color.status.{name}", f"color.status.{name}-soft", 4.5)
                          for name in ("success", "danger", "warning", "ai")]
                pairs += [("color.ink.on-brand", "color.brand.primary", 4.5),
                          ("color.brand.primary", "color.bg.surface", 3),
                          ("color.line.strong", "color.bg.surface", 3)]
                for fg, bg, minimum in pairs:
                    bright, dark = sorted((luminance(value_at(tokens, fg)), luminance(value_at(tokens, bg))), reverse=True)
                    self.assertGreaterEqual((bright + .05) / (dark + .05), minimum, f"{scheme}/{vision}: {fg} on {bg}")


if __name__ == "__main__":
    unittest.main()
