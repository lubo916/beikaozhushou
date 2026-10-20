// 手机的分组抽屉：顶栏左侧按钮打开，列出全部分组的页面；内容只在打开时渲染。
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "@exam-prep/ui";
import { NAV_GROUPS } from "../router/pages.ts";
import { Badge, GroupLinks } from "./parts.tsx";

export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const baseId = useId();
  return (
    <Sheet open={open} onClose={onClose} side="left" title={t("shell.drawer.title")}>
      {open && (
        <div className="flex flex-col gap-4">
          {NAV_GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-1">
              <p id={`${baseId}-${group}`} className="flex items-center gap-2 px-3 text-small font-bold text-ink-secondary">
                <Badge text={t(`groupBadge.${group}`)} />
                {t(`group.${group}`)}
              </p>
              <GroupLinks group={group} labelledBy={`${baseId}-${group}`} onNavigate={onClose} />
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
