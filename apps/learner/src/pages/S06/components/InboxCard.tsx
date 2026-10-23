// 学习收件箱（feat:S06-22 快速捕获，P1）：拍题、语音、粘贴、存链接先进学习收件箱；今日页提示还有几条待归档、预计多久（接口给）。
// 收件箱还没有页面与路由，“去归档”接后端前提示“即将上线”（顶栏的“＋”快速捕获也是，见外壳）。
import { useTranslation } from "react-i18next";
import type { S06Inbox } from "@exam-prep/contract";
import { formatCount, formatDuration } from "@exam-prep/shared/format";
import { Button } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function InboxCard({ inbox }: { inbox: S06Inbox }) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  return (
    <section aria-label={t("inbox.label")} className="flex items-start gap-3 rounded-md bg-bg-sunk p-4">
      <div className="min-w-[0] flex-1">
        <p className="font-bold">{t("inbox.title", { n: formatCount(inbox.pending) })}</p>
        <p className="text-small text-ink-secondary">{t("inbox.body", { duration: formatDuration(inbox.minutes) })}</p>
      </div>
      <Button size="sm" onClick={() => toast(t("soon.inbox"))}>
        {t("inbox.action")}
      </Button>
    </section>
  );
}
