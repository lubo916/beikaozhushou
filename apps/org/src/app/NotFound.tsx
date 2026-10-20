import { useTranslation } from "react-i18next";
import { PageState, buttonClass } from "@exam-prep/ui";
import { HOME_ID, pathTo } from "../routes.ts";
import { Link } from "../router/history.tsx";

/** 路由表里没有的地址：说明并给一个回首页的出口。 */
export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-content-md">
      <h1 className="sr-only">{t("notFound.title")}</h1>
      <PageState
        state="empty"
        title={t("notFound.title")}
        body={t("notFound.body")}
        action={
          <Link to={pathTo(HOME_ID)} className={buttonClass("primary")}>
            {t("notFound.action")}
          </Link>
        }
      />
    </div>
  );
}
