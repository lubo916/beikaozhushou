// 列表视图（feat:S09-01）：知识点、所在章、类型、当前档、目标档、性价比阶梯；点名字去知识点主页。窄屏时每行堆成一块。
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S09Chapter, S09Point } from "@exam-prep/contract";
import { EMPTY_VALUE } from "@exam-prep/shared/format";
import { VOCAB, masteryLabel } from "@exam-prep/shared/vocab";
import { DataTable } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { toRank } from "../data.ts";

interface Row {
  readonly point: S09Point;
  readonly chapter: string;
}

export function ListView({ chapters, locked }: { readonly chapters: readonly S09Chapter[]; readonly locked: boolean }) {
  const { t } = useTranslation("S09");
  const rows = useMemo(() => chapters.flatMap((chapter) => chapter.points.map((point): Row => ({ point, chapter: chapter.name }))), [chapters]);
  const current = (point: S09Point): string => {
    if (!point.in_scope) return t("tree.out");
    if (!point.evidence_sufficient) return t("tree.uncertain");
    return masteryLabel(toRank(point.level));
  };
  const roi = (point: S09Point): string => {
    if (locked) return t("list.locked");
    return point.roi_tier === undefined ? EMPTY_VALUE : VOCAB.roi_tier[point.roi_tier];
  };
  return (
    <DataTable
      caption={t("list.caption")}
      stackOnNarrow
      rows={rows}
      rowKey={(row) => row.point.id}
      columns={[
        { key: "name", header: t("list.name"), label: t("list.name"), render: (row) => <Link to={pathTo("S10", { kpId: row.point.id })}>{row.point.name}</Link> },
        { key: "chapter", header: t("list.chapter"), label: t("list.chapter"), render: (row) => row.chapter },
        {
          key: "type",
          header: t("list.type"),
          label: t("list.type"),
          render: (row) => row.point.knowledge_types.map((type) => VOCAB.knowledge_type[type]).join(t("joiner")),
        },
        { key: "current", header: t("list.current"), label: t("list.current"), render: (row) => current(row.point) },
        {
          key: "target",
          header: t("list.target"),
          label: t("list.target"),
          render: (row) => (row.point.target_level === undefined ? t("list.no_target") : masteryLabel(toRank(row.point.target_level))),
        },
        { key: "roi", header: t("list.roi"), label: t("list.roi"), render: (row) => roi(row.point) },
      ]}
    />
  );
}
