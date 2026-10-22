import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { pathTo } from "../../routes.ts";
import { useTranslation } from "react-i18next";
import type { S17PracticeCenter } from "@exam-prep/contract";
import { AiContent, Button, Dialog, Segmented, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import type { DialogKind } from "./views/PracticeViews.tsx";
function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <label className="s17-field">
      <span>{label}</span>
      {children ?? <input className="s17-input" />}
    </label>
  );
}
export function PracticeDialog({ kind, data, close }: { kind: DialogKind | null; data: S17PracticeCenter | undefined; close: () => void }) {
  const { t } = useTranslation("S17");
  const toast = useToast();
  const [step, setStep] = useState("basic");
  const soon = () => toast(t("soon"));
  const questionTypes = t("form.questionTypes", { returnObjects: true }) as string[];
  const knowledgeTypes = t("form.knowledgeTypes", { returnObjects: true }) as string[];
  const typeField = (
    <Field label={t("form.type")}>
      <select className="s17-input">
        {questionTypes.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </Field>
  );
  const scopeField = (
    <Field label={t("form.scope")}>
      <select className="s17-input">
        <option>{data?.recommendation.point_name}</option>
        <option>{t("banks.all")}</option>
      </select>
    </Field>
  );
  const stages = ["basic", "scope", "conditions", "quantity"] as const;
  const stepTitles = t("form.steps", { returnObjects: true }) as string[];
  const current = stages.indexOf(step as (typeof stages)[number]);
  return (
    <Dialog
      open={kind !== null}
      onClose={close}
      title={kind ? t("dialog." + kind + ".title") : ""}
      description={kind ? t("dialog." + kind + ".body") : ""}
      actions={
        <>
          <Button onClick={close}>{t("cancel")}</Button>
          {kind === "auto" ? (
            <>
              <Button disabled={current === 0} onClick={() => setStep(stages[current - 1] ?? "basic")}>
                {t("form.previous")}
              </Button>
              <Button variant="primary" onClick={() => (current === stages.length - 1 ? soon() : setStep(stages[current + 1] ?? "basic"))}>
                {t(current === stages.length - 1 ? "form.create" : "form.next")}
              </Button>
            </>
          ) : (
            <Button variant={kind === "tutor" ? "ai" : "primary"} onClick={soon}>
              {t(
                kind === "newQuestion"
                  ? "form.save"
                  : kind === "settings"
                    ? "form.saveSettings"
                    : kind === "import"
                      ? "form.validate"
                      : kind === "photo"
                        ? "form.choosePhoto"
                        : kind === "tutor"
                          ? "form.startGenerate"
                          : kind === "bank"
                            ? "form.saveBank"
                            : kind === "past" || kind === "special"
                              ? "practice"
                              : "form.print",
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="s17-fields">
        {kind === "past" && (
          <>
            <Field label={t("form.year")}>
              <input className="s17-input" type="number" />
            </Field>
            <Field label={t("form.region")} />
            <Field label={t("form.paperSource")}>
              <select className="s17-input">
                {["official", "licensed", "memory"].map((key) => (
                  <option key={key}>{t("form." + key)}</option>
                ))}
              </select>
            </Field>
            <Link className={buttonClass()} to={pathTo("S22")}>
              {t("form.mockCenter")}
            </Link>
          </>
        )}
        {kind === "special" && (
          <>
            {typeField}
            {scopeField}
            <Field label={t("form.practiceMode")}>
              <select className="s17-input">
                <option>{t("form.timed")}</option>
                <option>{t("form.inClass")}</option>
              </select>
            </Field>
            <Field label={t("form.perQuestion")}>
              <input className="s17-input" type="number" />
            </Field>
            <p className="s17-soft">{t("form.timedHint")}</p>
          </>
        )}

        {/* feat:S17-21 全部题型的编辑字段；feat:S17-07 关联知识点及强度 */}
        {kind === "newQuestion" && (
          <>
            {typeField}
            <Field label={t("form.stem")}>
              <textarea className="s17-input" />
            </Field>
            <Field label={t("form.answer")} />
            <Field label={t("form.analysis")}>
              <textarea className="s17-input" />
            </Field>
            {scopeField}
            <Field label={t("form.strength")}>
              <select className="s17-input">
                <option>{t("form.strengthHigh")}</option>
                <option>{t("form.strengthLow")}</option>
              </select>
            </Field>
            <Field label={t("form.knowledge")}>
              <select className="s17-input">
                {knowledgeTypes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label={t("form.difficulty")}>
              <select className="s17-input">
                <option>{t("form.difficultyNormal")}</option>
              </select>
            </Field>
            <Field label={t("form.rubric")}>
              <textarea className="s17-input" />
            </Field>
            <Field label={t("form.tags")} />
            <p className="s17-soft">{t("form.editHint")}</p>
          </>
        )}
        {/* feat:S17-10 拍照识题先问意图，再切分多题 */}
        {kind === "photo" && (
          <>
            <Field label={t("form.intent")}>
              <select className="s17-input">
                <option>{t("form.intentAnalysis")}</option>
                <option>{t("form.intentMistake")}</option>
                <option>{t("form.intentSimilar")}</option>
              </select>
            </Field>
            <Field label={t("form.choosePhoto")}>
              <input className="s17-input" type="file" accept="image/*" capture="environment" />
            </Field>
          </>
        )}
        {/* feat:S17-04 批量导入预标注、逐行校验及错误明细入口 */}
        {kind === "import" && (
          <>
            <Field label={t("form.chooseFile")}>
              <input className="s17-input" type="file" accept=".csv,.xlsx,.docx,.pdf,image/*" multiple />
            </Field>
            <AiContent>
              <p>{t("dialog.import.body")}</p>
            </AiContent>
            <h3>{t("form.validation")}</h3>
            <p>{t("form.validationHint")}</p>
          </>
        )}
        {/* feat:S17-11 导师出题默认先做后核，执行前展示额度 */}
        {kind === "tutor" && (
          <>
            <AiContent>
              <p>{t("notice.evidence")}</p>
            </AiContent>
            <p>{t("notice.cost", { cost: data?.ai.cost_label ?? "" })}</p>
            {typeField}
            {scopeField}
            <Field label={t("form.requirements")}>
              <textarea className="s17-input" />
            </Field>
            <Field label={t("form.mode")}>
              <select className="s17-input">
                <option>{t("form.blind")}</option>
                <option>{t("form.preview")}</option>
              </select>
            </Field>
          </>
        )}
        {/* feat:S17-14 题库与试卷各自保存做题设置 */}
        {kind === "settings" && (
          <>
            <Field label={t("form.scopeBank")}>
              <select className="s17-input">
                <option>{t("form.bankScope")}</option>
                <option>{t("form.paperScope")}</option>
              </select>
            </Field>
            {["shuffle", "shuffleOptions", "calculator"].map((key) => (
              <label className="s17-check" key={key}>
                <input type="checkbox" />
                {t("form." + key)}
              </label>
            ))}
            <Field label={t("form.scoring")}>
              <select className="s17-input">
                <option>{t("form.scoringDefault")}</option>
              </select>
            </Field>
          </>
        )}
        {/* feat:S17-08 基本信息、范围、条件、数量四步自动组卷 */}
        {kind === "auto" && (
          <>
            <Segmented
              label={t("banks.auto")}
              value={step}
              onChange={setStep}
              options={stages.map((value, index) => ({ value, label: stepTitles[index] ?? value }))}
            />
            {step === "basic" && (
              <Field label={t("form.name")}>
                <input className="s17-input" placeholder={t("form.namePlaceholder")} />
              </Field>
            )}
            {step === "scope" && scopeField}
            {step === "conditions" && (
              <>
                {typeField}
                <Field label={t("form.difficulty")}>
                  <select className="s17-input">
                    <option>{t("form.difficultyNormal")}</option>
                  </select>
                </Field>
                <label className="s17-check">
                  <input type="checkbox" defaultChecked />
                  {t("banks.core")}
                </label>
              </>
            )}
            {step === "quantity" && (
              <>
                <Field label={t("form.quantity")}>
                  <input className="s17-input" type="number" defaultValue={data?.recommendation.question_count} />
                </Field>
                <p>{t("form.quantityHint")}</p>
              </>
            )}
          </>
        )}
        {/* feat:S17-13 手动挑选、编排与打印；feat:S17-24 大题分部分与标题/分值 */}
        {kind === "manual" && (
          <>
            <Field label={t("form.sectionTitle")}>
              <input className="s17-input" defaultValue={t("banks.section")} />
            </Field>
            <Field label={t("form.score")}>
              <input className="s17-input" type="number" />
            </Field>
            {data?.questions.map((q) => (
              <div className="s17-stack" key={q.id}>
                <label className="s17-check">
                  <input type="checkbox" />
                  <span>{q.title}</span>
                </label>
                <div className="s17-row">
                  <Tag>{q.type_label}</Tag>
                  <Field label={t("form.questionNumber")}>
                    <input className="s17-input" type="number" />
                  </Field>
                  <Button size="sm" onClick={soon}>
                    {t("form.move")}
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={soon}>{t("form.answerSheet")}</Button>
          </>
        )}
        {kind === "bank" && <Field label={t("form.name")} />}
      </div>
    </Dialog>
  );
}
