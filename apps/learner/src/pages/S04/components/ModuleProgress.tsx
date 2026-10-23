// 分模块进度（feat:S04-08 分模块估计）：每个模块的状态（已估计、进行中、未开始、同类数据、无依据）与进度条，都是接口给的。
// 没测到的模块先用同类人群数据代替并在起点报告里标注；有这样的模块（或无依据）时，卡片里加一条数据不足提示（F08-Q1：只落在这张卡片里）。
// 桌面放右栏，平板排在题目下面（ModuleCard）；手机收进“模块进度”抽屉（ModuleDrawer）。
import { useTranslation } from "react-i18next";
import type { S04ModuleProgress, S04ModuleStatus } from "@exam-prep/contract";
import { BarList, Card, PageState, type BarItem } from "@exam-prep/ui";

const TONES: Readonly<Record<S04ModuleStatus, BarItem["tone"]>> = {
  estimated: "success",
  in_progress: "brand",
  not_started: undefined,
  prior: "warning",
  no_basis: undefined,
};

type Modules = readonly S04ModuleProgress[];

function ModuleBars({ modules }: { readonly modules: Modules }) {
  const { t } = useTranslation("S04");
  const items: BarItem[] = modules.map((row) => ({
    key: row.module_id,
    label: row.name,
    value: row.progress,
    valueText: t(`modules.status.${row.status}`),
    tone: TONES[row.status],
  }));
  return <BarList label={t("modules.title")} items={items} max={1} />;
}

/** 卡片底下的一句说明；有模块用同类数据代替或无依据时换成数据不足提示（规则卡 R15 ④⑤、R39）。 */
export function ModuleNote({ modules }: { readonly modules: Modules }) {
  const { t } = useTranslation("S04");
  const prior = modules.some((row) => row.status === "prior");
  const noBasis = modules.some((row) => row.status === "no_basis");
  if (!prior && !noBasis) return <p className="text-small text-ink-tertiary">{t("modules.note")}</p>;
  return (
    <PageState
      state="insufficient_data"
      compact
      title={prior ? t("state.insufficient.title") : t("state.insufficient.no_basis_title")}
      body={prior ? t("state.insufficient.body") : t("state.insufficient.no_basis")}
    />
  );
}

export function ModuleCard({ modules }: { readonly modules: Modules }) {
  const { t } = useTranslation("S04");
  return (
    <Card title={t("modules.title")}>
      <div className="flex flex-col gap-3">
        <ModuleBars modules={modules} />
        <ModuleNote modules={modules} />
      </div>
    </Card>
  );
}

export function ModuleDrawer({ modules }: { readonly modules: Modules }) {
  const { t } = useTranslation("S04");
  return (
    <details className="rounded-md border border-line-soft bg-bg-surface px-4 py-3 @tablet:hidden">
      <summary className="cursor-pointer font-bold text-ink-primary">{t("modules.drawer")}</summary>
      <div className="flex flex-col gap-3 py-3">
        <ModuleBars modules={modules} />
        <ModuleNote modules={modules} />
      </div>
    </details>
  );
}
