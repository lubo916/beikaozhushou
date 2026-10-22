import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatCount, formatDateTime } from "@exam-prep/shared/format";
import { Button, Card, Columns, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { Row, Rows, secondary, type ViewProps } from "../components/parts.tsx";
export function AccountView({ data, confirm, soon, exportData }: ViewProps) {
  const { t } = useTranslation("S32");
  const date = (value: string) => formatDateTime(value, data.time_zone);
  return (
    <Columns
      main={
        <div className="flex flex-col gap-4">
          {/* feat:S32-01 任一设备均能发起下线，包括当前设备。 */}
          <Card
            title={t("account.devices.title")}
            actions={
              <Button size="sm" onClick={() => confirm("all_offline")}>
                {t("account.devices.all")}
              </Button>
            }
          >
            <Rows>
              {data.devices.map((device) => (
                <Row
                  key={device.id}
                  actions={
                    <Button size="sm" onClick={() => confirm("offline", { name: device.name })}>
                      {t("account.devices.offline")}
                    </Button>
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    <p className="font-medium">{device.name}</p>
                    {device.current && <Tag tone="brand">{t("account.devices.current")}</Tag>}
                  </div>
                  <p className={secondary}>
                    {device.location} · {t("account.devices.last", { date: date(device.last_active) })}
                  </p>
                </Row>
              ))}
            </Rows>
          </Card>
          {/* feat:S32-22 新地点登录提醒。 feat:S32-30 本人记常用地点，非本人改密并全部下线。 */}
          {data.logins
            .filter((login) => login.unusual)
            .map((login) => (
              <Card key={login.id} title={t("account.alert.title")} tone="warning">
                <p>{t("account.alert.body", { location: login.location, device: login.device })}</p>
                <p className={secondary}>{date(login.at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => confirm("mine")}>{t("account.alert.mine")}</Button>
                  <Button variant="danger" onClick={() => confirm("not_mine")}>
                    {t("account.alert.not_mine")}
                  </Button>
                </div>
                <p className={secondary}>
                  {t("account.alert.mine_help")} {t("account.alert.not_mine_help")}
                </p>
              </Card>
            ))}
          {/* feat:S32-29 登录时间、设备、方式、地点；更早记录入口。 */}
          <Card
            title={t("account.logins.title")}
            actions={
              <Button size="sm" onClick={soon}>
                {t("account.logins.earlier")}
              </Button>
            }
          >
            <Rows>
              {data.logins.map((login) => (
                <Row key={login.id} actions={login.unusual ? <Tag tone="warning">{t("account.logins.unusual")}</Tag> : undefined}>
                  <p>
                    {login.device} · {login.location}
                  </p>
                  <p className={secondary}>
                    {date(login.at)} · {t("account.logins.method." + login.method)}
                  </p>
                </Row>
              ))}
            </Rows>
          </Card>
        </div>
      }
      aside={
        <div className="flex flex-col gap-4">
          {/* feat:S32-23 多次失败提醒与改密建议；安全提醒不可关闭。 */}
          <Card title={t("account.security.title")} meta={<Tag tone="success">{t("account.security.fixed")}</Tag>}>
            <p>{t("account.security.location")}</p>
            <p className="mt-3">{t("account.security.attempts")}</p>
            <Button className="mt-3" size="sm" onClick={soon}>
              {t("account.security.password")}
            </Button>
          </Card>
          {/* feat:S32-17 相机、麦克风、相册用途与使用时间。 */}
          <Card title={t("account.permissions.title")}>
            <Rows>
              {data.permissions.map((permission) => (
                <Row key={permission.key}>
                  <p className="font-medium">{t("account.permissions." + permission.key)}</p>
                  <p className={secondary}>
                    {t("account.permissions.purpose." + permission.purpose)} · {date(permission.at)}
                  </p>
                </Row>
              ))}
            </Rows>
          </Card>
          {/* feat:S32-10 未成年人自动开启，本人不可关闭；不硬编码年龄线。 */}
          <Card title={t("account.minor.title")}>
            <Tag tone={data.minor_mode ? "warning" : "neutral"}>{t(data.minor_mode ? "account.minor.on" : "account.minor.off")}</Tag>
            <p className="mt-3">{t("account.minor.body")}</p>
            <Link className={buttonClass("secondary", "sm")} to={pathTo("S33")}>
              {t("common.settings")}
            </Link>
          </Card>
          {/* feat:S32-09 注销范围、法定保存与冷静期；注销前完整导出。 */}
          <Card title={t("account.deregister.title")} tone="danger">
            {data.deregistration_pending ? (
              <PageState
                compact
                state="restricted"
                pageName={t("title")}
                title={t("state.restricted.title")}
                body={t("state.restricted.body", { days: formatCount(data.cooling_days) })}
                action={<Button onClick={soon}>{t("state.restricted.action")}</Button>}
              />
            ) : (
              <>
                <p>{t("account.deregister.body", { days: formatCount(data.cooling_days) })}</p>
                <Button className="mt-3" variant="danger" onClick={() => confirm("deregister", { days: formatCount(data.cooling_days) })}>
                  {t("account.deregister.action")}
                </Button>
              </>
            )}
            <Button className="mt-3" onClick={exportData}>
              {t("export.all")}
            </Button>
          </Card>
        </div>
      }
    />
  );
}
