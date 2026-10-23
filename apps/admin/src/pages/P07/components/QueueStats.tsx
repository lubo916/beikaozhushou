import { useTranslation } from "react-i18next";
import type { P07QueueSummary } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { Card, Stat } from "@exam-prep/ui";

/** 待办数：只显示接口给的计数（一次通过率、积压最久、审核员差错率属 P07-06 看板，随后端补）。 */
export function QueueStats({ queue }: { queue: P07QueueSummary }) {
  const { t } = useTranslation("P07");
  return (
    <section aria-label={t("queue.section")} className="grid grid-cols-2 gap-4">
      {/* feat:P07-01 待解析：教材与讲义还没做完版面分析、切片或挂载的页数 */}
      <Card>
        <Stat label={t("queue.parse")} value={formatCount(queue.parse_pending)} hint={t("queue.parseHint")} />
      </Card>
      {/* feat:P07-03 待审核：等人核对的 AI 草稿条数 */}
      <Card>
        <Stat label={t("queue.review")} value={formatCount(queue.review_pending)} hint={t("queue.reviewHint")} />
      </Card>
    </section>
  );
}
