// 页头：页名、读图说明与三个动作（布局见 bk spec S09）。“补充诊断”去摸底诊断；“新建知识点”（feat:S09-08）与“更多操作”里的
// 管理动作（feat:S09-06 从大纲或教材生成、S09-07 类型标注、S09-08 知识点管理、S09-14 版本与迁移、S09-15 批量范围操作）
// 还没有后端，点了提示“即将上线”（F08-Q4）；“从大纲或教材生成”先带到我的资料。
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button, Card, PageHeader, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const MANAGE_ITEMS = ["manage", "types", "relations", "scope", "versions"] as const;

export interface MapHeaderProps {
  /** 接口标了“示例数据”（规则还没实现，data_source 为 sample）。 */
  readonly sample: boolean;
  /** 受限：底图只读，管理动作只落在个人扩展层。 */
  readonly restricted: boolean;
  /** 空态只留页名（原型的空态）。 */
  readonly bare?: boolean;
}

export function MapHeader({ sample, restricted, bare = false }: MapHeaderProps) {
  const { t } = useTranslation("S09");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (bare) return <PageHeader title={tc("page.S09")} />;
  return (
    <>
      <PageHeader
        title={tc("page.S09")}
        description={t("header.description")}
        meta={
          sample ? (
            <Tag tone="warning" size="sm">
              {t("sample")}
            </Tag>
          ) : undefined
        }
        actions={
          <>
            <Link to={pathTo("S04")} className={buttonClass("secondary")}>
              {t("header.diagnose")}
            </Link>
            <Button onClick={() => toast(t("soon.new_point"))}>{t("header.new_point")}</Button>
            <Button
              variant="ghost"
              aria-label={t("header.more")}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => setOpen((value) => !value)}
            >
              {t("header.more_symbol")}
            </Button>
          </>
        }
      />
      {open && (
        <Card id={panelId} title={t("more.title")}>
          {restricted && <p className="s09-note s09-note--warn">{t("more.readonly")}</p>}
          <ul className="s09-menu">
            <li>
              <Link to={pathTo("S11")} className="s09-menu__item">
                <span className="s09-menu__name">{t("more.generate")}</span>
                <span className="s09-menu__hint">{t("more.generate_hint")}</span>
              </Link>
            </li>
            {MANAGE_ITEMS.map((item) => (
              <li key={item}>
                <button type="button" className="s09-menu__item" onClick={() => toast(t(`soon.${item}`))}>
                  <span className="s09-menu__name">{t(`more.${item}`)}</span>
                  <span className="s09-menu__hint">{t(`more.${item}_hint`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
