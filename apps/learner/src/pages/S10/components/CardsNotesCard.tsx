// 卡片与笔记计数：去复习卡片、看笔记；feat:S10-07 三板块里的卡片与笔记也能在这里直接补。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S10CardCount, S10NoteCount } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { Button, Card, Stat, StatGroup, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function CardsNotesCard({ cards, notes }: { cards: S10CardCount; notes: S10NoteCount }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  return (
    <Card
      title={t("cards.title")}
      footer={
        <div className="flex flex-wrap gap-2">
          <Link to={pathTo("S15")} className={buttonClass("secondary", "sm")}>
            {t("cards.review")}
          </Link>
          <Link to={pathTo("S14")} className={buttonClass("secondary", "sm")}>
            {t("cards.open_notes")}
          </Link>
          <Button variant="ghost" size="sm" onClick={() => toast(t("soon.add_card"))}>
            {t("cards.add_card")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast(t("soon.add_note"))}>
            {t("cards.add_note")}
          </Button>
        </div>
      }
    >
      <StatGroup>
        <Stat
          label={t("cards.cards")}
          value={formatCount(cards.total)}
          unit={t("cards.cards_unit")}
          hint={t("cards.cards_due", { n: cards.due_tomorrow })}
        />
        <Stat
          label={t("cards.notes")}
          value={formatCount(notes.total)}
          unit={t("cards.notes_unit")}
          hint={t("cards.notes_tutor", { n: notes.from_tutor })}
        />
      </StatGroup>
    </Card>
  );
}
