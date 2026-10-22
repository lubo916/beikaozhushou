import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S03SetupProfile } from "@exam-prep/contract";
import { formatDate, formatDuration, formatNumber } from "@exam-prep/shared/format";
import { Banner, Button, Card, Columns, Dialog, Segmented, Stat, StatGroup, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

interface Props {
  readonly data: S03SetupProfile;
  readonly onDaily: () => void;
}
type Day = S03SetupProfile["days"][number];
type Slot = Day["slots"][number];
const field = "w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-body text-ink-primary";
const kinds = ["deep", "fragment", "audio", "unavailable"] as const;

export function TimeSetup({ data, onDaily }: Props) {
  const { t } = useTranslation("S03");
  const toast = useToast();
  const [identity, setIdentity] = useState(data.identity);
  const [editing, setEditing] = useState<{ day: Day; slot?: Slot }>();
  const [minutes, setMinutes] = useState("");
  const [kind, setKind] = useState<string>("deep");
  const [unavailable, setUnavailable] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState<{ id: string; date: string; reason: string }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { minutes: number; kind: string }>>({});
  const edit = (day: Day, slot?: Slot) => {
    const selected = slot ?? day.slots[0];
    setEditing({ day, ...(slot === undefined ? {} : { slot }) });
    setMinutes(String(selected?.minutes ?? data.daily_minutes));
    setKind(selected?.kind ?? "deep");
  };
  const save = () => {
    if (editing === undefined) return;
    const key = editing.slot?.id ?? editing.day.id;
    setDrafts((old) => ({ ...old, [key]: { minutes: Number(minutes), kind } }));
    setEditing(undefined);
    toast(t("soon.save"));
  };
  return (
    <div className="flex flex-col gap-4">
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S03-01 身份模板：选择后预览；后台保存尚未接入。 */}
            <Card title={t("time.identity")} meta={t("time.template_hint")}>
              <Segmented
                label={t("time.identity")}
                value={identity}
                options={data.identities.map((item) => ({ value: item.id, label: t(item.label_key) }))}
                onChange={(value) => {
                  setIdentity(value);
                  toast(t("soon.template"));
                }}
                className="flex-wrap"
              />
            </Card>
            {/* feat:S03-02 周时间格；feat:S03-12 手机以两行模板代替七列。 */}
            <Card
              title={t("time.grid")}
              meta={t("time.grid_hint")}
              actions={
                <Button size="sm" onClick={onDaily}>
                  {t("time.daily")}
                </Button>
              }
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {kinds.map((value) => (
                  <Tag key={value} tone={value === "deep" ? "brand" : value === "unavailable" ? "neutral" : "success"}>
                    {t(`scenario.${value}`)}
                  </Tag>
                ))}
              </div>
              <div data-testid="mobile-time" className="flex flex-col gap-3 @tablet:hidden">
                <p className="text-small text-ink-secondary">{t("time.mobile_hint")}</p>
                {data.templates.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-sm bg-sunk p-3">
                    <span>{t(`time.${item.id}`)}</span>
                    <strong>{formatDuration(item.minutes)}</strong>
                    <Button size="sm" onClick={onDaily}>
                      {t("action.edit")}
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {data.days.map((day) => (
                    <Button key={day.id} size="sm" onClick={() => edit(day)}>
                      {t("time.edit_day", { day: t(day.label_key) })}
                    </Button>
                  ))}
                </div>
              </div>
              <div data-testid="weekly-grid" className="hidden grid-cols-8 gap-1 @tablet:grid">
                <span />
                {data.days.map((day) => (
                  <strong key={day.id} className="pb-2 text-center text-small">
                    {t(day.label_key)}
                  </strong>
                ))}
                {data.days[0]?.slots.map((period) => (
                  <Fragment key={period.period_key}>
                    <span className="flex items-center text-small text-ink-secondary">{t(period.period_key)}</span>
                    {data.days.map((day) => {
                      const slot = day.slots.find((item) => item.period_key === period.period_key);
                      if (slot === undefined) return <span key={day.id} />;
                      const draft = drafts[slot.id] ?? drafts[day.id] ?? slot;
                      const tones: Readonly<Record<string, string>> = {
                        deep: "border-brand-primary bg-brand-primary-soft text-brand-primary-ink",
                        audio: "border-status-success bg-status-success-soft text-ink-primary",
                        fragment: "border-status-warning bg-status-warning-soft text-ink-primary",
                        unavailable: "border-dashed border-line-strong bg-sunk text-ink-tertiary",
                      };
                      const description = `${t(`scenario.${draft.kind}`)} · ${formatDuration(draft.minutes)}`;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          aria-label={t("time.edit", { day: t(day.label_key), period: t(slot.period_key) })}
                          aria-describedby={`slot-${slot.id}`}
                          title={description}
                          onClick={() => edit(day, slot)}
                          className={`h-8 min-w-0 truncate rounded-sm border px-1 text-small focus-visible:outline-2 focus-visible:outline-brand-primary ${tones[draft.kind] ?? tones["unavailable"]}`}
                        >
                          {t(`scenario.${draft.kind}`)}
                          <span id={`slot-${slot.id}`} className="sr-only">
                            {description}
                          </span>
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S03-10 只展示接口给的投入和差额，不由页面重新计算。 */}
            <Card title={t("time.summary")}>
              <StatGroup>
                <Stat label={t("time.weekly")} value={formatDuration(data.summary.weekly_minutes)} />
                <Stat label={t("time.total")} value={t("time.hours", { value: formatNumber(data.summary.total_hours) })} />
                <Stat label={t("time.recommended")} value={t("time.hours", { value: formatNumber(data.summary.recommended_hours) })} />
                <Stat label={t("time.gap")} value={t("time.hours", { value: formatNumber(data.summary.gap_hours) })} />
              </StatGroup>
            </Card>
            {/* feat:S03-04 先记下日期，不把不可学日当作未完成。 */}
            <Card
              title={t("time.unavailable")}
              actions={
                <Button size="sm" onClick={() => setUnavailable(true)}>
                  {t("time.add_unavailable")}
                </Button>
              }
            >
              <ul className="flex flex-col gap-2">
                {[...data.unavailable_days, ...extraDays].map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 rounded-sm bg-sunk p-3">
                    <span>{formatDate(item.date, { year: true })}</span>
                    <span className="text-ink-secondary">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
            {/* feat:S03-05 声明与实测校准，调整需用户确认。 */}
            <Card title={t("time.calibration")} meta={t("time.calibration_body")}>
              <StatGroup>
                <Stat label={t("time.declared")} value={formatDuration(data.calibration.declared_minutes)} />
                <Stat label={t("time.observed")} value={formatDuration(data.calibration.observed_minutes)} />
                <Stat label={t("time.sample")} value={formatDuration(data.calibration.sample_minutes)} />
              </StatGroup>
              {data.calibration.status === "collecting" && <Banner tone="warning">{t("time.calibration_collecting")}</Banner>}
              <p className="my-3 text-small text-ink-secondary">{t("time.calibration_note")}</p>
              <div className="flex flex-wrap gap-2">
                {["replan", "invest", "scope"].map((action) => (
                  <Button key={action} onClick={() => toast(t("soon.calibration"))}>
                    {t(`time.${action}`)}
                  </Button>
                ))}
              </div>
            </Card>
          </div>
        }
      />
      <Dialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing === undefined ? "" : t("time.edit_day", { day: t(editing.day.label_key) })}
        actions={
          <>
            <Button onClick={() => setEditing(undefined)}>{t("action.cancel")}</Button>
            <Button variant="primary" onClick={save} disabled={minutes === "" || !Number.isFinite(Number(minutes)) || Number(minutes) < 0}>
              {t("action.save")}
            </Button>
          </>
        }
      >
        <label className="mb-3 flex flex-col gap-2">
          {t("time.duration")}
          <input className={field} type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          {t("time.scenario")}
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((value) => (
              <option key={value} value={value}>
                {t(`scenario.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </Dialog>
      <Dialog
        open={unavailable}
        onClose={() => setUnavailable(false)}
        title={t("time.add_unavailable")}
        actions={
          <>
            <Button onClick={() => setUnavailable(false)}>{t("action.cancel")}</Button>
            <Button
              variant="primary"
              disabled={date === "" || reason.trim() === ""}
              onClick={() => {
                setExtraDays((old) => [...old, { id: crypto.randomUUID(), date, reason }]);
                setUnavailable(false);
                setDate("");
                setReason("");
                toast(t("soon.save"));
              }}
            >
              {t("action.save")}
            </Button>
          </>
        }
      >
        <label className="mb-3 flex flex-col gap-2">
          {t("time.date")}
          <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          {t("time.reason")}
          <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </Dialog>
    </div>
  );
}
