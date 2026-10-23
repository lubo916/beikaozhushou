// 主观题对照得分点自评（feat:S04-11，P1）：先作答，或至少想一会儿（秒数由接口给，参数 learner.diagnosis.subjective_min_seconds），
// 才出现得分点清单，防止不想就全勾；勾上的项只进起点估计，不写证据（规则卡 R11）。
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const MS_PER_SECOND = 1000;

export interface SelfCheckProps {
  readonly points: readonly string[];
  readonly waitSeconds: number;
  readonly answered: boolean;
  readonly value: readonly number[];
  readonly onChange: (value: readonly number[]) => void;
}

export function SelfCheck({ points, waitSeconds, answered, value, onChange }: SelfCheckProps) {
  const { t } = useTranslation("S04");
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), waitSeconds * MS_PER_SECOND);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);
  const toggle = (index: number) =>
    onChange(value.includes(index) ? value.filter((item) => item !== index) : [...value, index].sort((a, b) => a - b));
  return (
    <section aria-label={t("self_check.title")} className="flex flex-col gap-2 rounded-md bg-bg-sunk px-4 py-3">
      <p className="text-small font-bold text-ink-primary">{t("self_check.title")}</p>
      {answered || waited ? (
        <>
          <p className="text-small text-ink-secondary">{t("self_check.hint")}</p>
          <ul className="flex flex-col gap-2">
            {points.map((point, index) => (
              <li key={`${index}-${point}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={value.includes(index)} onChange={() => toggle(index)} />
                  <span>{point}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-small text-ink-secondary">{t("self_check.wait", { seconds: waitSeconds })}</p>
      )}
    </section>
  );
}
