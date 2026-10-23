// 快速定位·按章自评（feat:S04-03）：每章选没学过、学过但不熟、基本会、很熟练；之后出少量核对题（几道由接口给）。
// 代价是区间更宽，这里明说（规则卡 R10）；每章都选了才能提交。
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S04RatingTask, S04SelfRating } from "@exam-prep/contract";
import { Button, Card, cx } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { useDiagnosisActions } from "../data.ts";

const LEVELS: readonly S04SelfRating[] = ["not_learned", "unfamiliar", "basic", "proficient"];

export interface RatingCardProps {
  readonly sessionId: string;
  readonly task: S04RatingTask;
}

export function RatingCard({ sessionId, task }: RatingCardProps) {
  const { t } = useTranslation("S04");
  const toast = useToast();
  const { rate } = useDiagnosisActions();
  const name = useId();
  const [ratings, setRatings] = useState<Readonly<Record<string, S04SelfRating>>>({});
  const missing = task.modules.some((row) => ratings[row.module_id] === undefined);
  const handIn = () => {
    if (missing || rate.isPending) return;
    const list = task.modules.flatMap((row) => {
      const rating = ratings[row.module_id];
      return rating === undefined ? [] : [{ module_id: row.module_id, rating }];
    });
    rate.mutate({ sessionId, data: { ratings: list } }, { onError: () => toast(t("action_failed")) });
  };
  return (
    <Card title={t("rating.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-secondary">{t("rating.body", { minutes: task.minutes, items: task.check_items })}</p>
        <p className="text-small text-ink-tertiary">{t("rating.cost")}</p>
        {task.modules.map((row) => (
          <fieldset key={row.module_id} className="flex flex-col">
            <legend className="mb-2 font-bold text-ink-primary">{row.name}</legend>
            <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-4">
              {LEVELS.map((level) => {
                const chosen = ratings[row.module_id] === level;
                return (
                  <label
                    key={level}
                    className={cx(
                      "flex min-h-12 cursor-pointer items-center rounded-md border px-3 py-2 text-small focus-within:ring-2 focus-within:ring-brand-primary",
                      chosen ? "border-brand-primary bg-brand-primary-soft" : "border-line-strong bg-bg-surface",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${name}-${row.module_id}`}
                      value={level}
                      className="sr-only"
                      checked={chosen}
                      onChange={() => setRatings((previous) => ({ ...previous, [row.module_id]: level }))}
                    />
                    {t(`rating.levels.${level}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" busy={rate.isPending} disabled={missing} onClick={handIn}>
            {t("rating.submit")}
          </Button>
          {missing && <p className="text-small text-ink-tertiary">{t("rating.blocker")}</p>}
        </div>
      </div>
    </Card>
  );
}
