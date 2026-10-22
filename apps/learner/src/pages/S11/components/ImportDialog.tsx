import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S11ImportPreview } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { AiBadge, Banner, Button, Dialog, Segmented, Tag } from "@exam-prep/ui";

type Step = "choose" | "preview" | "execute" | "result";
const STEP_ORDER: readonly Step[] = ["choose", "preview", "execute", "result"];

export function ImportDialog({ open, onClose, preview }: { open: boolean; onClose: () => void; preview: S11ImportPreview | undefined }) {
  const { t } = useTranslation("S11");
  const [step, setStep] = useState<Step>("choose");
  const [access, setAccess] = useState("parsable");
  const [source, setSource] = useState("");
  const [rights, setRights] = useState(false);
  const [failure, setFailure] = useState(false);
  const [target, setTarget] = useState("align");
  const steps = t("import.steps", { returnObjects: true }) as string[];
  const ready = rights && source.trim() !== "";
  // feat:S11-02 三种接入方式；feat:S11-03 四步向导与失败重试；feat:S11-04 十类资料。
  // feat:S11-05 据此生成新地图或对齐已有地图。执行为显式示例，不发未授权写请求。
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("import.title")}
      description={t("import.boundary")}
      actions={
        <>
          {step === "choose" && (
            <>
              <Button onClick={onClose}>{t("import.cancel")}</Button>
              <Button variant="primary" disabled={!ready} onClick={() => setStep("preview")}>
                {t("import.next")}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button onClick={() => setStep("choose")}>{t("import.back")}</Button>
              <Button variant="primary" disabled={preview === undefined} onClick={() => setStep("execute")}>
                {t("import.execute")}
              </Button>
            </>
          )}
          {step === "execute" && (
            <Button variant="primary" onClick={() => setStep("result")}>
              {t("import.result")}
            </Button>
          )}
          {step === "result" && (
            <>
              <Button
                onClick={() => {
                  setFailure(false);
                  setStep("preview");
                }}
              >
                {t("import.retry")}
              </Button>
              <Button variant="primary" onClick={onClose}>
                {t("import.done")}
              </Button>
            </>
          )}
        </>
      }
    >
      <ol className="mb-4 flex flex-wrap gap-2" aria-label={t("import.step")}>
        {STEP_ORDER.map((key, index) => (
          <li key={key} aria-current={step === key ? "step" : undefined}>
            <Tag tone={step === key ? "brand" : "outline"}>{steps[index]}</Tag>
          </li>
        ))}
      </ol>
      {step === "choose" && (
        <div className="flex flex-col gap-4">
          <Segmented
            label={t("import.mode")}
            options={["parsable", "mapped_only", "link_only"].map((value) => ({ value, label: t(`access.${value}`) }))}
            value={access}
            onChange={(value) => {
              setAccess(value);
              setSource("");
            }}
          />
          <label className="flex flex-col gap-2">
            {t("import.type")}
            <select className="w-full rounded-sm border border-line-strong p-2">
              {(t("import.types", { returnObjects: true }) as string[]).map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          {access === "parsable" ? (
            <>
              <label className="flex flex-col gap-2">
                {t("import.file")}
                <input type="file" className="w-full text-small" onChange={(event) => setSource(event.target.files?.[0]?.name ?? "")} />
              </label>
              <Button disabled={preview === undefined} onClick={() => setSource(preview?.filename ?? "")}>
                {t("import.example")}
              </Button>
              {source !== "" && <p className="break-words text-small">{source}</p>}
            </>
          ) : (
            <>
              <label className="flex flex-col gap-2">
                {t("import.source")}
                <input
                  className="w-full rounded-sm border border-line-strong p-2"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                {t("import.directory")}
                <textarea className="w-full rounded-sm border border-line-strong p-2" />
              </label>
              <Banner>{t(access === "mapped_only" ? "materials.no_text" : "materials.course")}</Banner>
            </>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2">{t("import.target")}</legend>
            {["align", "new_map"].map((key) => (
              <label key={key} className="flex gap-2">
                <input type="radio" name="s11-map-target" value={key} checked={target === key} onChange={() => setTarget(key)} />
                {t(`import.${key}`)}
              </label>
            ))}
          </fieldset>
          {/* feat:S11-11 无默认勾选，有权使用后才能继续。 */}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
            {t("import.rights")}
          </label>
        </div>
      )}
      {step === "preview" && (
        <div className="flex flex-col gap-3">
          <AiBadge />
          <Banner>{t("import.preview_hint")}</Banner>
          <p className="break-words">{source}</p>
          {preview !== undefined && (
            <p>
              {t("import.preview", {
                sections: formatCount(preview.sections),
                matched: formatCount(preview.matched),
                pending: formatCount(preview.pending),
                excluded: formatCount(preview.excluded),
              })}
            </p>
          )}
          <p>{t(`import.${target}`)}</p>
          <label className="flex gap-2">
            <input type="checkbox" checked={failure} onChange={(event) => setFailure(event.target.checked)} />
            {t("import.failure_toggle")}
          </label>
        </div>
      )}
      {step === "execute" && <Banner title={t("sample")}>{t("import.executing")}</Banner>}
      {step === "result" && (
        <Banner tone={failure ? "warning" : "success"} title={t(failure ? "import.failure" : "import.success")}>
          {failure ? t("import.failure_reason", { reason: preview?.failure_reason }) : t("import.success_body")}
        </Banner>
      )}
    </Dialog>
  );
}
