import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S33Field, S33Group, S33Settings } from "@exam-prep/contract";
import { Banner, Button, Card, Columns, Dialog, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { PreferenceField } from "../components/PreferenceField.tsx";

export function SettingsPanel({ group, data }: { group: S33Group; data: S33Settings }) {
  const { t } = useTranslation("S33");
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ field: S33Field; value: string } | null>(null);
  const [security, setSecurity] = useState<"password" | "phone" | null>(null);
  function change(field: S33Field, value: string) {
    // feat:S33-04 新卡上限改变先提示；是否调高与未来复习量由服务端负责，页面不计算。
    // feat:S33-18 关闭辅助开关前解释证据代价，明确确认才改变本地预览。
    if (field.id === "new_limit" || (field.caution && value === "disabled")) setPending({ field, value });
    else setDraft((previous) => ({ ...previous, [field.id]: value }));
  }
  const soon = () => toast(t("soon"));
  const selected = (field: S33Field) => draft[field.id] ?? field.value;
  const rows = (ids?: readonly string[]) =>
    group.fields
      .filter((field) => ids === undefined || ids.includes(field.id))
      .map((field) => <PreferenceField key={field.id} field={field} value={selected(field)} onChange={(value) => change(field, value)} />);
  const footer = (
    <Button variant="primary" onClick={() => toast(t("preview"))}>
      {t("save")}
    </Button>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {group.id === "learning" && (
        <Columns
          className="s33-learning"
          main={
            <Card title={t("sections.rhythm")} footer={footer}>
              {/* feat:S33-02 学习节奏与计划保持相同设置 */}
              {rows(["daily_minutes", "pace"])}
              {/* feat:S33-18 辅助开关与证据等级代价 */}
              {rows(["confidence", "reading_check"])}
              <p className="text-small text-ink-secondary">{t("hint.evidence")}</p>
            </Card>
          }
          aside={
            <Card title={t("sections.memory")}>
              {/* feat:S33-05 平台允许的记忆参数来自接口选项 */}
              <p className="text-small text-ink-secondary">{t("hint.bounds")}</p>
              {rows(["retention", "review_limit", "new_limit"])}
              <Banner tone="warning" title={t("field.new_limit.label")}>
                {t("hint.new_cards")}
              </Banner>
            </Card>
          }
        />
      )}
      {group.id === "tutor" && (
        <>
          {/* feat:S33-06 导师偏好；feat:S33-07 阅读与标注 */}
          <Card title={t("tabs.tutor")} footer={footer}>
            {rows()}
          </Card>
          <Link to={pathTo("S13")} className={buttonClass("secondary")}>
            {t("actions.classroom")}
          </Link>
        </>
      )}
      {group.id === "reminders" && (
        <>
          {/* feat:S33-03 分类、通道、时段与免打扰；频控和夜间拦截由通知服务执行 */}
          <Banner title={t("sections.delivery")}>{t("hint.reminders")}</Banner>
          <Card title={t("tabs.reminders")} footer={footer}>
            {rows()}
            <p className="text-small text-ink-secondary">{t("hint.quiet")}</p>
          </Card>
        </>
      )}
      {group.id === "appearance" && (
        <>
          {/* feat:S33-08 外观；feat:S33-10 无障碍 */}
          <Card title={t("tabs.appearance")} footer={footer}>
            {rows()}
            <p className="text-small text-ink-secondary">{t("hint.accessibility")}</p>
          </Card>
          {/* feat:S33-09 多端与离线 */}
          <Card title={t("sections.devices")}>
            <p>{t("hint.offline")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={soon}>{t("actions.handoff")}</Button>
              <Button onClick={soon}>{t("actions.offline")}</Button>
            </div>
          </Card>
        </>
      )}
      {group.id === "account" && (
        <>
          {/* feat:S33-15 头像与昵称，敏感词与仿冒检查留给服务端 */}
          <Card title={t("tabs.account")} footer={footer}>
            <p className="font-medium">{data.user.display_name}</p>
            {rows()}
            <p className="text-small text-ink-secondary">{t("hint.nickname")}</p>
            <Button onClick={soon}>{t("actions.avatar")}</Button>
          </Card>
          {/* feat:S33-01 修改密码；feat:S33-14 两步换绑；feat:S33-16 未绑手机号出路 */}
          <Card title={t("sections.security")}>
            <p>
              {data.phone_bound ? t("security.bound") : t("security.unbound")} {data.phone_mask}
            </p>
            <p className="my-3 text-small text-ink-secondary">{t("hint.account")}</p>
            {!data.phone_bound && (
              <Banner tone="warning" title={t("security.unbound")}>
                {t("hint.bind")}
              </Banner>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setSecurity("password")}>{t("actions.password")}</Button>
              <Button onClick={() => setSecurity("phone")}>{t(data.phone_bound ? "actions.phone" : "actions.bind")}</Button>
              <Link to={pathTo("S32")} className={buttonClass("secondary")}>
                {t("actions.privacy")}
              </Link>
            </div>
          </Card>
          {/* feat:S33-11 帮助与引导 */}
          <Card title={t("sections.guide")}>
            <div className="flex flex-wrap gap-2">
              <Button onClick={soon}>{t("actions.guide")}</Button>
              <Button onClick={soon}>{t("actions.hints")}</Button>
              <Link to={pathTo("S35")} className={buttonClass("secondary")}>
                {t("actions.help")}
              </Link>
            </div>
          </Card>
        </>
      )}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t("confirm.title")}
        description={t(`confirm.${pending?.field.id === "new_limit" ? "new_cards" : (pending?.field.id ?? "new_cards")}`)}
        actions={
          <>
            <Button onClick={() => setPending(null)}>{t("confirm.cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pending !== null) setDraft((previous) => ({ ...previous, [pending.field.id]: pending.value }));
                setPending(null);
              }}
            >
              {t("confirm.confirm")}
            </Button>
          </>
        }
      />
      <Dialog
        open={security !== null}
        onClose={() => setSecurity(null)}
        title={t(security === "password" ? "security.password_title" : "security.phone_title")}
        description={t("security.verification")}
        actions={<Button onClick={soon}>{t(security === "password" ? "security.verify" : "security.phone_verify")}</Button>}
      >
        {security === "password" ? (
          <div className="flex flex-col gap-3">
            <label>
              {t("security.old_password")}
              <input autoComplete="off" type="password" className="mt-1 w-full rounded-sm border border-line-strong p-2" />
            </label>
            <label>
              {t("security.new_password")}
              <input autoComplete="off" type="password" className="mt-1 w-full rounded-sm border border-line-strong p-2" />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.phone_bound && (
              <label>
                {t("security.old_code")}
                <input autoComplete="off" className="mt-1 w-full rounded-sm border border-line-strong p-2" />
              </label>
            )}
            <label>
              {t("security.new_phone")}
              <input autoComplete="off" type="tel" className="mt-1 w-full rounded-sm border border-line-strong p-2" />
            </label>
            <label>
              {t("security.new_code")}
              <input autoComplete="off" className="mt-1 w-full rounded-sm border border-line-strong p-2" />
            </label>
          </div>
        )}
      </Dialog>
    </div>
  );
}
