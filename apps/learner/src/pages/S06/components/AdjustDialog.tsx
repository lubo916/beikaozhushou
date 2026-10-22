// 手动勾选或剔除：feat:S06-07 手动勾选只记“看过”；feat:S06-21 今天不想学这个（只对当天有效，记下原因用于改进推荐）。
// 原型把这两个放在每条任务的勾选圈与“⋯”菜单里，公共任务条还没有（U06a-Q2＝A）；先集中放在这里。两个都是写操作，接后端前提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { S06TodayHome } from "@exam-prep/contract";
import { Button, Dialog, List } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export interface AdjustDialogProps {
  readonly open: boolean;
  readonly data: S06TodayHome;
  readonly onClose: () => void;
}

export function AdjustDialog({ open, data, onClose }: AdjustDialogProps) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  const items = data.segments.flatMap((group) => group.items).filter((item) => item.task.status !== "done" && item.task.status !== "seen");
  const act = (message: string): void => {
    onClose();
    toast(message);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("adjust.title")}
      description={t("adjust.description")}
      actions={<Button onClick={onClose}>{t("adjust.close")}</Button>}
    >
      {items.length === 0 ? (
        <p>{t("adjust.none")}</p>
      ) : (
        <List>
          {items.map((item) => (
            <li key={item.task.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-[0] flex-1">{item.task.title}</span>
              <Button size="sm" onClick={() => act(t("soon.seen"))}>
                {t("adjust.seen")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(t("soon.skip"))}>
                {t("adjust.skip")}
              </Button>
            </li>
          ))}
        </List>
      )}
    </Dialog>
  );
}
