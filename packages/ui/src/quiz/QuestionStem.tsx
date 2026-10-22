// 题干（共用作答组件，S18-01）：题型、知识点、题源标签一行，下面是材料（材料组合题）与题干原文。只显示，不判断。
import type { ReactNode } from "react";
import { Tag } from "../basic/Tag.tsx";
import { fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import copy from "./copy.zh-CN.json";

export interface QuestionStemProps {
  stem: string;
  /** 题型的叫法（如“单选”），页面按题型代码取好传入。 */
  typeLabel?: string | undefined;
  /** 知识点名称。 */
  pointLabel?: string | undefined;
  /** 题源标签（可信度、AI 生成、待你确认等），页面拼好传入。 */
  source?: ReactNode;
  /** 材料组合题的材料原文。 */
  material?: string | undefined;
  className?: string | undefined;
}

export function QuestionStem({ stem, typeLabel, pointLabel, source, material, className }: QuestionStemProps) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2 text-small text-ink-secondary">
        {typeLabel !== undefined && <Tag size="sm">{typeLabel}</Tag>}
        {pointLabel !== undefined && <span>{fill(copy.stem.point, { name: pointLabel })}</span>}
        {source}
      </div>
      {material !== undefined && (
        <section aria-label={copy.material.title} className="whitespace-pre-line rounded-md bg-bg-sunk px-4 py-3 text-ink-secondary">
          <p className="mb-1 text-small font-bold text-ink-primary">{copy.material.title}</p>
          {material}
        </section>
      )}
      <p className="whitespace-pre-line text-ink-primary">{stem}</p>
    </div>
  );
}
