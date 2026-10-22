import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S29SearchPage } from "@exam-prep/contract";
import { AiBadge, Card, DataTable, PageState, Tag } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
export function QuickTables({ data, onSelect }: { data: S29SearchPage; onSelect: (id: string) => void }) {
  const { t } = useTranslation("S29");
  const selected = data.quick_tables.find((table) => table.id === data.selected_table);
  // feat:S29-04 五类知识类型速查表由接口汇集，页面不计算公式、不生成条文。
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
            {selected.ai_generated && <AiBadge />}
          </div>
          <DataTable
            caption={selected.title}
            stackOnNarrow
            rowKey={(row) => row.id}
            rows={selected.rows}
            columns={[
              { key: "label", header: t("quick.label"), label: t("quick.label"), render: (row) => row.label },
              {
                key: "value",
                header: t("quick.value"),
                label: t("quick.value"),
                render: (row) => (
                  <>
                    {row.value}
                    <br />
                    <Link to={pathTo("S10", { kpId: row.point_id })}>{t("quick.point")}</Link>
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
}
