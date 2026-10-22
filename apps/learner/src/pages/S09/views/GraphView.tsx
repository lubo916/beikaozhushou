// 关系图视图（feat:S09-11 关系编辑、S09-12 导师建议关联、S09-17 前置与学习路径）：以默认选中的知识点为中心画一圈关系，
// 图下面是同样内容的关系列表（读屏与手机都能用）。导师建议的关联画虚线、带“AI 生成”标识与置信度，采纳后才生效（红线 3、4）；
// 采纳、忽略、一键采纳高置信、编辑关系还没有后端，点了提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { S09RelationEdge, S09Relations } from "@exam-prep/contract";
import { formatCount, formatNumber } from "@exam-prep/shared/format";
import { AiBadge, Button, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

/** 画布用 SVG 坐标（随宽度等比缩放）：中心在上，其余排在下面两行。 */
const VIEW_W = 640;
const VIEW_H = 300;
const NODE_W = 150;
const NODE_H = 34;
const NODE_RADIUS = 7;
const NAME_MAX = 10;
const CONFIDENCE_DIGITS = 2;
const CENTER = { x: VIEW_W / 2, y: 44 };
const SLOTS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 90, y: 150 },
  { x: 550, y: 150 },
  { x: 150, y: 256 },
  { x: 490, y: 256 },
  { x: 320, y: 256 },
];

const short = (name: string): string => (name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name);

function Node({ x, y, name, kind }: { readonly x: number; readonly y: number; readonly name: string; readonly kind: "center" | "plain" | "tutor" }) {
  return (
    <g className={`s09-graph__node s09-graph__node--${kind}`}>
      <title>{name}</title>
      <rect x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={NODE_RADIUS} />
      <text x={x} y={y}>
        {short(name)}
      </text>
    </g>
  );
}

export function GraphView({ relations }: { readonly relations: S09Relations }) {
  const { t } = useTranslation("S09");
  const toast = useToast();
  const names = new Map(relations.nodes.map((node) => [node.id, node.name]));
  const nameOf = (id: string): string => names.get(id) ?? "";
  const center = relations.center_id;
  if (center === undefined || relations.edges.length === 0) return <p className="s09-note">{t("graph.empty")}</p>;
  const neighbors: { readonly id: string; readonly edge: S09RelationEdge; readonly x: number; readonly y: number }[] = [];
  for (const edge of relations.edges) {
    const id = edge.from === center ? edge.to : edge.from;
    const slot = SLOTS[neighbors.length];
    if (slot === undefined || neighbors.some((item) => item.id === id)) continue;
    neighbors.push({ id, edge, ...slot });
  }
  const before = relations.edges.filter((edge) => edge.type === "prerequisite" && edge.to === center).map((edge) => nameOf(edge.from));
  const high = relations.edges.filter((edge) => edge.origin === "tutor" && edge.high_confidence === true).length;
  const edgeTop = CENTER.y + NODE_H / 2;
  return (
    <div className="s09-stack">
      <p className="s09-graph__title">{t("graph.title", { name: nameOf(center) })}</p>
      <svg className="s09-graph" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={t("graph.label")}>
        {neighbors.map(({ id, edge, x, y }) => {
          const tutor = edge.origin === "tutor";
          return (
            <g key={`edge-${id}`}>
              <line
                className={`s09-graph__edge s09-graph__edge--${edge.strength}${tutor ? " s09-graph__edge--tutor" : ""}`}
                x1={CENTER.x}
                y1={edgeTop}
                x2={x}
                y2={y - NODE_H / 2}
              />
              <text className="s09-graph__label" x={(CENTER.x + x) / 2} y={(edgeTop + y - NODE_H / 2) / 2}>
                {t(`relation.${edge.type}`)}
              </text>
            </g>
          );
        })}
        <Node x={CENTER.x} y={CENTER.y} name={nameOf(center)} kind="center" />
        {neighbors.map(({ id, edge, x, y }) => (
          <Node key={id} x={x} y={y} name={nameOf(id)} kind={edge.origin === "tutor" ? "tutor" : "plain"} />
        ))}
      </svg>
      <p className="s09-note s09-note--muted">{t("graph.note")}</p>
      {before.length > 0 && <p className="s09-note">{t("graph.path", { before: before.join(t("joiner")), name: nameOf(center) })}</p>}
      <ul className="s09-list" aria-label={t("graph.list")}>
        {relations.edges.map((edge) => (
          <li key={`${edge.from}-${edge.to}-${edge.type}`} className="s09-list__row s09-list__row--start">
            <span className="s09-relation">
              {t("graph.edge", { type: t(`relation.${edge.type}`), from: nameOf(edge.from), to: nameOf(edge.to) })}
              <Tag tone="outline" size="sm">
                {t(`graph.strength.${edge.strength}`)}
              </Tag>
              {edge.origin === "tutor" ? (
                <>
                  <AiBadge size="xs" />
                  {edge.confidence !== undefined && (
                    <span className="s09-note">{t("graph.confidence", { value: formatNumber(edge.confidence, CONFIDENCE_DIGITS) })}</span>
                  )}
                </>
              ) : (
                <Tag tone="neutral" size="sm">
                  {t(`graph.origin.${edge.origin}`)}
                </Tag>
              )}
            </span>
            {edge.origin === "tutor" && (
              <span className="s09-actions">
                <Button size="sm" onClick={() => toast(t("soon.adopt"))}>
                  {t("graph.adopt")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast(t("soon.ignore"))}>
                  {t("graph.ignore")}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="s09-actions">
        {high > 0 && (
          <Button size="sm" variant="ai" onClick={() => toast(t("soon.adopt_high"))}>
            {t("graph.adopt_high", { n: formatCount(high) })}
          </Button>
        )}
        <Button size="sm" onClick={() => toast(t("soon.relations"))}>
          {t("graph.edit")}
        </Button>
      </div>
    </div>
  );
}
