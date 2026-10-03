import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Item } from "../../lib/ipc";
import { useBoardServices } from "./boardContext";
import styles from "./ItemContentView.module.css";

export interface TextEdit {
  text: string;
  author?: string | null;
}

interface Props {
  item: Item;
  editing: boolean;
  onEditDone: (edit: TextEdit | null) => void;
}

/** Renders what an item shows. Quotes and texts can be edited in place. */
export function ItemContentView({ item, editing, onEditDone }: Props) {
  const { content } = item;
  switch (content.kind) {
    case "image":
      return <ImageView mediaId={content.mediaId} />;
    case "quote":
      return (
        <blockquote className={`${styles.card} ${styles.quote}`}>
          <span className={styles.quoteMark} aria-hidden="true">
            “
          </span>
          <EditableText
            className={styles.quoteText}
            value={content.text}
            editing={editing}
            onDone={(text) => onEditDone(text === null ? null : { text, author: content.author })}
          />
          {content.author && !editing && (
            <footer className={styles.author}>{content.author}</footer>
          )}
        </blockquote>
      );
    case "text":
      return (
        <EditableText
          className={
            content.variant === "heading" ? styles.heading : `${styles.card} ${styles.note}`
          }
          value={content.text}
          editing={editing}
          onDone={(text) => onEditDone(text === null ? null : { text })}
        />
      );
  }
}

function ImageView({ mediaId }: { mediaId: string }) {
  const { mediaUrl } = useBoardServices();
  const src = mediaUrl(mediaId, "full");
  return src ? (
    <img className={styles.image} src={src} alt="" draggable={false} />
  ) : (
    <div className={`${styles.image} ${styles.placeholder}`} />
  );
}

/**
 * Plain text that becomes editable in place. Enter (without Shift) or leaving the field
 * commits, Escape cancels; an empty result is reported as a cancel.
 */
function EditableText({
  className,
  value,
  editing,
  onDone,
}: {
  className: string;
  value: string;
  editing: boolean;
  onDone: (text: string | null) => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  function finish(commit: boolean) {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText.trim();
    if (!commit || text === "" || text === value) {
      el.innerText = value;
      onDone(null);
    } else {
      onDone(text);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") finish(false);
    else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finish(true);
    }
  }

  return (
    // While editing the paragraph is contentEditable, i.e. an interactive textbox.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <p
      ref={ref}
      className={`${className} ${editing ? styles.editing : ""}`}
      contentEditable={editing ? "plaintext-only" : false}
      suppressContentEditableWarning
      role={editing ? "textbox" : undefined}
      aria-multiline={editing ? true : undefined}
      onKeyDown={editing ? onKeyDown : undefined}
      onBlur={editing ? () => finish(true) : undefined}
      onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
    >
      {value}
    </p>
  );
}
