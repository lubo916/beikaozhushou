// S01 账号异常独立视图：每种原因单独解释，只展示接口数据；未登记的账号写操作均提示即将上线。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { S01WelcomeData } from "@exam-prep/contract";
import { formatDateTime, formatDays, formatNumber } from "@exam-prep/shared/format";
import { Banner, Button, Card, PageState, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const ISSUES = ["banned", "devices", "cooling", "replaced", "forced", "password"] as const;
const TIME_ZONE = "Asia/Shanghai";

export interface AbnormalViewProps {
  readonly data: S01WelcomeData;
  readonly onLogin: (reset?: boolean) => void;
}

export function AbnormalView({ data, onLogin }: AbnormalViewProps) {
  const { t } = useTranslation("S01");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const [selectedDevice, setSelectedDevice] = useState("");
  const issue = ISSUES.find((value) => value === search.get("issue")) ?? "banned";
  const account = data.account;
  const isLogout = issue === "replaced" || issue === "forced" || issue === "password";

  function changeIssue(value: string) {
    const next = new URLSearchParams(search);
    next.set("view", "abn");
    next.set("issue", value);
    setSelectedDevice("");
    setSearch(next);
  }

  function continueWithDevice() {
    if (selectedDevice === "") {
      toast(t("account.devices.choose"));
      return;
    }
    toast(t("account.devices.soon"));
  }

  const title =
    issue === "banned"
      ? t("account.restricted.title")
      : issue === "devices"
        ? t("account.devices.title")
        : issue === "cooling"
          ? t("account.cooling.title")
          : t(`account.issue.${issue}`);
  const body =
    issue === "banned"
      ? t(account.restriction_reason_key)
      : issue === "devices"
        ? t("account.devices.body", { count: formatNumber(account.device_limit) })
        : issue === "cooling"
          ? t("account.cooling.remaining", { days: formatDays(account.cooling_days_remaining) })
          : t(`account.logout.${issue}`);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-small text-ink-secondary">
        <span>{t("account.issuesLabel")}</span>
        <select
          className="w-full rounded-sm border border-line-strong bg-bg-surface px-3 py-2 text-body text-ink-primary"
          value={issue}
          onChange={(event) => changeIssue(event.target.value)}
        >
          {ISSUES.map((value) => (
            <option key={value} value={value}>
              {t(`account.issue.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <PageState state="restricted" title={title} body={body} compact />

      {/* feat:S01-08 受限原因、期限与申诉；数据导出始终提供独立出路。 */}
      {issue === "banned" && (
        <Card tone="warning">
          <div className="flex flex-col gap-3">
            <p>{t("account.restricted.until", { time: formatDateTime(account.restricted_until, TIME_ZONE) })}</p>
            <p className="text-small text-ink-secondary">{t("account.restricted.reference", { reference: account.appeal_reference })}</p>
            <Button variant="primary" block onClick={() => toast(t("account.restricted.appealSoon"))}>
              {t("account.restricted.appeal")}
            </Button>
          </div>
        </Card>
      )}

      {/* feat:S01-19 设备上限只显示接口值；选择后才允许请求下线，取消不触发登录。 */}
      {issue === "devices" && (
        <Card>
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-3 font-medium">{t("account.devices.select")}</legend>
            {account.devices.map((device) => (
              <label key={device.id} className="flex cursor-pointer items-start gap-3 rounded-sm border border-line-strong bg-bg-sunk p-3">
                <input
                  type="radio"
                  name="s01-device"
                  value={device.id}
                  checked={selectedDevice === device.id}
                  onChange={() => setSelectedDevice(device.id)}
                  className="mt-1 accent-brand-primary"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{t(device.label_key)}</span>
                  <span className="text-small text-ink-secondary">
                    {t("account.devices.lastSeen", { time: formatDateTime(device.last_seen_at, TIME_ZONE) })}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" block onClick={continueWithDevice}>
              {t("account.devices.continue")}
            </Button>
            <Button block onClick={() => onLogin()}>
              {t("cancel")}
            </Button>
          </div>
        </Card>
      )}

      {/* feat:S01-20 展示剩余冷静期与删除范围；登录不会自动撤销注销。 */}
      {issue === "cooling" && (
        <Card tone="warning">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {account.deletion_scope_keys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" block onClick={() => toast(t("account.cooling.undoSoon"))}>
              {t("account.cooling.undo")}
            </Button>
            <Button block onClick={() => onLogin()}>
              {t("account.cooling.keep")}
            </Button>
          </div>
        </Card>
      )}

      {/* feat:S01-21 区分三类下线原因；暂存未提交内容，异常登录可直达重设密码。 */}
      {isLogout && (
        <Card>
          {account.drafts_available && <Banner tone="info">{t("account.logout.drafts")}</Banner>}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" block onClick={() => onLogin()}>
              {t("account.logout.login")}
            </Button>
            {issue === "replaced" && (
              <Button block onClick={() => onLogin(true)}>
                {t("account.logout.changePassword")}
              </Button>
            )}
          </div>
        </Card>
      )}

      <p className="text-small text-ink-secondary">{t("account.body")}</p>
      <div className="flex flex-wrap gap-2">
        <Link to={pathTo("S32")} className={buttonClass("secondary", "sm")}>
          {t("account.export")}
        </Link>
        <Link to={pathTo("S33")} className={buttonClass("ghost", "sm")}>
          {t("account.settings")}
        </Link>
        <Button variant="ghost" size="sm" onClick={() => toast(t("soon"))}>
          {t("account.feedback")}
        </Button>
      </div>
    </div>
  );
}
