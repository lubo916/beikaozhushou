import { useTranslation } from "react-i18next";
import type { S02ExamChoice, S02GoalsHome } from "@exam-prep/contract";
import { formatDate, formatPercent, formatScore } from "@exam-prep/shared/format";
import { Banner, Button, Card, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function ManageView({
  data,
  onAdd,
  onEdit,
  offline = false,
}: {
  data: S02GoalsHome;
  onAdd: () => void;
  onEdit: (choice: S02ExamChoice) => void;
  offline?: boolean;
}) {
  const { t } = useTranslation("S02");
  const toast = useToast();
  const soon = () => toast(t("soon"));
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S02-08 目标主页；feat:S02-10 管理态置顶目标表；feat:S02-12 多目标主次、重叠率与冲突。 */}
      <Card
        title={t("manage.title")}
        meta={t("manage.subtitle")}
        actions={
          <Button variant="primary" onClick={onAdd} disabled={offline}>
            {t("manage.add")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {data.goals.map((goal) => (
            <article className="rounded-sm border border-line-soft p-3" key={goal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{goal.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Tag tone={goal.primary ? "brand" : "neutral"}>
                      {t(goal.primary ? "manage.primary_label" : "manage.secondary_label")}
                    </Tag>
                    <Tag>{t(`manage.status.${goal.status}`)}</Tag>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const choice = [...data.catalog, ...data.templates].find((item) => item.profile.exam_id === goal.exam_id);
                      if (choice !== undefined) onEdit({ ...choice, target_date: goal.target_date, target_score: goal.target_score });
                      else soon();
                    }}
                    disabled={offline}
                  >
                    {t("manage.edit")}
                  </Button>
                  {!goal.primary && (
                    <Button size="sm" onClick={soon} disabled={offline}>
                      {t("manage.primary")}
                    </Button>
                  )}
                  <Button size="sm" onClick={soon} disabled={offline}>
                    {t("manage.pause")}
                  </Button>
                  <Button size="sm" onClick={soon} disabled={offline}>
                    {t("manage.archive")}
                  </Button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 @content-md:grid-cols-4">
                <div>
                  <dt className="text-small text-ink-tertiary">{t("manage.date")}</dt>
                  <dd>{formatDate(goal.target_date, { year: true })}</dd>
                </div>
                <div>
                  <dt className="text-small text-ink-tertiary">{t("manage.score")}</dt>
                  <dd className="font-bold text-brand-primary">{formatScore(goal.target_score)}</dd>
                </div>
                <div>
                  <dt className="text-small text-ink-tertiary">{t("manage.map")}</dt>
                  <dd>{goal.map_source}</dd>
                </div>
                <div>
                  <dt className="text-small text-ink-tertiary">{t("manage.overlap")}</dt>
                  <dd>{formatPercent(goal.overlap)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Card>
      {data.conflict !== "" && (
        <Banner tone="warning" title={t("manage.conflict")}>
          {data.conflict}
        </Banner>
      )}
      <div className="grid min-w-[0] grid-cols-1 gap-4 @content-md:grid-cols-2">
        {/* feat:S02-16 已过科目与有效期；录入写操作尚未登记权限。 */}
        <Card
          title={t("manage.passed")}
          actions={
            <Button size="sm" onClick={soon} disabled={offline}>
              {t("manage.passed_add")}
            </Button>
          }
        >
          {data.passed_subjects.length === 0 ? (
            <p className="text-ink-tertiary">{t("manage.no_passed")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.passed_subjects.map((subject) => (
                <li key={subject.name} className="flex flex-wrap justify-between gap-2">
                  <span>{subject.name}</span>
                  <span className="text-small text-ink-secondary">
                    {t("manage.expires", { date: formatDate(subject.expires_on, { year: true }) })}{" "}
                    <Tag tone="warning">{subject.status}</Tag>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {/* feat:S02-17 按报考年度匹配地图版本，新版未发布如实显示待更新。 */}
        <Card title={t("manage.maps")}>
          <ul className="flex flex-col gap-3">
            {data.catalog
              .filter((choice) => data.goals.some((goal) => goal.exam_id === choice.profile.exam_id))
              .map((choice) => (
                <li key={choice.id} className="flex flex-wrap justify-between gap-2">
                  <span>{choice.short_name}</span>
                  <span className="text-small">
                    {choice.map_version} {choice.map_pending && <Tag tone="warning">{t("profile.pending")}</Tag>}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
        {/* feat:S02-18 证书路径使用接口给的先后次序与有效期说明。 */}
        <Card title={t("manage.certificate")}>
          {data.certificate_path.length === 0 ? (
            <p>{t("manage.no_path")}</p>
          ) : (
            <ol className="flex list-inside list-decimal flex-col gap-3">
              {data.certificate_path.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </Card>
        {/* feat:S02-13 再战继承。 */}
        <Card
          title={t("manage.inherit")}
          footer={
            <Button onClick={soon} disabled={offline}>
              {t("manage.inherit_action")}
            </Button>
          }
        >
          <p className="text-ink-secondary">{t("manage.inherit_body")}</p>
        </Card>
        {/* feat:S02-14 扩展包挂载入口。 */}
        <Card
          title={t("manage.extensions")}
          actions={
            <Button size="sm" onClick={soon} disabled={offline}>
              {t("manage.extension_action")}
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            {data.extensions.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
