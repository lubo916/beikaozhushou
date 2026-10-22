import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S11MaterialRow, S11Workspace } from "@exam-prep/contract";
import { formatPercent } from "@exam-prep/shared/format";
import { Banner, Button, Card, DataTable, Dialog, ProgressBar, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function MaterialsView({ data }: { data: S11Workspace }) {
  const { t } = useTranslation("S11");
  const toast = useToast();
  const soon = () => toast(t("soon"));
  const [selected, setSelected] = useState<S11MaterialRow>();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [dialog, setDialog] = useState<"organize" | "reparse" | "enhance">();
  const open = (row: S11MaterialRow, mode: "organize" | "reparse" | "enhance") => {
    setSelected(row);
    setName(row.material.title);
    setDestination(row.subject);
    setDialog(mode);
  };
  const close = () => setDialog(undefined);
  const groups = [...new Set(data.materials.map((row) => row.subject))];
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S11-01 按目标、科目成树；自建地图出生记录只展示接口原文。 */}
      {data.map_birth !== undefined && <Banner title={t("materials.birth")}>{data.map_birth}</Banner>}
      <Card
        title={t("materials.title")}
        meta={data.exam_name}
        actions={<Button onClick={soon}>{t("actions.export")}</Button>}
        footer={t("materials.dual_hint")}
      >
        {/* feat:S11-21 科目地图、题库、笔记与卡片整包导出。 */}
        <p className="mb-3 text-small text-ink-secondary">{t("organize.export_hint")}</p>
        {groups.map((subject) => (
          <section key={subject} className="mb-4">
            <h3 className="mb-2 font-medium">{subject}</h3>
            <DataTable<S11MaterialRow>
              caption={subject}
              stackOnNarrow
              rows={data.materials.filter((row) => row.subject === subject)}
              rowKey={(row) => row.material.id}
              columns={[
                {
                  key: "name",
                  header: t("materials.name"),
                  label: t("materials.name"),
                  render: (row) => (
                    <div className="flex flex-col gap-1">
                      <strong>{row.material.title}</strong>
                      <span className="text-small text-ink-tertiary">{row.location}</span>
                      <Tag className="self-start" size="sm" tone="outline">
                        {t(`kind.${row.kind}`)}
                      </Tag>
                      {row.recommendation !== undefined && (
                        <span className="text-small text-status-success">
                          {t("materials.recommend")}：{row.recommendation}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "access",
                  header: t("materials.access"),
                  label: t("materials.access"),
                  render: (row) => (
                    <Tag size="sm" tone="brand">
                      {t(`access.${row.material.access}`)}
                    </Tag>
                  ),
                },
                // feat:S11-08 阅读位置与知识点达标率各自显示，页面不据阅读进度推算掌握。
                {
                  key: "progress",
                  header: t("materials.progress"),
                  label: t("materials.progress"),
                  render: (row) => (
                    <div className="flex flex-col gap-2 whitespace-nowrap">
                      <ProgressBar
                        size="sm"
                        label={t("materials.read", { value: formatPercent(row.read_ratio) })}
                        value={row.read_ratio}
                        showLabel={false}
                      />
                      <span className="text-small">{t("materials.read", { value: formatPercent(row.read_ratio) })}</span>
                      <span className="text-small text-status-success">
                        {t("materials.attained", { value: formatPercent(row.attained_ratio) })}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: t("materials.status"),
                  label: t("materials.status"),
                  render: (row) => (
                    <div className="flex flex-col gap-1">
                      <Tag className="self-start" tone={row.status === "ready" ? "success" : "warning"}>
                        {t(`status.${row.status}`)}
                      </Tag>
                      {row.status === "parsing" && (
                        <span className="text-small">{t("materials.processing", { value: formatPercent(row.processing_ratio) })}</span>
                      )}
                      {row.failure_reason !== undefined && (
                        <>
                          <span className="text-small text-status-danger">{t("materials.failure", { reason: row.failure_reason })}</span>
                          <Button size="sm" onClick={soon}>
                            {t("actions.retry")}
                          </Button>
                        </>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: t("materials.action"),
                  label: t("materials.action"),
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      {row.material.access === "parsable" && row.status === "ready" ? (
                        <Link className={buttonClass("secondary", "sm")} to={pathTo("S12", { docId: row.material.id })}>
                          {t("actions.open")}
                        </Link>
                      ) : row.material.access === "mapped_only" ? (
                        <Button size="sm" onClick={() => open(row, "organize")}>
                          {t("materials.outline")}
                        </Button>
                      ) : row.material.access === "link_only" ? (
                        <Button size="sm" onClick={soon}>
                          {t("materials.external")}
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => open(row, "organize")}>
                        {t("actions.organize")}
                      </Button>
                      <Button size="sm" onClick={() => open(row, "reparse")}>
                        {t("actions.reparse")}
                      </Button>
                      <Button size="sm" onClick={() => open(row, "enhance")}>
                        {t("actions.enhance")}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        ))}
      </Card>
      {/* feat:S11-09 纸书影子书与 feat:S11-10 外部课程伴学入口。 */}
      <Banner>{t("materials.no_text")}</Banner>
      <Banner
        action={
          <Link className={buttonClass("secondary")} to={pathTo("S17")}>
            {t("materials.return_check")}
          </Link>
        }
      >
        {t("materials.course")}
      </Banner>
      {/* feat:S11-23 重命名、复制与跨目标/科目移动；状态不在页面伪造持久化。 */}
      <Dialog
        open={dialog === "organize"}
        onClose={close}
        title={t("organize.title")}
        description={t("organize.move_hint")}
        actions={
          <>
            <Button onClick={soon}>{t("actions.duplicate")}</Button>
            <Button variant="primary" onClick={soon}>
              {t("actions.save")}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2">
          {t("organize.name")}
          <input
            className="w-full rounded-sm border border-line-strong bg-bg-surface p-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="mt-3 flex flex-col gap-2">
          {t("organize.destination")}
          <input
            className="w-full rounded-sm border border-line-strong bg-bg-surface p-2"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </label>
        <p className="mt-3 text-small">
          {t("actions.rename")} · {t("actions.move")}
        </p>
      </Dialog>
      {/* feat:S11-13 重解析时保留记录，大变化由用户选择合并/拆分。 */}
      <Dialog
        open={dialog === "reparse"}
        onClose={close}
        title={t("actions.reparse")}
        description={t("materials.reparse_hint")}
        actions={
          <>
            <Button onClick={soon}>{t("materials.merge")}</Button>
            <Button onClick={soon}>{t("materials.split")}</Button>
          </>
        }
      >
        <p>{selected?.material.title}</p>
      </Dialog>
      {/* feat:S11-14 段落旁增强素材。 */}
      <Dialog open={dialog === "enhance"} onClose={close} title={t("actions.enhance")} description={t("organize.enhance_hint")}>
        <div className="flex flex-wrap gap-2">
          {(t("organize.types", { returnObjects: true }) as string[]).map((kind) => (
            <Button key={kind} onClick={soon}>
              {kind}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
