import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogClose, Field, SegmentedControl } from "../../design/components";
import type { TextVariant } from "../../lib/ipc";
import styles from "./AddItemDialogs.module.css";

interface DialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: T) => void;
}

/** Ctrl/Cmd+Enter submits the form from a multiline field. */
function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

/** Shared form shell: the submit button stays disabled until the text is non-empty. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  canSubmit,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  canSubmit: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const formId = `form-${title}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      actions={
        <>
          <DialogClose asChild>
            <Button variant="ghost">{t("common.cancel")}</Button>
          </DialogClose>
          <Button variant="primary" type="submit" form={formId} disabled={!canSubmit}>
            {t("common.add")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className={styles.form}>
        {children}
      </form>
    </Dialog>
  );
}

export function AddQuoteDialog({
  open,
  onOpenChange,
  onSubmit,
}: DialogProps<{ text: string; author: string | null }>) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");

  function change(next: boolean) {
    if (!next) {
      setText("");
      setAuthor("");
    }
    onOpenChange(next);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={change}
      title={t("board.quoteDialog.title")}
      description={t("board.quoteDialog.description")}
      canSubmit={text.trim() !== ""}
      onSubmit={() => onSubmit({ text: text.trim(), author: author.trim() || null })}
    >
      <Field
        multiline
        label={t("board.quoteDialog.text")}
        placeholder={t("board.quoteDialog.textPlaceholder")}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={submitOnModEnter}
      />
      <Field
        label={t("board.quoteDialog.author")}
        hint={t("board.quoteDialog.authorHint")}
        value={author}
        maxLength={200}
        onChange={(e) => setAuthor(e.target.value)}
      />
    </FormDialog>
  );
}

export function AddTextDialog({
  open,
  onOpenChange,
  onSubmit,
}: DialogProps<{ text: string; variant: TextVariant }>) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [variant, setVariant] = useState<TextVariant>("heading");

  function change(next: boolean) {
    if (!next) {
      setText("");
      setVariant("heading");
    }
    onOpenChange(next);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={change}
      title={t("board.textDialog.title")}
      description={t("board.textDialog.description")}
      canSubmit={text.trim() !== ""}
      onSubmit={() => onSubmit({ text: text.trim(), variant })}
    >
      <Field
        multiline
        label={t("board.textDialog.text")}
        placeholder={t("board.textDialog.textPlaceholder")}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={submitOnModEnter}
      />
      <SegmentedControl
        label={t("board.textDialog.variant")}
        value={variant}
        onChange={setVariant}
        options={[
          { value: "heading", label: t("board.textDialog.heading") },
          { value: "note", label: t("board.textDialog.note") },
        ]}
      />
    </FormDialog>
  );
}
