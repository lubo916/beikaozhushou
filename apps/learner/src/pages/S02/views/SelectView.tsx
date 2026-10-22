import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S02ExamChoice, S02GoalsHome } from "@exam-prep/contract";
import { formatDate } from "@exam-prep/shared/format";
import { AiBadge, Button, Card, FilterChips, List, ListRow, PageState, Tabs, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { Field, fieldClass } from "../fields.tsx";

export type Source = "official" | "template" | "custom";
export function SelectView({
  data,
  source,
  onSource,
  query,
  onQuery,
  category,
  onCategory,
  onChoose,
  offline = false,
}: {
  data: S02GoalsHome;
  source: Source;
  onSource: (source: Source) => void;
  query: string;
  onQuery: (query: string) => void;
  category: string;
  onCategory: (category: string) => void;
  onChoose: (choice: S02ExamChoice, contents?: readonly string[]) => void;
  offline?: boolean;
}) {
  const { t } = useTranslation("S02");
  const toast = useToast();
  const [natural, setNatural] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState("");
  const [contents, setContents] = useState(["map", "questions", "materials"]);
  const choices = source === "template" ? data.templates : data.catalog;
  const custom = data.custom_choice;
  const chooseCustom = () => {
    if (custom !== undefined) onChoose({ ...custom, name: description.trim() || custom.name });
    else toast(t("soon"));
  };
  return (
    <Tabs
      label={t("source")}
      value={source}
      onChange={onSource}
      items={[
        { key: "official", label: t("tabs.official") },
        { key: "template", label: t("tabs.template") },
        { key: "custom", label: t("tabs.custom") },
      ]}
    >
      {source === "custom" ? (
        <Card title={t("custom.title")} meta={<AiBadge />}>
          {/* feat:S02-03 自建向导：一句话、文件、逐项确认；上传解析尚未接后端。 */}
          <div className="flex flex-col gap-4">
            <p className="text-ink-secondary">{t("custom.body")}</p>
            <Field label={t("custom.description")}>
              <textarea
                className={fieldClass}
                rows={4}
                value={description}
                placeholder={t("custom.placeholder")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label={t("custom.upload")}>
              <input
                className={fieldClass}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                disabled={offline}
                onChange={(event) => setFile(event.target.files?.[0]?.name ?? "")}
              />
            </Field>
            {file !== "" && <p className="text-small">{t("profile.selected_file", { name: file })}</p>}
            <p className="text-small text-ink-tertiary">{t("custom.upload_hint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => toast(t("soon"))} disabled={offline || (description.trim() === "" && file === "")}>
                {t("custom.parse")}
              </Button>
              <Button onClick={chooseCustom}>{t("custom.manual")}</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {source === "official" ? (
            <>
              {/* feat:S02-01 全称、简称、俗称、拼音搜索与类别筛选由接口层处理。 */}
              <Field label={t("catalog.search")}>
                <input
                  type="search"
                  className={fieldClass}
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder={t("catalog.search_placeholder")}
                  disabled={offline}
                />
              </Field>
              <FilterChips
                label={t("catalog.category")}
                options={[{ value: "", label: t("catalog.all") }, ...data.categories.map((value) => ({ value, label: value }))]}
                selected={[category]}
                multiple={false}
                onChange={(values) => onCategory(values[0] ?? "")}
              />
            </>
          ) : (
            <>
              {/* feat:S02-02 模板质量与部分内容导入；科目在确认面板逐项勾选。 */}
              <p className="text-ink-secondary">{t("template.intro")}</p>
              <fieldset className="rounded-sm border border-line-soft bg-bg-surface p-3">
                <legend className="px-1 text-small">{t("template.content")}</legend>
                <div className="flex flex-wrap gap-4">
                  {(["map", "questions", "materials"] as const).map((key) => (
                    <label className="flex items-center gap-2" key={key}>
                      <input
                        type="checkbox"
                        checked={contents.includes(key)}
                        onChange={(event) =>
                          setContents(event.target.checked ? [...contents, key] : contents.filter((item) => item !== key))
                        }
                      />
                      {t(`template.${key}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {source === "official" ? (
            <Card title={t("catalog.results")} flush>
              {/* feat:S02-09 就绪程度只展示接口给出的标注。 */}
              <List>
                {choices.map((choice) => (
                  <ListRow
                    key={choice.id}
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{choice.name}</span>
                        <Tag size="sm" tone={choice.readiness === "complete" ? "success" : "warning"}>
                          {t(`readiness.${choice.readiness}`)}
                        </Tag>
                      </span>
                    }
                    description={
                      <span className="flex flex-col gap-1">
                        <span>
                          {choice.category} · {choice.short_name}
                        </span>
                        <span>
                          {t("catalog.date")}：{formatDate(choice.target_date, { year: true })}{" "}
                          {choice.estimated && (
                            <Tag size="sm" tone="warning">
                              {t("profile.estimated")}
                            </Tag>
                          )}
                        </span>
                      </span>
                    }
                    action={
                      <Button size="sm" onClick={() => onChoose(choice)} disabled={offline}>
                        {t("catalog.choose")}
                      </Button>
                    }
                  />
                ))}
              </List>
            </Card>
          ) : (
            <div className="grid min-w-[0] grid-cols-1 gap-3">
              {/* feat:S02-09 五类就绪程度按接口数据诚实标注。 */}
              {choices.map((choice) => (
                <Card
                  key={choice.id}
                  as="article"
                  title={choice.name}
                  headingLevel={2}
                  meta={choice.short_name}
                  footer={
                    <Button
                      variant="primary"
                      onClick={() => onChoose(choice, source === "template" ? contents.map((key) => t(`template.${key}`)) : [])}
                      disabled={offline || (source === "template" && contents.length === 0)}
                    >
                      {t(source === "template" ? "template.choose" : "catalog.choose")}
                    </Button>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Tag>{choice.category}</Tag>
                      <Tag tone={choice.readiness === "complete" ? "success" : "warning"}>{t(`readiness.${choice.readiness}`)}</Tag>
                    </div>
                    <p className="text-small text-ink-secondary">{choice.summary}</p>
                    <p className="text-small">
                      {t("catalog.date")}：{formatDate(choice.target_date, { year: true })}{" "}
                      {choice.estimated && (
                        <Tag tone="warning" size="sm">
                          {t("profile.estimated")}
                        </Tag>
                      )}
                    </p>
                    {source === "template" && (
                      <div className="rounded-sm bg-bg-sunk p-2 text-small">
                        <p className="font-medium">{t("template.quality")}</p>
                        <p>{choice.template_quality}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {choices.length === 0 && (
            <PageState
              state="empty"
              title={t("catalog.no_results")}
              body={t("catalog.no_results_body")}
              action={
                <Button
                  onClick={() => {
                    onQuery("");
                    onCategory("");
                    onSource("custom");
                  }}
                >
                  {t("catalog.custom_action")}
                </Button>
              }
            />
          )}
          {source === "official" && (
            <Card title={t("catalog.natural")} meta={<AiBadge />}>
              {/* feat:S02-15 自然语言候选需用户确认，当前提示即将上线。 */}
              <div className="flex flex-col gap-3">
                <Field label={t("catalog.natural")}>
                  <input
                    className={fieldClass}
                    value={natural}
                    onChange={(event) => setNatural(event.target.value)}
                    placeholder={t("catalog.natural_placeholder")}
                    disabled={offline}
                  />
                </Field>
                <p className="text-small text-ink-tertiary">{t("catalog.natural_hint")}</p>
                <div>
                  <Button onClick={() => toast(t("soon"))} disabled={offline || natural.trim() === ""}>
                    {t("catalog.natural_action")}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </Tabs>
  );
}
