import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S24Progress } from "@exam-prep/contract";
import { buttonClass, PageState } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
export function ForecastLock({ data }: { data: S24Progress }) {
  const { t } = useTranslation("S24");
  return (
    <PageState
      state="restricted"
      title={t("state.restricted.title")}
      body={t("state.restricted.body") + " " + data.blocked_reasons.join("；")}
      action={
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClass("primary")} to={pathTo("S09")}>
            {t("state.restricted.action")}
          </Link>
          <Link className={buttonClass("secondary")} to={pathTo("S06")}>
            {t("common.today")}
          </Link>
        </div>
      }
    />
  );
}
