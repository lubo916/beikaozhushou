// 测评条（放进外壳的沉浸页顶栏，ImmersiveProgress；feat:S04-10）：测评中、说明、第几题与约几题、预计剩余、暂停并退出（feat:S04-07）。
// 数字都由接口给（规则卡 R4）；手机上只留第几题与“暂停并退出”，平板起加“测评中”与预计剩余，桌面再加说明（原型）。
import { useTranslation } from "react-i18next";
import type { S04Session } from "@exam-prep/contract";
import { ImmersiveProgress } from "../../../app/page-context.tsx";

const BAR_BUTTON = "shrink-0 rounded-sm border border-ink-tertiary px-3 py-1 text-small hover:bg-ink-secondary";

export interface TestBarProps {
  readonly session: S04Session;
  readonly onPause: () => void;
  readonly pausing: boolean;
}

export function TestBar({ session, onPause, pausing }: TestBarProps) {
  const { t } = useTranslation("S04");
  const finished = session.stage === "finished";
  const position =
    session.stage === "rating"
      ? t("test.rating")
      : finished
        ? t("test.finished")
        : t("test.position", { n: (session.current?.index ?? session.answered) + 1, total: session.estimate_total });
  return (
    <ImmersiveProgress>
      <span className="hidden shrink-0 rounded-full border border-ink-tertiary px-2 text-small @tablet:inline-flex">{t("test.badge")}</span>
      <span className="hidden min-w-[0] truncate @desktop:inline">{t("test.note")}</span>
      <span className="shrink-0 tabular-nums">{position}</span>
      {!finished && <span className="hidden shrink-0 tabular-nums @tablet:inline">{t("test.remaining", { minutes: session.remaining_minutes })}</span>}
      {!finished && (
        <button type="button" className={BAR_BUTTON} disabled={pausing} onClick={onPause}>
          {t("test.pause")}
        </button>
      )}
    </ImmersiveProgress>
  );
}
