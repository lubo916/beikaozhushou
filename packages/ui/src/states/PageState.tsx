import { useEffect, useState, type ReactNode } from "react";
import type { PageStateCode } from "@exam-prep/shared/vocab";
import { Button } from "../basic/Button.tsx";
import { KeyValueList, type KeyValueItem } from "../basic/Data.tsx";
import { Skeleton } from "../basic/Feedback.tsx";
import { Icon, type IconName } from "../basic/Icon.tsx";
import { COPY, fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";

export type AbnormalState = Exclude<PageStateCode, "normal">;

const ICONS: Record<Exclude<AbnormalState, "loading">, IconName> = {
  empty: "inbox",
  error: "alert",
  offline: "offline",
  restricted: "lock",
  insufficient_data: "chart",
  locked: "lock",
};

export interface PageStateProps {
  state: AbnormalState;
  /** 页名，用于出错文案“<页名>没能加载”。 */
  pageName?: string | undefined;
  /** 覆盖默认标题与正文（文案以 bk spec 的“七态”一节为准）。 */
  title?: ReactNode;
  body?: ReactNode;
  /** 主动作：空态给能做的事、受限给出路、锁定给“去修复”。 */
  action?: ReactNode;
  /** 出错时的两个按钮。 */
  onRetry?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
  /** 学员端（默认）与机构端、平台后台的出错写法不同。 */
  audience?: "learner" | "staff" | undefined;
  /** 加载超过几秒加一句慢速提示：页面传参数 ui.loading.slow_hint_seconds 的值；不传就不提示。 */
  slowHintAfterSeconds?: number | undefined;
  /** 加载时的骨架，默认几行占位。 */
  skeleton?: ReactNode;
  /** 数据不足时显示的原始计数。 */
  counts?: readonly KeyValueItem[] | undefined;
  /** 数据不足时还差什么。 */
  missing?: ReactNode;
  /** 放在卡片里时用紧凑版。 */
  compact?: boolean | undefined;
  className?: string | undefined;
}

function SlowHint({ seconds }: { seconds: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), seconds * 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return show ? <p className="ui-state__slow">{COPY.state.loading.slow}</p> : null;
}

/** 页面状态（七态里除正常以外的六种，加锁定）：每个页面都用它，不各写一套。 */
export function PageState(props: PageStateProps) {
  const { state, pageName = COPY.state.default_page, title, body, action, onRetry, onReport, audience = "learner", compact = false, className } = props;
  const page = { page: pageName };
  if (state === "loading") {
    return (
      <div role="status" aria-live="polite" className={cx("ui-state ui-state--loading", className)}>
        <span className="ui-visually-hidden">{fill(COPY.state.loading.label, page)}</span>
        {props.skeleton ?? <Skeleton title lines={4} block />}
        {props.slowHintAfterSeconds !== undefined && <SlowHint seconds={props.slowHintAfterSeconds} />}
      </div>
    );
  }
  const copy = COPY.state[state];
  const defaultBody = state === "error" && audience === "staff" ? COPY.state.error.body_staff : copy.body;
  return (
    <div role={state === "error" ? "alert" : "status"} className={cx("ui-state", `ui-state--${state}`, compact && "ui-state--compact", className)}>
      <span className="ui-state__icon" aria-hidden="true">
        <Icon name={ICONS[state]} />
      </span>
      <h2 className="ui-state__title">{title ?? fill(copy.title, page)}</h2>
      <p className="ui-state__body">{body ?? fill(defaultBody, page)}</p>
      {state === "insufficient_data" && props.counts !== undefined && props.counts.length > 0 && (
        <div className="ui-state__counts" aria-label={COPY.state.insufficient_data.counts}>
          <KeyValueList items={props.counts} />
        </div>
      )}
      {state === "insufficient_data" && props.missing !== undefined && <p className="ui-state__missing">{props.missing}</p>}
      {(action !== undefined || state === "error") && (
        <div className="ui-state__actions">
          {state === "error" && (
            <>
              <Button variant="primary" onClick={onRetry}>
                {COPY.action.retry}
              </Button>
              <Button onClick={onReport}>{COPY.action.report}</Button>
            </>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

export interface PageStatesProps extends Omit<PageStateProps, "state"> {
  state: PageStateCode;
  /** 正常态的内容。 */
  children: ReactNode;
}

/** 按状态切换：正常显示内容，其余显示对应的状态视图。 */
export function PageStates({ state, children, ...rest }: PageStatesProps) {
  return state === "normal" ? <>{children}</> : <PageState state={state} {...rest} />;
}
