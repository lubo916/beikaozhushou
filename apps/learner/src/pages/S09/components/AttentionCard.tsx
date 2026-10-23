// 需要你注意：证据不足、待验证、没有资料三个计数（接口给），各带一个能做的动作。补充诊断去摸底诊断，挂资料去我的资料；
// 复核待验证的作答还没有后端，提示“即将上线”。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S09Attention } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { Button, Card, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const ROWS = ["insufficient", "pending", "no_material"] as const;

export function AttentionCard({ attention, className }: { readonly attention: S09Attention; readonly className?: string }) {
  const { t } = useTranslation("S09");
  const toast = useToast();
  const counts: Readonly<Record<(typeof ROWS)[number], number>> = {
    insufficient: attention.evidence_insufficient,
    pending: attention.pending_verification,
    no_material: attention.no_material,
  };
  const actions: Readonly<Record<(typeof ROWS)[number], ReactNode>> = {
    insufficient: (
      <Link to={pathTo("S04")} className={buttonClass("secondary", "sm")}>
        {t("attention.insufficient_action")}
      </Link>
    ),
    pending: (
      <Button size="sm" onClick={() => toast(t("soon.recheck"))}>
        {t("attention.pending_action")}
      </Button>
    ),
    no_material: (
      <Link to={pathTo("S11")} className={buttonClass("secondary", "sm")}>
        {t("attention.no_material_action")}
      </Link>
    ),
  };
  const rows = ROWS.filter((row) => counts[row] > 0);
  return (
    <Card title={t("attention.title")} className={className}>
      {rows.length === 0 ? (
        <p className="s09-note">{t("attention.none")}</p>
      ) : (
        <ul className="s09-list">
          {rows.map((row) => (
            <li key={row} className="s09-list__row">
              <div>
                <p className="s09-list__title">{t(`attention.${row}`, { n: formatCount(counts[row]) })}</p>
                <p className="s09-list__hint">{t(`attention.${row}_hint`)}</p>
              </div>
              {actions[row]}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
