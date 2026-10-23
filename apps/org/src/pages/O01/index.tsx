import { useState } from "react";
import { param } from "@exam-prep/params";
import { useTranslation } from "react-i18next";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { useWorkbench } from "./data.ts";
import { OrgPageRuntime } from "./runtime.tsx";
import { WorkbenchContent } from "./components/WorkbenchContent.tsx";
import { WorkbenchSkeleton } from "./components/WorkbenchSkeleton.tsx";
const ROLES = ["org_owner", "campus_manager", "academic_admin", "head_teacher", "lecturer", "researcher", "advisor"] as const;
const TYPES = ["training", "school", "enterprise"] as const;
const SCOPES = ["all", "east", "department"] as const;
function WorkbenchPage() {
  const { t } = useTranslation("O01");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [role, setRole] = useState("org_owner");
  const [organizationType, setOrganizationType] = useState("training");
  const [scope, setScope] = useState("all");
  const home = useWorkbench({
    exam: query.get("exam") ?? "kj",
    state: query.get("state") ?? "normal",
    role,
    organization_type: organizationType,
    scope: role === "org_owner" ? scope : "east",
  });
  const data = home.data;
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<Tag>{t("sample")}</Tag>}
        actions={<Button onClick={() => toast(t("soon"))}>{t("customize")}</Button>}
      />
      {/* feat:O01-01 七种角色对应待办；自定卡片先给可点击入口。feat:O01-04 范围切换，上级看汇总、下级只看本级。feat:O01-07 组织类型预设。 */}
      <div className="flex flex-wrap gap-3 rounded-md border border-line-soft bg-bg-surface p-3">
        <label className="flex flex-col gap-1 text-small">
          {t("role")}
          <select
            className="rounded-sm border border-line-strong bg-bg-surface p-2"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {ROLES.map((key) => (
              <option key={key} value={key}>
                {t(`roles.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t("organization")}
          <select
            className="rounded-sm border border-line-strong bg-bg-surface p-2"
            value={organizationType}
            onChange={(event) => setOrganizationType(event.target.value)}
          >
            {TYPES.map((key) => (
              <option key={key} value={key}>
                {t(`orgTypes.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t("scope")}
          <select
            className="rounded-sm border border-line-strong bg-bg-surface p-2"
            value={role === "org_owner" ? scope : "east"}
            disabled={role !== "org_owner"}
            onChange={(event) => setScope(event.target.value)}
          >
            {SCOPES.map((key) => (
              <option key={key} value={key}>
                {t(`scopes.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<WorkbenchSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : home.state === "offline" ? (
        <PageState state="offline" pageName={t("title")} body={t("state.offline.body")} />
      ) : home.state === "restricted" ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("O15")} className={buttonClass("secondary")}>
              {t("method")}
            </Link>
          }
        />
      ) : home.state === "error" || data === undefined ? (
        <PageState
          state="error"
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("O03")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <>
          {home.stale && <Banner tone="warning" title={t("state.offline.body")} />}
          <WorkbenchContent data={data} offline={home.stale} />
        </>
      )}
    </ContainerScope>
  );
}
export default function Page() {
  return (
    <OrgPageRuntime>
      <WorkbenchPage />
    </OrgPageRuntime>
  );
}
