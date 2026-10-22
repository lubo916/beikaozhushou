// feat:S13-01 统一播放器的三种授权来源；简版使用明确标识的演示，不写有效学习。
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { S13Course, S13Segment, S13TimestampNote } from "@exam-prep/contract";
import { formatCount, formatSeconds } from "@exam-prep/shared/format";
import { AiContent, Button, Card, Columns, Dialog, ProgressBar, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const MASTERY = ["bg-mastery-0", "bg-mastery-1", "bg-mastery-2", "bg-mastery-3", "bg-mastery-4", "bg-mastery-5"] as const;
const FIELD = "w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary";
type DraftNote = S13TimestampNote & { draft?: boolean };

export function Lesson({
  course,
  notes,
  audio = false,
  audioAvailable = true,
}: {
  course: S13Course;
  notes: S13TimestampNote[];
  audio?: boolean;
  audioAvailable?: boolean;
}) {
  const { t } = useTranslation("S13");
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(course.current_segment_id);
  const segment = course.segments.find((item) => item.id === selectedId) ?? course.segments[0];
  const [playing, setPlaying] = useState(false);
  const [dialog, setDialog] = useState<"ask" | "note" | null>(null);
  const [question, setQuestion] = useState("");
  const [noteText, setNoteText] = useState("");
  const [drafts, setDrafts] = useState<DraftNote[]>([]);
  if (segment === undefined) return null;

  // feat:S13-03 从知识点或逐字稿、笔记定位到片段；当前知识点与时间戳同步显示。
  function seek(item: S13Segment) {
    setSelectedId(item.id);
    setPlaying(false);
  }
  function pauseAndOpen(kind: "ask" | "note") {
    setPlaying(false);
    setDialog(kind);
  }
  function addDraft() {
    if (segment === undefined || noteText.trim() === "") return;
    setDrafts([
      ...drafts,
      {
        id: crypto.randomUUID(),
        segment_id: segment.id,
        at_seconds: segment.start_seconds,
        text: noteText.trim(),
        ai_generated: false,
        draft: true,
      },
    ]);
    setNoteText("");
    setDialog(null);
    toast(t("note.saved"));
  }
  const allNotes: DraftNote[] = [...notes, ...drafts];
  const playable = !audio || audioAvailable;
  const chooseSegment = (item: S13Segment) => (
    <button
      key={item.id}
      type="button"
      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-sm border border-line-soft p-3 text-left hover:border-brand-primary"
      aria-current={item.id === segment.id ? "true" : undefined}
      onClick={() => seek(item)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-3 w-3 shrink-0 rounded-sm ${MASTERY[item.mastery_level] ?? MASTERY[0]}`} aria-hidden="true" />
        <span>{item.point_name}</span>
      </span>
      <span className="text-small text-ink-secondary">
        {formatSeconds(item.start_seconds)} · {t(`mastery.${item.mastery_level}`)}
      </span>
    </button>
  );
  return (
    <>
      <Columns
        main={
          <div className="flex min-w-0 flex-col gap-4">
            <Card title={audio ? t("audio.title") : course.title} meta={<Tag>{t(`sources.${course.source}`)}</Tag>}>
              <div className="flex flex-col gap-4">
                <div
                  className="flex aspect-video flex-col items-center justify-center gap-3 rounded-md bg-brand-primary p-4 text-center text-bg-surface"
                  role="region"
                  aria-label={t("player.title")}
                >
                  <span className="text-small">{t("player.current")}</span>
                  <h2 className="font-serif text-title">{segment.point_name}</h2>
                  <p>{t("player.chalk")}</p>
                  <Button variant="secondary" disabled={!playable} onClick={() => setPlaying(!playing)}>
                    {playing ? t("player.pause") : t("player.play")}
                  </Button>
                  <p className="text-small" role="status">
                    {playing ? t("player.playing") : t("player.paused")}
                  </p>
                  <p className="text-small">{t("player.position", { time: formatSeconds(segment.start_seconds) })}</p>
                </div>
                <p className="text-small text-ink-secondary">{audio ? t("audio.demo") : t("player.demo")}</p>
                <ProgressBar label={t("player.progress")} value={course.progress_ratio} />
                <p className="text-small text-ink-tertiary">{t("player.duration", { duration: formatSeconds(course.duration_seconds) })}</p>
                {/* feat:S13-02 时间轴按知识点分段着色，文字同时显示掌握档。 */}
                <div className="flex gap-1" aria-label={t("player.timeline")}>
                  {course.segments.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`min-h-10 min-w-0 flex-1 rounded-sm border border-line-strong px-2 text-small text-ink-primary ${MASTERY[item.mastery_level] ?? MASTERY[0]}`}
                      aria-label={t("player.mastery", { name: item.point_name, level: t(`mastery.${item.mastery_level}`) })}
                      aria-pressed={item.id === segment.id}
                      onClick={() => seek(item)}
                    >
                      {formatSeconds(item.start_seconds)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* feat:S13-05 暂停处带入前后讲解；后端提问尚未接入。 */}
                  <Button onClick={() => pauseAndOpen("ask")}>{t("actions.ask")}</Button>
                  {/* feat:S13-06 笔记带时间戳；新笔记仅为本次草稿，不谎称保存。 */}
                  <Button variant="secondary" onClick={() => pauseAndOpen("note")}>
                    {t("actions.note")}
                  </Button>
                </div>
              </div>
            </Card>
            {/* feat:S13-04 片内检测与听完即测的入口，尚未检测不会计有效学习。 */}
            <Card title={t("check.title")}>
              <div className="flex flex-col gap-3">
                <p>{t("check.body", { n: formatCount(segment.check_count) })}</p>
                <p className="text-small text-ink-tertiary">{t("check.sample")}</p>
                <Link className={buttonClass("primary")} to={pathTo("S18")}>
                  {audio ? t("audio.check") : t("check.start")}
                </Link>
              </div>
            </Card>
            <Card title={t("transcript.title")} meta={t("transcript.hint")}>
              <AiContent note={t("transcript.ai")}>
                <ul className="flex flex-col gap-3">
                  {course.segments.map((item) => (
                    <li key={item.id}>
                      <button className="mb-1 font-medium text-brand-primary underline" type="button" onClick={() => seek(item)}>
                        {formatSeconds(item.start_seconds)} · {item.point_name}
                      </button>
                      <p className="text-ink-secondary">{item.transcript}</p>
                    </li>
                  ))}
                </ul>
              </AiContent>
            </Card>
          </div>
        }
        aside={
          <div className="flex min-w-0 flex-col gap-4">
            <Card title={audio ? t("audio.queue") : t("player.timeline")}>
              <div className="flex flex-col gap-2">{course.segments.map(chooseSegment)}</div>
            </Card>
            <Card title={t("note.list")}>
              <div className="flex flex-col gap-3">
                {allNotes.length === 0 && <p className="text-ink-tertiary">{t("note.empty")}</p>}
                {allNotes.map((note) => (
                  <article key={note.id} className="rounded-sm border border-line-soft p-3">
                    <button
                      className="text-small text-brand-primary underline"
                      type="button"
                      onClick={() => {
                        const hit = course.segments.find((item) => item.id === note.segment_id);
                        if (hit !== undefined) seek(hit);
                      }}
                    >
                      {t("note.at", { time: formatSeconds(note.at_seconds) })}
                    </button>
                    <p className="mt-1 whitespace-pre-wrap break-words">{note.text}</p>
                    {note.draft && <Tag tone="warning">{t("note.draft")}</Tag>}
                  </article>
                ))}
                <Link to={pathTo("S14")} className={buttonClass("secondary")}>
                  {t("actions.notes")}
                </Link>
              </div>
            </Card>
            <Link className={buttonClass("secondary")} to={pathTo("S09")}>
              {t("actions.map")}
            </Link>
          </div>
        }
      />
      <Dialog
        open={dialog === "ask"}
        onClose={() => setDialog(null)}
        title={t("ask.title")}
        description={t("ask.context")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("ask.cancel")}
            </Button>
            <Button disabled={question.trim() === ""} onClick={() => toast(t("ask.soon"))}>
              {t("ask.send")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <AiContent>
            <blockquote className="rounded-sm bg-bg-sunk p-3 text-small">
              <p>
                <strong>{t("ask.before")}</strong> · {segment.transcript_before}
              </p>
              <p className="my-2">
                <strong>{t("ask.current")}</strong> · {segment.transcript}
              </p>
              <p>
                <strong>{t("ask.after")}</strong> · {segment.transcript_after}
              </p>
            </blockquote>
          </AiContent>
          <label className="flex flex-col gap-1">
            {t("ask.label")}
            <textarea
              className={FIELD}
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t("ask.placeholder")}
            />
          </label>
        </div>
      </Dialog>
      <Dialog
        open={dialog === "note"}
        onClose={() => setDialog(null)}
        title={t("note.title")}
        description={t("note.draft")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("note.cancel")}
            </Button>
            <Button disabled={noteText.trim() === ""} onClick={addDraft}>
              {t("note.save")}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          {t("note.label")}
          <textarea
            className={FIELD}
            rows={4}
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder={t("note.placeholder")}
          />
        </label>
      </Dialog>
    </>
  );
}
