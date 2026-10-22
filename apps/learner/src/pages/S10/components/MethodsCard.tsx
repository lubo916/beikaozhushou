// feat:S10-03 建议学法：按知识类型给学、记、练、测四格，点格子直接去做（学去阅读器、记去复习与卡片，练与测接后端前提示“即将上线”）。
// 四格的说明文字按知识类型放在文案文件里（vocabulary.md 第 2 节：说明文字，不是枚举）。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S10Methods } from "@exam-prep/contract";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Card } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const STEPS = ["learn", "memorize", "practice", "test"] as const;
type Step = (typeof STEPS)[number];

const CELL =
  "flex h-full w-full flex-col items-start gap-1 rounded-md border border-line-strong bg-bg-surface p-3 text-left hover:border-brand-primary";

/** 这一格点了去哪（路由表里的路径）；没有去处的接后端前提示“即将上线”。 */
function targetOf(step: Step, methods: S10Methods): string | undefined {
  if (step === "learn" && methods.reader_doc_id !== undefined) return pathTo("S12", { docId: methods.reader_doc_id });
  if (step === "memorize") return pathTo("S15");
  return undefined;
}

export function MethodsCard({ methods }: { methods: S10Methods }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const type = methods.knowledge_type;
  return (
    <Card
      title={t("methods.title")}
      footer={<p className="text-small text-ink-tertiary">{t("methods.note", { type: VOCAB.knowledge_type[type] })}</p>}
    >
      <ul className="grid grid-cols-2 gap-2 @tablet:grid-cols-4">
        {STEPS.map((step) => {
          const body: ReactNode = (
            <>
              <span className="font-bold">{t(`methods.step.${step}`)}</span>
              <span className="text-small text-ink-secondary">{t(`methods.${type}.${step}`)}</span>
            </>
          );
          const to = targetOf(step, methods);
          return (
            <li key={step}>
              {to === undefined ? (
                <button type="button" className={CELL} onClick={() => toast(t(`soon.${step}`))}>
                  {body}
                </button>
              ) : (
                <Link to={to} className={CELL}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
