// 掌握阶梯卡：系统判定、我的自评与目标档并列，下面是自评与系统判定的差、检验与改目标档。
import { useTranslation } from "react-i18next";
import type { S10Ladder } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { MASTERY_RANKS, type MasteryRank } from "@exam-prep/shared/vocab";
import { Button, Card, MasteryLadder } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

/** 接口给的档位序号转成掌握档类型（契约限定 0–5，越界的按最低档显示）。 */
export function toRank(value: number): MasteryRank {
  return MASTERY_RANKS.find((rank) => rank === value) ?? 0;
}

export function LadderCard({ ladder }: { ladder: S10Ladder }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const diff = ladder.self_vs_system;
  let selfText: string | undefined;
  if (diff !== undefined) {
    if (diff > 0) selfText = t("ladder.self_higher", { n: diff });
    else if (diff < 0) selfText = t("ladder.self_lower", { n: -diff });
    else selfText = t("ladder.self_same");
  }
  return (
    <Card title={t("ladder.title")} meta={t("ladder.meta")}>
      {/* feat:S10-01 档位阶梯：同时标出系统判定、我的自评与目标档，显示差几档（档位差由接口给）；可改个人目标档 */}
      <MasteryLadder
        system={toRank(ladder.system)}
        target={toRank(ladder.target)}
        gap={ladder.gap}
        self={ladder.self === undefined ? undefined : toRank(ladder.self)}
        selfPending={ladder.self_pending}
        evidenceSufficient={ladder.evidence_sufficient}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selfText !== undefined && <p className="min-w-[0] flex-1 text-small text-ink-secondary">{selfText}</p>}
        {/* feat:S10-08 自评与检验：自评“已掌握”后随即出检验题（题数是参数 learner.self_check.items），通过才生效 */}
        {ladder.self_pending ? (
          <Button variant="primary" size="sm" onClick={() => toast(t("soon.verify"))}>
            {t("ladder.verify", { items: param("learner.self_check.items") })}
          </Button>
        ) : (
          <Button size="sm" onClick={() => toast(t("soon.self_assess"))}>
            {t("ladder.self_assess")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => toast(t("soon.target"))}>
          {t("ladder.change_target")}
        </Button>
      </div>
      {ladder.target_is_default && <p className="mt-2 text-small text-ink-tertiary">{t("ladder.target_default")}</p>}
    </Card>
  );
}
