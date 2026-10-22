import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S01WelcomeData } from "@exam-prep/contract";
import { Button, Dialog, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

// feat:S01-06 数据用途首次展开；feat:S01-17 用到时才申请系统权限，本页不请求。
export function DataUse() {
  const { t } = useTranslation("S01");
  return (
    <details open className="rounded-md border border-line-soft bg-bg-surface p-4">
      <summary className="cursor-pointer font-bold text-ink-primary">{t("dataUse.title")}</summary>
      <div className="mt-3 flex flex-col gap-3 text-small text-ink-secondary">
        <ol className="list-decimal space-y-2 pl-5">
          {["learning", "optional", "control"].map((key) => (
            <li key={key}>{t(`dataUse.${key}`)}</li>
          ))}
        </ol>
        <p>{t("dataUse.permissions")}</p>
        <Link to={pathTo("S32")} className="font-medium text-brand-primary underline">
          {t("dataUse.manage")}
        </Link>
      </div>
    </details>
  );
}

// feat:S01-11 四个工具可独立使用，不向浏览器申请权限；正式能力待接入。
export function FreeTools() {
  const { t } = useTranslation("S01");
  const toast = useToast();
  return (
    <footer className="border-t border-line-soft pt-5">
      <h2 className="font-bold">{t("tools.title")}</h2>
      <p className="mt-1 text-small text-ink-tertiary">{t("tools.hint")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {["estimate", "eligibility", "capture", "check"].map((key) => (
          <Button key={key} onClick={() => toast(t("soon"))}>
            {t(`tools.${key}`)}
          </Button>
        ))}
      </div>
    </footer>
  );
}

export type WelcomeDialog = "invite" | "guide" | null;

// feat:S01-09 邀请加入前按四类数据说明可见范围；校验与加入不伪造成功。
// feat:S01-10 新手引导可跳过，也可到帮助中重看。
export function WelcomeExtras({ data, dialog, onClose }: { data: S01WelcomeData; dialog: WelcomeDialog; onClose: () => void }) {
  const { t } = useTranslation("S01");
  const toast = useToast();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Dialog
        open={dialog === "invite"}
        title={t("invite.title")}
        description={t("invite.body")}
        onClose={onClose}
        actions={
          <>
            <Button onClick={onClose}>{t("cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!code.trim()) {
                  setError(t("invite.required"));
                  return;
                }
                if (!preview) {
                  setPreview(true);
                  setError("");
                  return;
                }
                if (!agreed) {
                  setError(t("invite.consentRequired"));
                  return;
                }
                onClose();
                toast(t("invite.soon"));
              }}
            >
              {t(preview ? "invite.confirm" : "invite.preview")}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2 font-medium">
          {t("invite.code")}
          <input
            className="s01-field"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setPreview(false);
              setAgreed(false);
              setError("");
            }}
            placeholder={t("invite.placeholder")}
            autoComplete="off"
          />
        </label>
        {preview && (
          <section className="mt-4 flex flex-col gap-3">
            <h3 className="font-bold">
              {t(data.invitation.institution_key)} · {t(data.invitation.class_key)}
            </h3>
            <p className="font-medium">{t("invite.visibilityTitle")}</p>
            <ul className="list-disc space-y-2 pl-5 text-small text-ink-secondary">
              {data.invitation.visibility_keys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-small">
              <input type="checkbox" className="mt-1 shrink-0" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              {t("invite.consent")}
            </label>
          </section>
        )}
        {error && (
          <p role="alert" className="mt-3 text-small text-status-danger">
            {error}
          </p>
        )}
      </Dialog>
      <Dialog
        open={dialog === "guide"}
        title={t("guide.title")}
        description={t("guide.body")}
        onClose={onClose}
        actions={
          <>
            <Button onClick={onClose}>{t("guide.skip")}</Button>
            <Link to={pathTo("S35")} className={buttonClass("secondary")}>
              {t("guide.help")}
            </Link>
          </>
        }
      >
        <ol className="list-decimal space-y-3 pl-5 text-ink-secondary">
          {(t("guide.steps", { returnObjects: true }) as string[]).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}
