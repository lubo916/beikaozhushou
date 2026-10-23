import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S01WelcomeData } from "@exam-prep/contract";
import { formatNumber, formatSeconds } from "@exam-prep/shared/format";
import { Banner, Button, Card, Dialog, Tabs } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { DataUse } from "../components/WelcomeExtras.tsx";

export function LoginView({
  data,
  onBack,
  initialReset = false,
  offline = false,
}: {
  data: S01WelcomeData;
  onBack: () => void;
  initialReset?: boolean;
  offline?: boolean;
}) {
  const { t } = useTranslation("S01");
  const toast = useToast();
  const [method, setMethod] = useState<"sms" | "password">("sms");
  const [reset, setReset] = useState(initialReset);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const [policy, setPolicy] = useState<"terms" | "privacy" | null>(null);
  const codeLength = formatNumber(data.sms.code_length, 0);
  const phoneValid = () => /^\+?[\d\s-]+$/.test(phone.trim());
  const codeValid = () => /^\d+$/.test(code.trim()) && code.trim().length === data.sms.code_length;
  const setLoginMethod = (next: "sms" | "password") => {
    setMethod(next);
    setError("");
    setCode("");
    setPassword("");
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneValid()) {
      setError(t("login.invalidPhone"));
      return;
    }
    if ((reset || method === "sms") && !codeValid()) {
      setError(t("login.invalidCode", { length: codeLength }));
      return;
    }
    if ((reset || method === "password") && !password) {
      setError(t("login.requiredPassword"));
      return;
    }
    if (!reset && (!terms || !privacy)) {
      setError(t("login.consentRequired"));
      return;
    }
    setError("");
    // feat:S01-03、feat:S01-16 认证写动作尚未登记，不发送真实凭证，不伪造已登录。
    // feat:S01-18 重设密码失败文案不透露号码是否注册；其他设备下线由账号服务接入后执行。
    toast(t(reset ? "login.resetResult" : "soon"));
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="text-small font-medium text-brand-primary">{t("pageName")}</p>
        <h1 className="font-serif text-title font-bold text-brand-primary-ink">{t(reset ? "login.resetTitle" : "login.title")}</h1>
        <p className="text-ink-secondary">{t(reset ? "login.resetBody" : "login.body")}</p>
      </header>
      <p className="rounded-sm bg-status-warning-soft p-3 text-small text-status-warning">{t("login.demoHint")}</p>
      <Card>
        <div className="flex flex-col gap-4">
          {!reset && (
            <Tabs
              label={t("login.methodsLabel")}
              value={method}
              onChange={setLoginMethod}
              items={[
                { key: "sms", label: t("login.smsTab") },
                { key: "password", label: t("login.passwordTab") },
              ]}
            />
          )}
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-col gap-4"
            aria-label={t(reset ? "login.resetTitle" : "login.methodsLabel")}
          >
            <label className="flex flex-col gap-2 font-medium">
              {t("login.phone")}
              <input
                className="s01-field"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("login.phonePlaceholder")}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </label>
            {(reset || method === "sms") && (
              <>
                <div className="flex items-end gap-2">
                  <label className="flex min-w-[0] flex-1 flex-col gap-2 font-medium">
                    {t("login.code")}
                    <input
                      className="s01-field"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t("login.codePlaceholder")}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      maxLength={data.sms.code_length}
                      required
                    />
                  </label>
                  <Button
                    disabled={offline}
                    onClick={() => {
                      if (!phoneValid()) {
                        setError(t("login.invalidPhone"));
                        return;
                      }
                      setError("");
                      toast(t("soon"));
                    }}
                  >
                    {t("login.send")}
                  </Button>
                </div>
                <p className="text-small text-ink-tertiary">
                  {t("login.sendHint", { length: codeLength, seconds: formatSeconds(data.sms.resend_seconds) })}
                </p>
              </>
            )}
            {(reset || method === "password") && (
              <label className="flex flex-col gap-2 font-medium">
                {t(reset ? "login.newPassword" : "login.password")}
                <input
                  className="s01-field"
                  type="password"
                  autoComplete={reset ? "new-password" : "current-password"}
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            )}
            {/* feat:S01-04 协议和隐私分开确认，不预勾选。 */}
            {!reset && (
              <div className="flex flex-col gap-3">
                {(["terms", "privacy"] as const).map((kind) => (
                  <div key={kind} className="flex flex-wrap items-center gap-2 text-small">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kind === "terms" ? terms : privacy}
                        onChange={(event) => (kind === "terms" ? setTerms(event.target.checked) : setPrivacy(event.target.checked))}
                      />
                      {t("login.agreement")}
                      {t(`login.${kind}`)}
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => setPolicy(kind)}>
                      {t(`login.${kind}`)}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="text-small text-status-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" block disabled={offline}>
              {t(reset ? "login.resetSubmit" : method === "password" ? "login.passwordSubmit" : "login.submit")}
            </Button>
          </form>
          {!reset && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setReset(true);
                  setPassword("");
                  setCode("");
                  setError("");
                }}
              >
                {t("login.forgot")}
              </Button>
              <p className="text-center text-small text-ink-tertiary">{t("login.other")}</p>
              {/* feat:S01-14、feat:S01-15 授权不可用时回落手机验证码，不要求额外绑定手机号。 */}
              <div className="grid grid-cols-2 gap-2">
                {["wechat", "apple"].map((key) => (
                  <Button
                    key={key}
                    disabled={offline}
                    onClick={() => {
                      setLoginMethod("sms");
                      setFallback(true);
                    }}
                  >
                    {t(`login.${key}`)}
                  </Button>
                ))}
              </div>
              {fallback && <Banner>{t("login.fallback")}</Banner>}
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              if (reset) {
                setReset(false);
                setPassword("");
                setCode("");
                setError("");
              } else onBack();
            }}
          >
            {t(reset ? "login.backToLogin" : "back")}
          </Button>
        </div>
      </Card>
      {!reset && (
        <>
          {/* feat:S01-13 目标、摸底结果、学习记录合并范围由接口给出，尚未实际写入账号。 */}
          <Card title={t("login.mergeTitle")}>
            <p className="text-small text-ink-secondary">
              {t("login.merge", {
                goals: formatNumber(data.guest_merge.goals, 0),
                diagnoses: formatNumber(data.guest_merge.diagnoses, 0),
                records: formatNumber(data.guest_merge.learning_records, 0),
              })}
            </p>
          </Card>
          {/* feat:S01-05 已有目标登录后进入今日，并恢复上次位置；当前仅展示去向预览。 */}
          {data.resume.has_target && (
            <Card title={t("login.resumeTitle")}>
              <p className="text-small text-ink-secondary">{t("login.resume", { target: data.resume.target_name })}</p>
              <Link to={pathTo("S06")} className="mt-3 inline-flex text-small font-medium text-brand-primary underline">
                {t("login.today")}
              </Link>
            </Card>
          )}
        </>
      )}
      <DataUse />
      <Dialog
        open={policy !== null}
        onClose={() => setPolicy(null)}
        title={t(policy === "privacy" ? "login.privacyTitle" : "login.termsTitle")}
        actions={<Button onClick={() => setPolicy(null)}>{t("close")}</Button>}
      >
        <p>{t(policy === "privacy" ? "login.privacyBody" : "login.termsBody")}</p>
        {policy === "privacy" && (
          <Link to={pathTo("S32")} className="mt-3 inline-flex text-brand-primary underline">
            {t("dataUse.manage")}
          </Link>
        )}
      </Dialog>
    </>
  );
}
