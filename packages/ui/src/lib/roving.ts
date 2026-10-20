function isDisabled(item: unknown): boolean {
  return typeof item === "object" && item !== null && "disabled" in item && item.disabled === true;
}

/** 方向键在一组选项里移动（单选组、标签页、方格共用）：返回下一个可用选项的序号；不是移动键时返回 null。 */
export function nextIndex(items: readonly unknown[], from: number, key: string): number | null {
  const enabled = items.flatMap((item, index) => (isDisabled(item) ? [] : [index]));
  if (enabled.length === 0) return null;
  const at = enabled.indexOf(from);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return enabled[(at + 1) % enabled.length] ?? null;
    case "ArrowLeft":
    case "ArrowUp":
      return enabled[(at - 1 + enabled.length) % enabled.length] ?? null;
    case "Home":
      return enabled[0] ?? null;
    case "End":
      return enabled[enabled.length - 1] ?? null;
    default:
      return null;
  }
}
