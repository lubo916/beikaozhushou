import { useTranslation } from "react-i18next";
import { formatNumber } from "@exam-prep/shared/format";
import type { S14Compilation } from "@exam-prep/contract";
import { AiContent, Button, Card, PageState, Segmented } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

// feat:S14-12 一本通按地图顺序；feat:S14-13 最后一页纸的权重与篇幅内容来自接口，不在页面计算。
export function CompilationView({
  data,
  paper,
  available,
  length,
  onLength,
}: {
  data: S14Compilation;
  paper: boolean;
  available: boolean;
  length: string;
  onLength: (value: string) => void;
}) {
  const { t } = useTranslation("S14");
  const toast = useToast();
  const sections = paper ? (data.lengths.find((item) => item.id === length)?.sections ?? []) : data.sections;
  return (
    <div className="flex flex-col gap-4">
      <Card title={data.title} meta={t("compilation.notes", { total: formatNumber(data.note_count) })}>
        <p className="text-ink-secondary">{data.description}</p>
      </Card>
      {paper && !available ? (
        <>
          <PageState state="insufficient_data" title={t("state.insufficient.title")} body={t("state.insufficient.body")} />
          <Card title={t("compilation.templateTitle")}>
            <p>{t("compilation.templateBody")}</p>
            <Button className="mt-3" onClick={() => toast(t("soon"))}>
              {t("compilation.template")}
            </Button>
          </Card>
        </>
      ) : (
        <>
          {paper && (
            <Segmented
              label={t("compilation.length")}
              options={data.lengths.map((item) => ({ value: item.id, label: item.label }))}
              value={length}
              onChange={onLength}
            />
          )}
          <AiContent note={t("compilation.preview")}>
            {sections.length === 0 ? (
              <p>{t("compilation.noHandbook")}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {sections.map((item) => (
                  <section key={item.id}>
                    <h3 className="mb-2 font-bold">{item.title}</h3>
                    <p className="whitespace-pre-wrap">{item.body}</p>
                    <p className="mt-2 text-small text-ink-tertiary">{t("compilation.origin", { origin: item.origin })}</p>
                  </section>
                ))}
              </div>
            )}
          </AiContent>
          <Button variant="primary" disabled={sections.length === 0} onClick={() => toast(t("soon"))}>
            {t("compilation.confirm")}
          </Button>
        </>
      )}
    </div>
  );
}
