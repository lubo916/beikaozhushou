// 本组进度（桌面右栏，平板与手机排在题目下面）：做对、做错、待揭晓、未做的题数都由接口给；条的长短只是把这几个数画出来。
// 测评态在这里交卷（交卷后一起揭晓，S18-02）。
import { useTranslation } from "react-i18next";
import type { S18QuizSession } from "@exam-prep/contract";
import { Button, Card, ProgressBar } from "@exam-prep/ui";

export interface ProgressCardProps {
  readonly session: S18QuizSession;
  readonly current: number;
  readonly rule: string;
  readonly onHandIn: () => void;
}

export function ProgressCard({ session, current, rule, onHandIn }: ProgressCardProps) {
  const { t } = useTranslation("S18");
  const { progress } = session;
  const share = (count: number): number => (progress.total === 0 ? 0 : count / progress.total);
  const currentOpen = session.items[current]?.status === "unanswered";
  return (
    <Card title={t("side.progress")}>
      <div className="flex flex-col gap-3">
        <ProgressBar
          value={share(progress.correct)}
          label={t("side.correct")}
          valueText={t("side.count", { n: progress.correct })}
          tone="success"
        />
        <ProgressBar
          value={share(progress.wrong)}
          label={t("side.wrong")}
          valueText={t("side.count", { n: progress.wrong })}
          tone="danger"
        />
        {progress.waiting > 0 && (
          <ProgressBar
            value={share(progress.waiting)}
            label={t("side.waiting")}
            valueText={t("side.count", { n: progress.waiting })}
            tone="warning"
          />
        )}
        <ProgressBar
          value={share(progress.unanswered)}
          label={t("side.unanswered")}
          valueText={
            currentOpen
              ? t("side.unanswered_current", { n: progress.unanswered, current: current + 1 })
              : t("side.count", { n: progress.unanswered })
          }
          tone="brand"
        />
        <p className="text-small text-ink-secondary">{rule}</p>
        {session.mode === "assessment" && !session.finished && (
          <Button variant="primary" onClick={onHandIn}>
            {t("question.hand_in")}
          </Button>
        )}
      </div>
    </Card>
  );
}
