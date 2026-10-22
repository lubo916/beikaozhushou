import { useTranslation } from "react-i18next";
import type { S21Assessment, S21Radar } from "@exam-prep/contract";
import { formatCount, formatDate, formatScore, formatSeconds } from "@exam-prep/shared/format";
import { AiContent, BarList, Button, Card, KeyValueList, PageState, Stat, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function AssessmentCard({ data, onStart, disabled }: { data: S21Assessment; onStart: () => void; disabled: boolean }) {
  const { t } = useTranslation("S21");
  const toast = useToast();
  // feat:S21-05 追问、feat:S21-06 多维反馈、feat:S21-09 重答入口；简版数据不记为真实证据。
  return (
    <Card
      title={t("assessment.title")}
      meta={t("assessment.date", { day: formatDate(data.day), title: data.title })}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              toast(t("soon.retry"));
              onStart();
            }}
            disabled={disabled}
          >
            {t("assessment.retry")}
          </Button>
          <Button onClick={() => toast(t("soon.history"))}>{t("assessment.history")}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Stat label={t("assessment.score")} value={formatScore(data.score, { total: data.score_total })} tone="brand" />
        <AiContent note={t("assessment.sample_note")}>
          <p>{data.summary}</p>
          <KeyValueList
            items={data.dimensions.map((item) => ({
              key: item.id,
              label: item.label,
              value: (
                <>
                  <span className="font-medium">{formatScore(item.score)}</span>
                  <p className="text-small text-ink-secondary">{item.description}</p>
                </>
              ),
            }))}
          />
          <div className="mt-3 rounded-sm bg-status-ai-soft p-3">
            <h3 className="font-medium">{t("assessment.follow")}</h3>
            <p>{data.follow_up}</p>
          </div>
        </AiContent>
      </div>
    </Card>
  );
}

export function TranscriptCard({ data }: { data: S21Assessment }) {
  const { t } = useTranslation("S21");
  const toast = useToast();
  // feat:S21-07 时间轴标出填充词、泛泛表达与收尾问题；回听待录音后端接入。
  return (
    <Card title={t("transcript.title")}>
      <AiContent>
        <ol aria-label={t("transcript.timeline")} className="flex flex-col gap-4">
          {data.transcript.map((line) => (
            <li key={line.id} className="border-l border-line-strong pl-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast(t("soon.play"))}
                aria-label={`${t("transcript.play")} · ${formatSeconds(line.at_seconds)}`}
              >
                {t("transcript.at", { time: formatSeconds(line.at_seconds) })}
              </Button>
              <p className="my-2">{line.text}</p>
              <p className="text-small text-status-warning">{line.annotation}</p>
            </li>
          ))}
        </ol>
      </AiContent>
    </Card>
  );
}

export function ReconstructionCard({ data, onStart, disabled }: { data: S21Assessment; onStart: () => void; disabled: boolean }) {
  const { t } = useTranslation("S21");
  // feat:S21-08 重构保留原思路，生成内容与复制都有 AI 标识。
  return (
    <Card title={t("reconstruction.title")} meta={t("reconstruction.note")}>
      <AiContent>
        <ol className="list-inside list-decimal space-y-3">
          {data.reconstruction.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </AiContent>
      <Button className="mt-3" onClick={onStart} disabled={disabled}>
        {t("reconstruction.try")}
      </Button>
    </Card>
  );
}

export function RadarCard({ data }: { data: S21Radar }) {
  const { t } = useTranslation("S21");
  // feat:S21-06 接口决定样本是否充分；简版使用公共维度条，页面不计算能力结论。
  return (
    <Card title={t("radar.title")} meta={t("radar.sample", { total: formatCount(data.sample_count) })}>
      {data.sufficient ? (
        <BarList
          label={t("radar.dimension")}
          max={data.score_total}
          items={data.dimensions.map((item) => ({
            key: item.id,
            label: item.label,
            value: item.score,
            valueText: formatScore(item.score),
            tone: "brand",
          }))}
        />
      ) : (
        <PageState
          compact
          state="insufficient_data"
          title={t("radar.insufficient_title")}
          body={t("radar.insufficient_body", { minimum: formatCount(data.minimum_samples) })}
          counts={[{ key: "count", label: t("radar.count"), value: t("radar.count_value", { total: formatCount(data.sample_count) }) }]}
          missing={t("radar.missing")}
        />
      )}
    </Card>
  );
}

export function PrivacyCard({ allowed, onSettings, disabled }: { allowed: boolean; onSettings: () => void; disabled: boolean }) {
  const { t } = useTranslation("S21");
  // feat:S21-02 默认只录音不留存；录音留存与本地画面分析分别选择。
  return (
    <Card title={t("privacy.title")}>
      <ul className="list-inside list-disc space-y-2 text-small text-ink-secondary">
        <li>{t("privacy.audio")}</li>
        <li>{t("privacy.retention")}</li>
        <li>{t("privacy.video")}</li>
      </ul>
      {!allowed && (
        <PageState
          compact
          state="restricted"
          title={t("privacy.restricted_title")}
          body={t("privacy.restricted_body")}
          action={
            <Button disabled={disabled} onClick={onSettings}>
              {t("privacy.restricted_action")}
            </Button>
          }
        />
      )}
      <p className="my-3 text-small text-ink-tertiary">{t("privacy.preview")}</p>
      <Button size="sm" disabled={disabled} onClick={onSettings}>
        {t("privacy.settings")}
      </Button>
      <Tag className="ml-2" tone="success" size="sm">
        {t("flow.audio_only")}
      </Tag>
    </Card>
  );
}
