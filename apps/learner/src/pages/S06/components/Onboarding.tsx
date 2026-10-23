// 上手清单（feat:S06-20，P1）：定目标、接资料、摸底、看懂今日清单、在阅读器里标注一次、问一次导师，逐项打勾（vocabulary 第 4 节）。
// bk spec 布局：放在英雄区最上面；再完成几项就自动收起（还差几项由接口给，收起项数的参数待登记，errata 第 11 条）；可跳过，可在设置里重开。
// 还没做的项直达对应页面（路由表）；“看懂今日清单”就在本页，不跳转。“跳过”是写操作，接后端前提示“即将上线”。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06Onboarding, S06OnboardingStep } from "@exam-prep/contract";
import { Button } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo, type LearnerPageId } from "../../../routes.ts";

/** 每一项去哪里做。 */
const STEP_PAGE: Readonly<Partial<Record<S06OnboardingStep, LearnerPageId>>> = {
  goal: "S02",
  materials: "S03",
  diagnosis: "S04",
  annotate: "S12",
  ask_tutor: "S28",
};

/** 深色底上的次要按钮：浅色描边与文字（只用令牌，与英雄区一致）。 */
const ON_DARK = "border border-brand-primary-soft bg-transparent text-bg-surface";

export function Onboarding({ onboarding }: { onboarding: S06Onboarding }) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  return (
    <div role="group" aria-label={t("onboarding.label")} className="mb-4 rounded-sm border border-brand-primary-soft p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-bold">{t("onboarding.title")}</p>
        <p className="text-small text-brand-primary-soft">{t("onboarding.collapse", { n: onboarding.collapse_in })}</p>
        <Button size="sm" className={`ml-auto ${ON_DARK}`} onClick={() => toast(t("soon.onboarding_skip"))}>
          {t("onboarding.skip")}
        </Button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
        {onboarding.items.map(({ step, done }) => {
          const label = t(`onboarding.step.${step}`);
          const page = STEP_PAGE[step];
          if (done) {
            return (
              <li key={step} className="text-brand-primary-soft line-through">
                <span className="sr-only">{t("onboarding.done")}</span>
                {label}
              </li>
            );
          }
          return (
            <li key={step}>
              {page === undefined ? (
                label
              ) : (
                <Link to={pathTo(page)} className="text-bg-surface underline">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
