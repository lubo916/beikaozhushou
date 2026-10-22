import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S14NoteItem } from "@exam-prep/contract";
import { markAiGenerated } from "@exam-prep/shared/format";
import { AiBadge, Banner, Button, Dialog } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

const field = "w-full min-w-0 rounded-sm border border-line-strong bg-bg-surface px-3 py-2 text-body";
export function EditorDialog({ item, point, onClose }: { item: S14NoteItem | null; point: string; onClose: () => void }) {
  const { t } = useTranslation("S14");
  const toast = useToast();
  const editor = useRef<HTMLDivElement>(null);
  const [pasted, setPasted] = useState(item?.copy_reminder ?? false);
  const [commands, setCommands] = useState(false);
  const [type, setType] = useState(item?.note.note_type ?? "general");
  const [title, setTitle] = useState(item?.note.title ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("editor.title")}
      description={t("editor.saveHint")}
      actions={
        <>
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={() => toast(t("soon"))}>
            {t("actions.save")}
          </Button>
        </>
      }
    >
      {/* feat:S14-02 知识点归属可修改；保存权限登记后接生成写接口。 */}
      <div className="flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1">
          {t("editor.name")}
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("editor.namePlaceholder")} />
        </label>
        <label className="flex flex-col gap-1">
          {t("filter.type")}
          <select className={field} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {["general", "mnemonic", "definition", "key_points", "pitfall"].map((key) => (
              <option key={key} value={key}>
                {t(`type.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("editor.point")}
          <input className={field} defaultValue={item?.point_path ?? point} />
        </label>
        {item?.note.ai_generated && <AiBadge />}
        {/* feat:S14-04 富文本输入与工具入口；复杂编辑器工具当前展示即将上线。 */}
        <div role="toolbar" aria-label={t("editor.tools")} className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              editor.current?.focus();
              document.execCommand("bold");
            }}
          >
            {t("editor.bold")}
          </Button>
          {["formula", "table", "image", "drawing"].map((tool) => (
            <Button key={tool} size="sm" onClick={() => toast(t("editor.toolSoon", { tool: t(`editor.${tool}`) }))}>
              {t(`editor.${tool}`)}
            </Button>
          ))}
          <Button size="sm" aria-expanded={commands} onClick={() => setCommands(!commands)}>
            {t("editor.slash")}
          </Button>
        </div>
        <label id="s14-editor-label">{t("editor.body")}</label>
        <div
          ref={editor}
          role="textbox"
          aria-labelledby="s14-editor-label"
          aria-multiline
          contentEditable
          suppressContentEditableWarning
          className={`${field} min-h-48 whitespace-pre-wrap`}
          onCopy={(event) => { const text = document.getSelection()?.toString(); if (item?.note.ai_generated && text) { event.preventDefault(); event.clipboardData.setData("text/plain", markAiGenerated(text)); } }}
            onPaste={() => setPasted(true)}
          onKeyDown={(e) => {
            if (e.key === "/") setCommands(true);
          }}
        >
          {item?.note.body ?? ""}
        </div>
        {commands && (
          <div className="flex flex-wrap gap-2">
            {["formula", "table", "image", "drawing"].map((tool) => (
              <Button
                key={tool}
                size="sm"
                onClick={() => {
                  toast(t("editor.toolSoon", { tool: t(`editor.${tool}`) }));
                  setCommands(false);
                }}
              >
                {t(`editor.${tool}`)}
              </Button>
            ))}
          </div>
        )}
        {/* feat:S14-14 搬运提醒由接口标记或用户粘贴触发，不擅自更改内容。 */}
        {pasted && (
          <Banner tone="warning" title={t("editor.copyTitle")}>
            {t("editor.copyBody")}
          </Banner>
        )}
        <p className="text-small text-ink-tertiary">{t("editor.draft")}</p>
      </div>
    </Dialog>
  );
}
