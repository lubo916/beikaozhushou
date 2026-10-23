import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { S01WelcomeData } from "@exam-prep/contract";
import { formatNumber } from "@exam-prep/shared/format";
import { Banner, Button, Icon } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { DataUse, FreeTools, WelcomeExtras, type WelcomeDialog } from "../components/WelcomeExtras.tsx";

export function FirstView({ data, onLogin, offline = false }: { data: S01WelcomeData; onLogin: () => void; offline?: boolean }) {
  const { t } = useTranslation("S01");
  const navigate = useNavigate();
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const birthField = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<WelcomeDialog>(null);
  const selected = data.age_options.find((option) => option.id === age);
  const blocked = selected?.eligibility === "blocked";
  const steps = t("welcome.steps", { returnObjects: true }) as string[];
  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="text-small font-medium text-brand-primary">
          <span>{t("pageName")}</span>
          <span aria-hidden="true"> · </span>
          {t("welcome.eyebrow")}
        </p>
        <h1 className="font-serif text-title font-bold text-brand-primary-ink">{t("welcome.title")}</h1>
        <p className="text-small text-ink-secondary">{t("welcome.body")}</p>
      </header>
      <ol aria-label={t("welcome.stepsLabel")} className="hidden flex-wrap gap-x-3 gap-y-2 text-small text-ink-tertiary @tablet:flex">
        {steps.map((step, index) => (
          <li key={step} aria-current={index === 0 ? "step" : undefined} className={index === 0 ? "font-bold text-brand-primary" : ""}>
            <span aria-hidden="true">{formatNumber(index + 1, 0)} · </span>
            {step}
          </li>
        ))}
      </ol>
      {/* feat:S01-02 首屏年龄段无默认值；未确认按未成年人处理，最低年龄以下不能继续。 */}
      <fieldset aria-describedby="s01-age-hint" className="flex flex-col gap-3">
        <legend className="mb-2 font-bold">{t("age.title")}</legend>
        <p id="s01-age-hint" className="text-small text-ink-tertiary">
          {t("age.hint")}
        </p>
        <div className="grid gap-2">
          {data.age_options.map((option) => (
            <label
              key={option.id}
              className="s01-age-option flex cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-bg-surface px-4 py-3"
            >
              <input
                type="radio"
                name="age_band"
                value={option.id}
                checked={age === option.id}
                onChange={() => {
                  setAge(option.id);
                  setError("");
                  setBirthMonth("");
                }}
                className="mt-1 shrink-0"
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{t(option.label_key)}</span>
                <span className="hidden text-small text-ink-tertiary @tablet:block">{t(option.description_key)}</span>
              </span>
              {age === option.id && (
                <span className="ml-auto text-brand-primary">
                  <Icon name="check" />
                </span>
              )}
            </label>
          ))}
        </div>
        {/* feat:S01-02 R08-Q1：未成年人同时填出生年月；年龄计算留给账号领域。 */}
        {selected?.eligibility === "minor" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="s01-birth-month" className="font-medium">
              {t("age.birthMonth")}
            </label>
            <input
              id="s01-birth-month"
              ref={birthField}
              type="month"
              className="s01-field"
              value={birthMonth}
              max={data.today.slice(0, 7)}
              required
              onChange={(event) => {
                setBirthMonth(event.target.value);
                setError("");
              }}
              aria-describedby="s01-birth-hint"
            />
            <p id="s01-birth-hint" className="text-small text-ink-secondary">
              {t("age.birthMonthHint")}
            </p>
          </div>
        )}
        {blocked ? (
          <Banner tone="warning">{t("age.blocked")}</Banner>
        ) : (
          <p className="text-small text-ink-secondary">{t(data.minor_notice_key)}</p>
        )}
        {error && (
          <p role="alert" className="text-small text-status-danger">
            {error}
          </p>
        )}
      </fieldset>
      <div className="flex flex-col gap-3">
        {/* feat:S01-01 游客先体验，保存时才登录；年龄段通过路由状态交给下一步。 */}
        <Button
          variant="primary"
          block
          disabled={blocked || offline}
          onClick={() => {
            if (!selected) {
              setError(t("age.required"));
              return;
            }
            if (selected.eligibility === "minor" && (!birthMonth || birthField.current?.validity.valid === false)) {
              setError(t("age.birthMonthRequired"));
              birthField.current?.focus();
              return;
            }
            void navigate(pathTo("S02"), {
              state: {
                age_band: selected.id,
                minor_mode: selected.eligibility !== "allowed",
                guest: true,
                ...(selected.eligibility === "minor" ? { birth_month: birthMonth } : {}),
              },
            });
          }}
        >
          {t("welcome.guest")}
        </Button>
        {/* feat:S01-07、feat:S01-12 登录单独成屏，不放进欢迎首屏。 */}
        <Button block disabled={blocked || offline} onClick={onLogin}>
          {t("welcome.login")}
        </Button>
        <p className="text-center text-small text-ink-tertiary">{t("welcome.guestHint")}</p>
        <Button variant="ghost" disabled={blocked || offline} onClick={() => setDialog("invite")}>
          {t("welcome.invite")}
        </Button>
      </div>
      <DataUse />
      <div className="text-center">
        <Button variant="ghost" onClick={() => setDialog("guide")}>
          {t("guide.open")}
        </Button>
      </div>
      <FreeTools />
      <WelcomeExtras data={data} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
