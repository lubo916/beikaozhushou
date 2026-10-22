import { useTranslation } from "react-i18next";
import { formatCount } from "@exam-prep/shared/format";
import { Button, Card, Columns, Tag } from "@exam-prep/ui";
import { Row, Rows, secondary, type ViewProps } from "../components/parts.tsx";
export function PrivacyView({ data, confirm, exportData }: ViewProps) {
  const { t } = useTranslation("S32");
  return (
    <Columns
      main={
        <div className="flex flex-col gap-4">
          {/* feat:S32-03 机构任务按约定可见；个人逐项默认关闭，敏感内容永不开放。 */}
          <Card title={t("privacy.organization.title")} meta={data.organization_name}>
            <p className={secondary}>{t("privacy.organization.subtitle", { name: data.organization_name })}</p>
            <Rows>
              {data.institution_grants.map((grant) => (
                <Row
                  key={grant.key}
                  actions={
                    grant.editable ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={grant.enabled}
                        aria-label={t("privacy.organization." + grant.key)}
                        className="ui-btn ui-btn--secondary"
                        onClick={() => confirm("authorization", { name: t("privacy.organization." + grant.key) })}
                      >
                        {t(grant.enabled ? "common.enabled" : "common.disabled")}
                      </button>
                    ) : (
                      <Tag tone={grant.key === "tasks" ? "brand" : "neutral"}>
                        {t(grant.key === "tasks" ? "privacy.organization.locked" : "privacy.organization.never")}
                      </Tag>
                    )
                  }
                >
                  <p className="font-medium">{t("privacy.organization." + grant.key)}</p>
                  <p className={secondary}>{t("privacy.organization." + grant.key + "_help")}</p>
                </Row>
              ))}
            </Rows>
            <p className={secondary}>{t("privacy.organization.notice")}</p>
          </Card>
          {/* feat:S32-04 个性化单独同意，可撤回。 feat:S32-05 自动化关闭后每次先问。 feat:S32-06 模型训练默认不授权。 */}
          <Card title={t("privacy.settings.title")}>
            <Rows>
              {data.settings.map((setting) => (
                <Row
                  key={setting.key}
                  actions={
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.enabled}
                      aria-label={t("privacy.settings." + setting.key)}
                      className="ui-btn ui-btn--secondary"
                      onClick={() => confirm("setting", { name: t("privacy.settings." + setting.key) })}
                    >
                      {t(setting.enabled ? "common.enabled" : "common.disabled")}
                    </button>
                  }
                >
                  <p className="font-medium">{t("privacy.settings." + setting.key)}</p>
                  <p className={secondary}>{t("privacy.settings." + setting.key + "_help")}</p>
                </Row>
              ))}
            </Rows>
          </Card>
        </div>
      }
      aside={
        <div className="flex flex-col gap-4">
          {/* feat:S32-02 数据总览的计数由接口提供。 */}
          <Card
            title={t("privacy.data.title")}
            actions={
              <Button size="sm" onClick={exportData}>
                {t("assets.tasks.export")}
              </Button>
            }
          >
            <Rows>
              {data.data_categories.map((category) => (
                <Row key={category.key} actions={<Tag>{t("common.count", { total: formatCount(category.count) })}</Tag>}>
                  <p className="font-medium">{t("privacy.data." + category.key)}</p>
                  <p className={secondary}>{t("privacy.data.purpose", { purpose: t("privacy.data." + category.key + "_help") })}</p>
                </Row>
              ))}
            </Rows>
          </Card>
          {/* feat:S32-07 只有内容文本发往模型，不带个人标识。 */}
          <Card title={t("privacy.tutor.title")}>
            <p>{t("privacy.tutor.body")}</p>
          </Card>
          {/* feat:S32-19 导师记忆逐条查看、逐条确认删除。 */}
          <Card title={t("privacy.tutor.memory")}>
            <p className={secondary}>{t("privacy.tutor.memory_help")}</p>
            <Rows>
              {data.memories.map((memory) => (
                <Row
                  key={memory.id}
                  actions={
                    <Button size="sm" onClick={() => confirm("delete_memory", { name: memory.text })}>
                      {t("privacy.tutor.delete_memory")}
                    </Button>
                  }
                >
                  <p>{memory.text}</p>
                </Row>
              ))}
            </Rows>
          </Card>
        </div>
      }
    />
  );
}
