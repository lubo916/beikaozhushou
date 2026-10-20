import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { click, mount, type Mounted } from "../testing.tsx";
import { Button } from "./Button.tsx";
import { BottomSheet, Dialog, Drawer } from "./Overlay.tsx";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("对话框、抽屉与底部面板", () => {
  it("对话框：按 open 打开关闭，标题与说明关联，Esc（cancel）交给 onClose", async () => {
    const onClose = vi.fn();
    view = await mount(<Dialog open={false} onClose={onClose} title="确认调整" description="会挪动 2 项任务" actions={<Button>确认</Button>} />);
    const dialog = view.host.querySelector("dialog");
    expect(dialog?.open).toBe(false);
    await view.rerender(<Dialog open onClose={onClose} title="确认调整" description="会挪动 2 项任务" actions={<Button>确认</Button>} />);
    expect(dialog?.open).toBe(true);
    expect(document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")?.textContent).toBe("确认调整");
    expect(document.getElementById(dialog?.getAttribute("aria-describedby") ?? "")?.textContent).toBe("会挪动 2 项任务");
    await act(async () => {
      dialog?.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog?.open).toBe(true);
    await click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    await view.rerender(<Dialog open={false} onClose={onClose} title="确认调整" />);
    expect(dialog?.open).toBe(false);
  });

  it("确认框（alertdialog）：点遮罩不关闭，只能点按钮", async () => {
    const onClose = vi.fn();
    view = await mount(<Dialog open role="alertdialog" onClose={onClose} title="删除这张卡片？" />);
    const dialog = view.host.querySelector("dialog");
    expect(dialog?.getAttribute("role")).toBe("alertdialog");
    await click(dialog);
    expect(onClose).toHaveBeenCalledTimes(0);
    await click(dialog?.querySelector(".ui-iconbtn"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("抽屉在右（或左），底部面板在下，都是模态", async () => {
    view = await mount(
      <>
        <Drawer open onClose={() => undefined} title="分组导航" side="left">
          导航
        </Drawer>
        <BottomSheet open onClose={() => undefined} title="问导师">
          面板
        </BottomSheet>
      </>,
    );
    const [drawer, sheet] = [...view.host.querySelectorAll("dialog")];
    expect(drawer?.className).toContain("ui-sheet--left");
    expect(sheet?.className).toContain("ui-sheet--bottom");
    expect(sheet?.querySelector(".ui-sheet__grip")).not.toBeNull();
    expect(drawer?.matches(":modal")).toBe(true);
  });
});
