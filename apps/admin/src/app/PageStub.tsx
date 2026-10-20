// 页面空壳（F05）：页名、原型功能点数量、“开发中”与看原型的命令；?state= 能强制七态（只在开发与测试时生效）。
// 页面任务在 pages/<页ID>/ 里把它换成正式内容。
import { useTranslation } from "react-i18next";
import { Card, PageHeader, PageStates, Tag, pageStateFromSearch } from "@exam-prep/ui";
import { formatCount } from "@exam-prep/shared/format";
import type { PageId } from "../routes.ts";
import { useLocation } from "../router/history.tsx";
import { PAGE_BY_ID } from "../router/pages.ts";
import { usePageName } from "./parts.tsx";

const LEVELS = ["p0", "p1", "p2"] as const;
const CODE = "rounded-sm bg-bg-sunk px-1 text-small";

export function PageStub({ id }: { id: PageId }) {
  const { t } = useTranslation();
  const pageName = usePageName();
  const { search } = useLocation();
  const page = PAGE_BY_ID[id];
  const name = pageName(id);
  const state = pageStateFromSearch(search, { enabled: import.meta.env.DEV });
  return (
    <div className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageStates state={state} pageName={name} audience="staff" onRetry={() => window.location.reload()}>
        <PageHeader
          eyebrow={t("stub.eyebrow", { group: t(`group.${page.group}`), id })}
          title={name}
          description={t("stub.description")}
          meta={<Tag tone="warning">{t("stub.badge")}</Tag>}
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
        <Card title={t("stub.proto.title")}>
          <p>{t("stub.proto.body")}</p>
          <p>
            <code className={CODE}>{`python3 tools/bk.py proto ${id} --widths 375,834,1280`}</code>
          </p>
          <p>
            <code className={CODE}>{`python3 tools/bk.py spec ${id}`}</code>
          </p>
        </Card>
      </PageStates>
    </div>
  );
}
