import { useTranslation } from "react-i18next";
import { Button, Card, List, ListRow } from "@exam-prep/ui";

/** 原型主视图的“通知”卡：学员与模板作者两类通知；发送要后端与权限，先提示“即将上线”。 */
export function NoticeCard({ onNotify }: { onNotify: () => void }) {
  const { t } = useTranslation("P06");
  return (
    <Card title={t("notices.title")}>
      <List>
        {/* feat:P06-05 用户通知：分批通知并写明对你意味着什么；feat:P06-07 计划调整以提议给出，确认后生效 */}
        <ListRow
          title={t("notices.learners")}
          description={t("notices.learnersBody")}
          action={
            <Button size="sm" onClick={onNotify}>
              {t("notices.notifyLearners")}
            </Button>
          }
        />
        {/* feat:P06-06 模板作者通知：受影响模板的作者收到更新提醒 */}
        <ListRow
          title={t("notices.authors")}
          description={t("notices.authorsBody")}
          action={
            <Button size="sm" onClick={onNotify}>
              {t("notices.notifyAuthors")}
            </Button>
          }
        />
      </List>
    </Card>
  );
}
