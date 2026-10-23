import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S29QuickTable, S29SearchPage } from "@exam-prep/contract";
import { AiContent, Card, DataTable, PageState, Tag } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

function QuickTable({ table }: { table: S29QuickTable }) {
  const { t } = useTranslation("S29");
  return (
    <DataTable
      caption={table.title}
      stackOnNarrow
      rowKey={(row) => row.id}
      rows={table.rows}
      columns={[
        { key: "label", header: t("quick.label"), label: t("quick.label"), render: (row) => row.label },
        {
          key: "value",
          header: t("quick.value"),
          label: t("quick.value"),
          render: (row) => (
            <span className="s29-quick-cell">
              <span>{row.value}</span>
              <Link to={pathTo("S10", { kpId: row.point_id })} aria-label={t("quick.point_named", { name: row.label })}>
                {t("quick.point")}
              </Link>
            </span>
          ),
        },
      ]}
    />
  );
}

export function QuickTables({ data, onSelect }: { data: S29SearchPage; onSelect: (id: string) => void }) {
  const { t } = useTranslation("S29");
  const selected = data.quick_tables.find((table) => table.id === data.selected_table);
  // feat:S29-04 速查表由接口按知识类型汇集（数值与时限、公式与步骤、条文、术语、易混对照），页面不计算公式、不生成条文；
  // AI 汇成的表用公共 AiContent 包起来（显式标识，复制时带“AI 生成”，红线 4）。
  return (
    <Card title={t("quick.title")}>
      <p className="s29-hint">{t("quick.body")}</p>
      {selected === undefined ? (
        <PageState compact state="insufficient_data" title={t("quick.empty")} body={t("state.insufficient_data.body")} />
      ) : (
        <>
          <label className="s29-select">
            {t("quick.choose")}
            <select value={data.selected_table} onChange={(event) => onSelect(event.target.value)}>
              {data.quick_tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {t(`quick.${table.category}`)}
                </option>
              ))}
            </select>
          </label>
          <h3 className="s29-table-title">{selected.title}</h3>
          <div className="flex gap-2">
            <Tag>{t(`quick.${selected.category}`)}</Tag>
          </div>
          {selected.ai_generated ? (
            <AiContent className="s29-ai">
              <QuickTable table={selected} />
            </AiContent>
          ) : (
            <QuickTable table={selected} />
          )}
        </>
      )}
    </Card>
  );
}
