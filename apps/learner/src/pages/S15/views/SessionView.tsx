import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S15ReviewHome } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { AiContent, Banner, Button, Card, Dialog, ProgressBar, Tag, buttonClass } from "@exam-prep/ui";
import { ImmersiveProgress } from "../../../app/page-context.tsx";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function SessionView({ data, onExit }: { data: S15ReviewHome; onExit: () => void }) {
  const { t } = useTranslation("S15");
  const toast = useToast();
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState(false);
  const [feedback, setFeedback] = useState("");
  const card = data.session.card;
  // feat:S15-11 翻面后使用接口返回的参数时长防误触，没有默认评级。
  useEffect(() => {
    if (!flipped) return;
    const timer = setTimeout(() => setReady(true), data.policy.flip_guard_ms);
    return () => clearTimeout(timer);
  }, [flipped, data.policy.flip_guard_ms]);
  const soon = () => toast(t("soon"));
  const progress = t("session.position", { position: formatCount(data.session.position), total: formatCount(data.session.total) });
  const content = (
    <>
      <p className="mb-3 text-small text-ink-secondary">{t(flipped ? "session.back" : "queue.auto")}</p>
      <p className="whitespace-pre-line font-serif text-title">{flipped ? card.back : card.front}</p>
    </>
  );
  return (
    <div className="mx-auto flex w-full max-w-content-md flex-col gap-4">
      {/* feat:S15-18 沉浸复习，进度只显示接口值。 */}
      <ImmersiveProgress>{progress}</ImmersiveProgress>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-title">{t("session.title")}</h1>
        <Button variant="ghost" onClick={onExit}>
          {t("session.exit")}
        </Button>
      </div>
      <ProgressBar label={t("session.progress")} value={data.session.progress_ratio} valueText={progress} />
      <div className="flex flex-wrap gap-2">
        <Tag>{card.card_type}</Tag>
        <Tag>{t("sample")}</Tag>
      </div>
      {/* feat:S15-02 先回忆再翻面；卡面是原生按钮，键盘与点按均可翻面，正面不渲染答案/评级。 */}
      <Card>
        <button
          type="button"
          aria-label={flipped ? t("session.back") : t("session.front")}
          aria-expanded={flipped}
          className="s15-cardface w-full rounded-md p-6 text-start"
          onClick={() => setFlipped(true)}
        >
          {card.ai_generated ? <AiContent>{content}</AiContent> : content}
        </button>
      </Card>
      {!flipped ? (
        <>
          <p className="text-center text-small text-ink-secondary">{t("session.hint")}</p>
          <Button onClick={() => setFlipped(true)}>{t("session.flip")}</Button>
        </>
      ) : (
        <div className="s15-ratings sticky bottom-0 flex flex-col gap-3 rounded-md border border-line-soft bg-bg-surface p-4">
          <p className="font-bold">{t("session.rate")}</p>
          <p className="text-small text-ink-secondary">{t("session.guard")}</p>
          <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-4">
            {data.session.ratings.map((rating) => (
              <Button key={rating.id} aria-label={t(`session.${rating.id}`)} variant="secondary" disabled={!ready} onClick={soon}>
                <span className="flex flex-col items-center gap-1">
                  <span>{t(`session.${rating.id}`)}</span>
                  <span className="text-small font-normal">{rating.interval_text}</span>
                </span>
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFlipped(false);
              setReady(false);
            }}
          >
            {t("session.review_again")}
          </Button>
        </div>
      )}
      <p className="text-center text-small text-ink-tertiary">{t("session.demo")}</p>
      {/* feat:S15-09 每张卡回到出处，有误暂停并报错。 */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link className={buttonClass("ghost")} to={pathTo("S12", { docId: card.material_id })}>
          {t("session.source")}
        </Link>
        <Button variant="ghost" onClick={() => setReport(true)}>
          {t("session.report")}
        </Button>
      </div>
      <Banner
        title={t("session.due_mistake")}
        action={
          <Button variant="secondary" size="sm" onClick={soon}>
            {t("session.mistake_action")}
          </Button>
        }
      >
        {t("session.mistake_body")}
      </Banner>
      <Dialog
        open={report}
        title={t("session.report_title")}
        onClose={() => setReport(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setReport(false)}>
              {t("pending.cancel")}
            </Button>
            <Button onClick={soon}>{t("session.report_send")}</Button>
          </>
        }
      >
        <p>{t("session.report_body")}</p>
        <label className="mt-4 block">
          {t("session.feedback")}
          <textarea
            className="mt-2 w-full rounded-sm border border-line-strong p-3"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
      </Dialog>
    </div>
  );
}
