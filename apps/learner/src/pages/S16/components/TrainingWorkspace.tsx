import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S16Item, S16Level, S16Method, S16Source, S16Training, S16Variant } from "@exam-prep/contract";
import { formatPercent } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { AiContent, Button, Card, PageState, Segmented, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const LEVELS: readonly S16Level[] = ["keywords", "initials", "full"];
const SOURCES: readonly S16Source[] = ["user", "tutor"];
const INPUT = "w-full min-w-[0] rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary";

export function TrainingWorkspace({
  data,
  item,
  method,
  offline,
}: {
  data: S16Training;
  item: S16Item;
  method: S16Method;
  offline: boolean;
}) {
  const { t } = useTranslation("S16");
  const [level, setLevel] = useState<S16Level>(data.default_level);
  const [source, setSource] = useState<S16Source>(data.default_source);
  const [segment, setSegment] = useState(data.default_segment);
  const segmentId = method === "segments" ? segment : "all";
  const variant = item.variants.find((entry) => entry.level === level && entry.source === source && entry.segment_id === segmentId);
  const reference =
    method === "segments" ? (item.segments.find((entry) => entry.id === segment)?.reference ?? item.reference) : item.reference;
  return (
    <Card
      title={item.title}
      meta={
        <Tag tone="brand" size="sm">
          {VOCAB.knowledge_type[item.knowledge_type]}
        </Tag>
      }
      data-testid="s16-workspace"
      footer={<p className="text-small text-ink-tertiary">{t("origin", { origin: item.origin })}</p>}
    >
      <div className="flex flex-col gap-4">
        {/* feat:S16-01 渐进挖空三级；feat:S16-02 自标与导师来源并存。版本由接口给出，不在页面自动挖空。 */}
        {(method === "cloze" || method === "segments") && (
          <>
            <Segmented
              label={t("sourceLabel")}
              value={source}
              onChange={setSource}
              options={SOURCES.map((value) => ({ value, label: t(`source.${value}`) }))}
            />
            <Segmented
              label={t("levelLabel")}
              value={level}
              onChange={setLevel}
              options={LEVELS.map((value) => ({ value, label: t(`level.${value}`) }))}
            />
          </>
        )}
        {/* feat:S16-06 长文分段与合并，选择段落时切换接口提供的版本。 */}
        {method === "segments" && (
          <>
            <Segmented
              label={t("segmentLabel")}
              value={segment}
              onChange={setSegment}
              options={item.segments.map((entry) => ({ value: entry.id, label: entry.label }))}
            />
            <p className="text-small text-ink-secondary">{t("segmentHint")}</p>
          </>
        )}
        {!data.oral_available && (
          <PageState
            state="restricted"
            title={t("state.restricted.title")}
            body={t("state.restricted.body")}
            action={
              <Link to={pathTo("S31")} className={buttonClass("secondary")}>
                {t("state.restricted.action")}
              </Link>
            }
          />
        )}
        <RecallForm
          key={`${method}-${variant?.id ?? item.id}`}
          method={method}
          variant={variant}
          reference={reference}
          outline={item.outline}
          oralAvailable={data.oral_available && !offline}
        />
      </div>
    </Card>
  );
}

function RecallForm({
  method,
  variant,
  reference,
  outline,
  oralAvailable,
}: {
  method: S16Method;
  variant: S16Variant | undefined;
  reference: string;
  outline: readonly string[];
  oralAvailable: boolean;
}) {
  const { t } = useTranslation("S16");
  const toast = useToast();
  const id = useId();
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const oral = method === "oral";
  const prompt = variant?.prompt;
  const masked = method === "cloze" || method === "segments";
  const promptBody = <p className="whitespace-pre-wrap break-words font-serif text-ink-primary">{prompt?.trim() ? prompt : t("recall")}</p>;
  return (
    <div className="flex flex-col gap-4">
      {masked &&
        (variant?.ai_generated ? <AiContent>{promptBody}</AiContent> : <div className="rounded-sm bg-bg-sunk p-4">{promptBody}</div>)}
      {/* feat:S16-04 仅回忆得分点骨架；提示要点先收起，让学员先回忆。 */}
      {method === "points" && (
        <>
          <p className="text-ink-secondary">{t("pointsHint")}</p>
          <Button aria-expanded={hint} aria-controls={`${id}-outline`} onClick={() => setHint(!hint)}>
            {t(hint ? "hideOutline" : "showOutline")}
          </Button>
          {hint && (
            <div id={`${id}-outline`}>
              <h3 className="font-bold">{t("outline")}</h3>
              <ul className="list-disc pl-5">
                {outline.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {oral && (
        <>
          <h3 className="font-bold">{t("oral.title")}</h3>
          <p className="text-ink-secondary">{t("oral.body")}</p>
          <p className="text-small text-ink-tertiary">{t("oral.demo")}</p>
          <Button variant="primary" disabled={!oralAvailable} onClick={() => toast(t("soon.oral"))}>
            {t("oral.start")}
          </Button>
        </>
      )}
      <label className="flex flex-col gap-2 font-medium" htmlFor={id}>
        {t(oral ? "oral.transcript" : "draft")}
        <textarea
          id={id}
          className={INPUT}
          rows={6}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t(oral ? "oral.placeholder" : method === "points" ? "pointsPlaceholder" : "placeholder")}
          aria-describedby={`${id}-hint`}
        />
      </label>
      <p id={`${id}-hint`} className="text-small text-ink-tertiary">
        {t("draftHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={draft.trim() === "" || (oral && !oralAvailable)} onClick={() => toast(t("soon.check"))}>
          {t("check")}
        </Button>
        <Button aria-expanded={revealed} aria-controls={`${id}-reference`} onClick={() => setRevealed(!revealed)}>
          {t(revealed ? "hide" : "reveal")}
        </Button>
      </div>
      {revealed && (
        <div id={`${id}-reference`} className="rounded-sm border border-line-soft bg-bg-sunk p-4">
          <h3 className="mb-2 font-bold">{t("reference")}</h3>
          <p className="whitespace-pre-wrap break-words font-serif">{reference}</p>
        </div>
      )}
    </div>
  );
}

// feat:S16-03 四档宽松比对，阈值只预览接口给出的配置；应用设置尚不写入。
export function MatchSettings({ data }: { data: S16Training }) {
  const { t } = useTranslation("S16");
  const toast = useToast();
  const [profileId, setProfileId] = useState(data.default_profile);
  const profile = data.match_profiles.find((entry) => entry.id === profileId);
  return (
    <Card title={t("compare.title")}>
      <div className="flex flex-col gap-3">
        <p className="text-small text-ink-secondary">{t("compare.hint")}</p>
        <Segmented
          label={t("compare.label")}
          value={profileId}
          onChange={setProfileId}
          options={data.match_profiles.map((entry) => ({ value: entry.id, label: t(`compare.profile.${entry.id}`) }))}
        />
        <dl className="flex flex-col gap-2 text-small">
          {profile?.bands.map((band) => (
            <div key={band.grade} className="flex flex-wrap justify-between gap-2">
              <dt>{t(`grade.${band.grade}`)}</dt>
              <dd className="text-ink-secondary">
                {band.grade === "wrong" ? t("compare.lowest") : t("compare.band", { value: formatPercent(band.minimum_match) })}
              </dd>
            </div>
          ))}
        </dl>
        <Button onClick={() => toast(t("soon.profile"))}>{t("compare.save")}</Button>
      </div>
    </Card>
  );
}
