import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S21Scenario } from "@exam-prep/contract";
import { Button, Dialog, PageState, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function TrainingDialog({
  scenario,
  flow,
  videoAllowed,
  onClose,
}: {
  scenario: S21Scenario;
  flow: readonly string[];
  videoAllowed: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("S21");
  const toast = useToast();
  // feat:S21-02 每次打开流程都是仅音频、不留存；勾选留存是独立同意，关闭即丢弃本次选择。
  const [retain, setRetain] = useState(false);
  const [video, setVideo] = useState(false);
  const confirm = () => {
    onClose();
    toast(t("soon.start"));
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("flow.title")}
      description={t("flow.scenario", { name: scenario.title })}
      actions={
        <>
          <Button onClick={onClose}>{t("flow.cancel")}</Button>
          <Button variant="primary" onClick={confirm}>
            {t("flow.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* feat:S21-04 五步流程先于启动录音，简版不请求设备权限。 */}
        <ol aria-label={t("flow.steps")} className="list-inside list-decimal space-y-2">
          {flow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Tag tone="success">{t("flow.audio_only")}</Tag>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={retain}
            onChange={(event) => setRetain(event.target.checked)}
            className="mt-1 accent-brand-primary"
          />
          <span>{t("flow.save")}</span>
        </label>
        {/* feat:S21-06 视频只做本地分析的可选预览，未成年人模式禁用；不申请摄像头权限。 */}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={video}
            disabled={!videoAllowed}
            onChange={(event) => setVideo(event.target.checked)}
            className="mt-1 accent-brand-primary"
          />
          <span>{t("flow.video")}</span>
        </label>
        {!videoAllowed && (
          <PageState compact state="restricted" title={t("privacy.restricted_title")} body={t("privacy.restricted_body")} />
        )}
        <p className="text-small text-ink-secondary" role="status">
          {retain ? t("flow.save_selected") : t("flow.no_save")}
          {video && ` ${t("flow.video_selected")}`}
        </p>
        <p className="rounded-sm bg-bg-sunk p-3 text-small text-ink-secondary">{t("privacy.preview")}</p>
      </div>
    </Dialog>
  );
}
