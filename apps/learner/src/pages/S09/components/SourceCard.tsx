// 地图来源与体检（feat:S09-05 三种来源与扩展层、S09-07 类型标注、S09-13 地图体检、S09-14 版本与迁移）。
// 来源四行与类型标注率、体检结果都由接口给；体检分阻断项与提示项，逐项给修复建议，有阻断项即不通过。
import { useTranslation } from "react-i18next";
import type { S09Health, S09MapInfo, S09SourceRow, S09Typing } from "@exam-prep/contract";
import { EMPTY_VALUE, formatCount, formatPercent } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button, Card, KeyValueList, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

/** “去修复”要带到的位置（方格里的锁定提示用）。 */
export const HEALTH_ID = "s09-health";

export interface SourceCardProps {
  readonly map: S09MapInfo;
  readonly sources: readonly S09SourceRow[];
  readonly typing: S09Typing;
  readonly health: S09Health;
  readonly className?: string;
}

export function SourceCard({ map, sources, typing, health, className }: SourceCardProps) {
  const { t } = useTranslation("S09");
  const toast = useToast();
  const valueOf = (row: S09SourceRow): string => {
    if (row.count === undefined) return EMPTY_VALUE;
    const n = formatCount(row.count);
    if (row.kind === "org" && row.org_name !== undefined) return t("source.org_count", { n, name: row.org_name });
    if (row.kind === "mine") return row.mine_custom === true ? t("source.mine_custom", { n }) : t("source.mine_extension", { n });
    return t("source.count", { n });
  };
  const types = typing.main_types.map((type) => VOCAB.knowledge_type[type]).join(t("joiner"));
  return (
    <Card title={t("source.title")} className={className}>
      <KeyValueList items={sources.map((row) => ({ key: row.kind, label: t(`source.${row.kind}`), value: valueOf(row) }))} />
      <div className="s09-stack s09-stack--tight s09-gap-top">
        {types !== "" && <p className="s09-note">{t("source.typing", { ratio: formatPercent(typing.ratio), types })}</p>}
        <p className="s09-note s09-note--muted">{t("source.readonly")}</p>
        <p className="s09-note s09-note--muted">{t("source.version", { version: formatCount(map.version) })}</p>
      </div>
      <div id={HEALTH_ID} tabIndex={-1} className="s09-health">
        <p className="s09-actions">
          {health.passed ? (
            <>
              <Tag tone="success" size="sm">
                {t("source.health_passed")}
              </Tag>
              {health.default_pass && <span className="s09-note">{t("source.health_default")}</span>}
            </>
          ) : (
            <>
              <Tag tone="danger" size="sm">
                {t("source.health_failed")}
              </Tag>
              <span className="s09-note">{t("source.health_failed_hint")}</span>
            </>
          )}
        </p>
        {health.issues.length > 0 && (
          <ul className="s09-list">
            {health.issues.map((issue) => (
              <li key={issue.kind} className="s09-list__row s09-list__row--start">
                <Tag tone={issue.severity === "blocking" ? "danger" : "neutral"} size="sm">
                  {t(`source.severity.${issue.severity}`)}
                </Tag>
                <span className="s09-note">
                  {t("source.issue_line", {
                    issue: t(`source.issue.${issue.kind}`),
                    count: t("source.issue_count", { n: formatCount(issue.count) }),
                    fix: t(`source.fix.${issue.kind}`),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!health.passed && (
          <div>
            <Button size="sm" onClick={() => toast(t("soon.fix"))}>
              {t("source.fix_action")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
