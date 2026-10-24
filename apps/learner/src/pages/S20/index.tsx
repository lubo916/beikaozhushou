import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { Banner, Button, Card, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tabs, Tag } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { AnswerDialog, type InputMethod } from "./components/AnswerDialog.tsx";
import { FeedbackCards } from "./components/FeedbackCards.tsx";
import { ScoringCards, type ScoringMethod } from "./components/ScoringCards.tsx";
import { useGradingWorkspace } from "./data.ts";

// S20 只有主视图，无已登记的 ?view= 子视图；简版范围：主视图、七态与 P0。
export default function Page() {
  const { t } = useTranslation("S20");
  const toast = useToast();
  const home = useGradingWorkspace();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<InputMethod>("keyboard");
  const [method, setMethod] = useState<ScoringMethod>("mentor");
  const [tab, setTab] = useState<"mine" | "institution">("mine");
  const data = home.data;
  const submit = (
    <Button variant="primary" onClick={() => setOpen(true)}>
      {t("submit")}
    </Button>
  );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {submit}
            <Button onClick={() => toast(t("soon"))}>{t("expressions")}</Button>
          </>
        }
        meta={
          data && (
            <>
              <Tag tone="warning">{t("sample")}</Tag>
              <Tag>{data.exam_name}</Tag>
            </>
          )
        }
      />
      <Tabs
        label={t("tabs.label")}
        value={tab}
        onChange={setTab}
        items={[
          { key: "mine", label: t("tabs.mine") },
          { key: "institution", label: t("tabs.institution") },
        ]}
      />
      {tab === "institution" ? (
        <Card title={t("institution.title")}>
          <p>{t("institution.body")}</p>
        </Card>
      ) : home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={<Columns main={<Skeleton title lines={4} block />} aside={<Skeleton title lines={3} block />} />}
        />
      ) : home.state === "offline" ? (
        <PageState state="offline" pageName={t("title")} title={t("state.offline.title")} body={t("state.offline.body")} action={submit} />
      ) : home.state === "error" || data === undefined ? (
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon"))} />
      ) : home.state === "empty" ? (
        <PageState state="empty" title={t("state.empty.title")} body={t("state.empty.body")} action={submit} />
      ) : (
        <>
          {home.stale && (
            <Banner tone="warning" title={t("state.offline.title")}>
              {t("state.offline.body")}
            </Banner>
          )}
          <Columns
            main={
              <FeedbackCards
                data={data}
                onInput={(value) => {
                  setInput(value);
                  setOpen(true);
                }}
              />
            }
            aside={<ScoringCards data={data} method={method} onMethod={setMethod} />}
          />
        </>
      )}
      <AnswerDialog open={open} onClose={() => setOpen(false)} method={method} input={input} onInput={setInput} />
    </ContainerScope>
  );
}
