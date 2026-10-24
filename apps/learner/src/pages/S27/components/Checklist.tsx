import type { S27SprintHome } from "@exam-prep/contract";
import { useTranslation } from "react-i18next";
import { Button, Card, Tag } from "@exam-prep/ui";

// feat:S27-09
export function Checklist({ data, soon }: { data: S27SprintHome; soon: () => void }) {
  const { t } = useTranslation("S27");
  return (
    <Card title={t("sprint.checklist.title")} footer={<Button onClick={soon}>{t("sprint.checklist.action")}</Button>}>
      <ul className="ui-list ui-list--divided">
        {data.checklist.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{t(`sprint.checklist.${item.key}`)}</span>
            <Tag tone={item.checked ? "success" : "warning"}>{t(item.checked ? "sprint.checklist.done" : "sprint.checklist.todo")}</Tag>
          </li>
        ))}
      </ul>
    </Card>
  );
}
