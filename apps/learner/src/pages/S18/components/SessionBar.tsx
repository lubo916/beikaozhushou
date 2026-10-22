// 沉浸页顶栏右侧（放进外壳顶栏，ImmersiveProgress）：模式标签、题号点、第几题、计时；收藏、易错、报错。
// 手机上只留模式、第几题与报错（原型）；题号点与计时从平板起显示，收藏、易错在桌面显示。
import { useTranslation } from "react-i18next";
import type { S18QuizSession } from "@exam-prep/contract";
import { formatSeconds } from "@exam-prep/shared/format";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { cx } from "@exam-prep/ui";
import { QuestionNav } from "../../../../../../packages/ui/src/quiz/index.ts";
import { ImmersiveProgress } from "../../../app/page-context.tsx";
import { useToast } from "../../../app/toast.tsx";
import { navStatus } from "../data.ts";

const BAR_BUTTON = "shrink-0 rounded-sm border border-ink-tertiary px-3 py-1 text-small hover:bg-ink-secondary";

export interface SessionBarProps {
  readonly session: S18QuizSession;
  readonly current: number;
  readonly onSelect: (index: number) => void;
  /** 本组已用时（秒，接口给的起点加上这次打开后走过的时间）。 */
  readonly elapsed: number;
  /** 这次打开后我改过的标记。 */
  readonly flags: Readonly<Record<string, boolean>>;
}

export function SessionBar({ session, current, onSelect, elapsed, flags }: SessionBarProps) {
  const { t } = useTranslation("S18");
  const toast = useToast();
  const mode = vocabLabel("practice_mode", session.mode);
  const limit = session.time.limit_seconds;
  const items = session.items.map((item) => ({ key: item.id, status: navStatus(item), flagged: flags[item.id] ?? item.flagged }));
  // feat:S18-22 计时：限时模式显示剩余，超时不打断，只在小结里提示
  const clock =
    limit === undefined
      ? t("bar.elapsed", { time: formatSeconds(elapsed) })
      : elapsed <= limit
        ? t("bar.remaining", { time: formatSeconds(limit - elapsed) })
        : t("bar.overtime");
  return (
    <ImmersiveProgress>
      {/* feat:S18-02 四种模式：测评态不能切换（受限） */}
      {session.restrictions.mode_locked ? (
        <span className="shrink-0 rounded-full border border-ink-tertiary px-2 text-small">{mode}</span>
      ) : (
        <button
          type="button"
          aria-label={t("bar.switch_mode", { mode })}
          onClick={() => toast(t("soon.switch_mode"))}
          className="shrink-0 rounded-full border border-ink-tertiary px-2 text-small hover:bg-ink-secondary"
        >
          {mode}
        </button>
      )}
      {/* feat:S18-05 题号导航 */}
      <QuestionNav className="hidden @tablet:block" items={items} current={current} onSelect={onSelect} />
      <span className="shrink-0 tabular-nums">{t("bar.position", { n: current + 1, total: session.items.length })}</span>
      <span className="hidden shrink-0 tabular-nums @tablet:inline">{clock}</span>
      {/* feat:S18-19 收藏、标签与标记易错 */}
      <button type="button" className={cx(BAR_BUTTON, "hidden @desktop:inline-flex")} onClick={() => toast(t("soon.favorite"))}>
        {t("bar.favorite")}
      </button>
      <button type="button" className={cx(BAR_BUTTON, "hidden @desktop:inline-flex")} onClick={() => toast(t("soon.pitfall"))}>
        {t("bar.pitfall")}
      </button>
      {/* feat:S18-14 报错与处理进度 */}
      <button type="button" className={BAR_BUTTON} onClick={() => toast(t("soon.report"))}>
        {t("bar.report")}
      </button>
    </ImmersiveProgress>
  );
}
