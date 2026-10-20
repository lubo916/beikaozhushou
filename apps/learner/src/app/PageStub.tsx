// 页面空壳（F05）：页名、原型功能点数量、“开发中”、视图与看原型的命令；?state= 能强制七态（只在开发与测试时生效）。
// 页面任务在 pages/<页ID>/ 里把它换成正式内容。
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Card, PageHeader, PageStates, Tag, cx, pageStateFromSearch } from "@exam-prep/ui";
import { formatCount } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import type { LearnerPageId } from "../routes.ts";
import { PAGE_BY_ID } from "../router/pages.ts";
import { useShellPage } from "./page-context.tsx";

const LEVELS = ["p0", "p1", "p2"] as const;
const CODE = "rounded-sm bg-bg-sunk px-1 text-small";

export function PageStub({ id }: { id: LearnerPageId }) {
  const { t } = useTranslation();
  const { view } = useShellPage();
  const location = useLocation();
  const page = PAGE_BY_ID[id];
  const name = t(`page.${id}`);
  const state = pageStateFromSearch(location.search, { enabled: import.meta.env.DEV });
  const mode = view?.mode ?? page.mode;
  return (
    <div className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageStates state={state} pageName={name} onRetry={() => window.location.reload()}>
        <PageHeader
          eyebrow={t("stub.eyebrow", { group: t(`group.${page.group}`), id })}
          title={name}
          description={t("stub.description")}
          meta={
            <>
              <Tag tone="warning">{t("stub.badge")}</Tag>
              <Tag tone="outline">{VOCAB.page_mode[mode]}</Tag>
              {page.extension && <Tag tone="brand">{t("stub.extension")}</Tag>}
            </>
          }
        />
        <Card title={t("stub.features.title")}>
          <ul className="flex flex-col gap-1">
            {LEVELS.map((level, index) => (
              <li key={level} className="tabular-nums">
                {t("stub.features.line", {
                  level: index,
                  label: t(`stub.features.${level}`),
                  amount: formatCount(page.features[index] ?? 0, t("stub.features.unit")),
                })}
              </li>
            ))}
          </ul>
          <p className="text-small text-ink-tertiary">{t("stub.features.note")}</p>
        </Card>
        {page.views.length > 0 && (
          <Card title={t("stub.views.title")}>
            <ul className="flex flex-col gap-1">
              {page.views.map((item) => (
                <li
                  key={item.key}
                  aria-current={item.key === view?.key ? "true" : undefined}
                  className={cx("flex flex-wrap items-center gap-2", item.key === view?.key && "font-bold")}
                >
                  <code className={CODE}>{item.key}</code>
                  <span>{t(`view.${id}.${item.key}`)}</span>
                  <Tag tone="outline" size="sm">
                    {VOCAB.page_mode[item.mode]}
                  </Tag>
                </li>
              ))}
            </ul>
            <p className="text-small text-ink-tertiary">{t("stub.views.note")}</p>
          </Card>
        )}
        <Card title={t("stub.proto.title")}>
          <p>{t("stub.proto.body")}</p>
          <p>
            <code className={CODE}>{`python3 tools/bk.py proto ${id} --views`}</code>
          </p>
          <p>
            <code className={CODE}>{`python3 tools/bk.py spec ${id}`}</code>
          </p>
        </Card>
      </PageStates>
    </div>
  );
}
