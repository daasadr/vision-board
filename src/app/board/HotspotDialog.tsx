import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogClose, Field, SegmentedControl } from "../../design/components";
import { ipc, type Hotspot, type HotspotAction } from "../../lib/ipc";
import { useBoardServices, useMediaUrl } from "./boardContext";
import styles from "./HotspotDialog.module.css";
import { importFilesInTurn } from "./imageItems";
import { isWebLink } from "./links";

/** Most photos in one detail (domain::board::MAX_DETAIL_MEDIA). */
const MAX_PHOTOS = 20;

interface Props {
  hotspot: Hotspot | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (hotspot: Hotspot) => void;
  onRemove: () => void;
}

/** Edits one hotspot: its name and what a click does (open a link or show a detail). */
export function HotspotDialog({ hotspot, isNew, onClose, onSave, onRemove }: Props) {
  // A fresh form for every hotspot opened.
  return hotspot ? (
    <HotspotForm
      key={hotspot.id}
      hotspot={hotspot}
      isNew={isNew}
      onClose={onClose}
      onSave={onSave}
      onRemove={onRemove}
    />
  ) : null;
}

function HotspotForm({ hotspot, isNew, onClose, onSave, onRemove }: Props & { hotspot: Hotspot }) {
  const { t } = useTranslation();
  const { media } = useBoardServices();
  const [label, setLabel] = useState(hotspot.label);
  const [kind, setKind] = useState<HotspotAction["kind"]>(hotspot.action.kind);
  const [url, setUrl] = useState(hotspot.action.kind === "link" ? hotspot.action.url : "https://");
  const detail = hotspot.action.kind === "detail" ? hotspot.action : null;
  const [title, setTitle] = useState(detail?.title ?? "");
  const [text, setText] = useState(detail?.text ?? "");
  const [photos, setPhotos] = useState<string[]>(detail?.media ?? []);
  const [touched, setTouched] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const labelError = touched && !label.trim() ? t("board.hotspots.required") : undefined;
  const urlError =
    touched && kind === "link" && !isWebLink(url) ? t("board.hotspots.urlError") : undefined;
  const titleError =
    touched && kind === "detail" && !title.trim() ? t("board.hotspots.titleRequired") : undefined;
  const valid =
    !!label.trim() &&
    (kind === "link" ? isWebLink(url) : !!title.trim()) &&
    photos.length <= MAX_PHOTOS;

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    const action: HotspotAction =
      kind === "link"
        ? { kind: "link", url: url.trim() }
        : { kind: "detail", title: title.trim(), text: text.trim(), media: photos };
    onSave({ ...hotspot, label: label.trim(), action });
  }

  async function addPhotos(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    const results = await importFilesInTurn(files.slice(0, room), ipc.importImageBytes);
    const added = results.flatMap((r) => (r.status === "ok" ? [r.media] : []));
    added.forEach((m) => media.getState().add(m));
    setPhotos((list) => [...list, ...added.map((m) => m.id)]);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("board.hotspots.dialogTitle")}
      actions={
        <>
          {!isNew && (
            <Button variant="danger" onClick={onRemove}>
              {t("board.hotspots.remove")}
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="ghost">{t("common.cancel")}</Button>
          </DialogClose>
          <Button variant="primary" type="submit" form="hotspot-form">
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="hotspot-form" className={styles.form} onSubmit={submit} noValidate>
        <Field
          label={t("board.hotspots.label")}
          hint={t("board.hotspots.labelHint")}
          error={labelError}
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        <SegmentedControl
          label={t("board.hotspots.action")}
          value={kind}
          options={[
            { value: "link", label: t("board.hotspots.link") },
            { value: "detail", label: t("board.hotspots.detail") },
          ]}
          onChange={setKind}
        />
        {kind === "link" ? (
          <Field
            label={t("board.hotspots.url")}
            type="url"
            inputMode="url"
            error={urlError}
            value={url}
            maxLength={2000}
            onChange={(e) => setUrl(e.currentTarget.value)}
          />
        ) : (
          <>
            <Field
              label={t("board.hotspots.title")}
              error={titleError}
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <Field
              multiline
              label={t("board.hotspots.text")}
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.currentTarget.value)}
            />
            <fieldset className={styles.photos}>
              <legend className={styles.legend}>{t("board.hotspots.photos")}</legend>
              <div className={styles.thumbs}>
                {photos.map((id, i) => (
                  <PhotoThumb
                    key={id}
                    mediaId={id}
                    label={t("board.hotspots.removePhoto", { n: i + 1 })}
                    onRemove={() => setPhotos((list) => list.filter((p) => p !== id))}
                  />
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Button size="sm" onClick={() => picker.current?.click()}>
                    {t("board.hotspots.addPhotos")}
                  </Button>
                )}
              </div>
              <p className={styles.hint}>{t("board.hotspots.photosHint")}</p>
              <input
                ref={picker}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  void addPhotos([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </fieldset>
          </>
        )}
      </form>
    </Dialog>
  );
}

function PhotoThumb({
  mediaId,
  label,
  onRemove,
}: {
  mediaId: string;
  label: string;
  onRemove: () => void;
}) {
  const src = useMediaUrl(mediaId, "thumb");
  return (
    <span className={styles.thumb}>
      {src && <img src={src} alt="" />}
      <button type="button" className={styles.removePhoto} aria-label={label} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}
