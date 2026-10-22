import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S03SetupProfile } from "@exam-prep/contract";
import { AiBadge, Button, Card, Columns, Dialog, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function MaterialSetup({ data }: { readonly data: S03SetupProfile }) {
  const { t } = useTranslation("S03");
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [map, setMap] = useState<S03SetupProfile["maps"][number]>();
  const [source, setSource] = useState("official");
  const [extension, setExtension] = useState(false);
  const methods = ["parsable", "mapped_only", "link_only"] as const;
  return (
    <div className="flex flex-col gap-4">
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S03-06 资料清单以接入方式、处理状态分别标注。 */}
            <Card title={t("res.list")} actions={<Button onClick={() => setAdding(true)}>{t("res.add")}</Button>}>
              {data.materials.length === 0 ? (
                <p>{t("res.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.materials.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line-soft p-3">
                      <div>
                        <strong className="block">{item.title}</strong>
                        <span className="text-small text-ink-secondary">{t(item.kind_key)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Tag tone="outline">{t(`res.${item.access}`)}</Tag>
                        <Tag tone={item.status === "ready" ? "success" : "warning"}>{t(`res.${item.status}`)}</Tag>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-small text-ink-secondary">{t("res.rights")}</p>
            </Card>
            {/* feat:S03-07 六种入口统一转到路由表的 S11。 */}
            <Card title={t("res.import_title")} meta={t("res.import_hint")}>
              <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-3">
                {data.import_methods.map((method) => (
                  <Link
                    key={method.id}
                    to={`${pathTo("S11")}?import=${encodeURIComponent(method.id)}`}
                    className={buttonClass("secondary")}
                  >
                    {t(method.label_key)}
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S03-09 官方为主，个人扩展可同时存在；不自动启用生成的草案。 */}
            <Card title={t("res.maps")} meta={t("res.maps_hint")}>
              <ul className="flex flex-col gap-3">
                {data.maps.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-sunk p-3">
                    <div>
                      <strong className="block">{item.target_name}</strong>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Tag tone="brand">{t(`res.${item.source}`)}</Tag>
                        {item.source === "draft" && <AiBadge />}
                        {item.extension && <Tag>{t("res.extension")}</Tag>}
                        <Tag tone={item.enabled ? "success" : "outline"}>{item.enabled ? t("res.enabled") : t("res.draft")}</Tag>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setMap(item);
                        setSource(item.source);
                        setExtension(item.extension);
                      }}
                    >
                      {t("res.edit")}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        }
      />
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t("res.add")}
        description={t("res.access")}
        actions={<Button onClick={() => setAdding(false)}>{t("action.close")}</Button>}
      >
        <div className="flex flex-col gap-3">
          {methods.map((method) => (
            <div key={method} className="rounded-sm bg-sunk p-3">
              <strong>{t(`res.${method}`)}</strong>
              <p className="text-small text-ink-secondary">{t(`res.${method}_body`)}</p>
            </div>
          ))}
        </div>
        <Link to={pathTo("S11")} className={`${buttonClass("primary")} mt-4`}>
          {t("res.manage")}
        </Link>
      </Dialog>
      <Dialog
        open={map !== undefined}
        onClose={() => setMap(undefined)}
        title={t("res.map_dialog")}
        description={t("res.map_description")}
        actions={
          <>
            <Button onClick={() => setMap(undefined)}>{t("action.cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setMap(undefined);
                toast(t("soon.map"));
              }}
            >
              {t("action.confirm")}
            </Button>
          </>
        }
      >
        <p className="mb-3 font-medium">{map?.target_name}</p>
        <fieldset className="flex flex-col gap-3">
          {["official", "draft", "template"].map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="map-source" value={value} checked={source === value} onChange={() => setSource(value)} />
              {t(`res.${value}`)}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" checked={extension} onChange={(e) => setExtension(e.target.checked)} />
          {t("res.extension")}
        </label>
      </Dialog>
    </div>
  );
}
