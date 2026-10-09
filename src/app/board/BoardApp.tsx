import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Notices, type Notice } from "../../design/components";
import { ipc } from "../../lib/ipc";
import { settingsStore } from "../../lib/settings";
import { AddQuoteDialog, AddTextDialog } from "./AddItemDialogs";
import styles from "./BoardApp.module.css";
import { BoardContext, useBoard, useBoardServices, type BoardServices } from "./boardContext";
import { BoardToolbar } from "./BoardToolbar";
import { Canvas } from "./Canvas";
import { EmptyState, type AddActions } from "./EmptyState";
import { createMediaStore } from "./mediaStore";
import { newQuote, newText } from "./newItems";
import { createSaver } from "./saver";
import { createBoardStore, topZ } from "./store";
import { useImageImport } from "./useImageImport";
import { useWindowLifecycle } from "./useWindowLifecycle";

function createServices(): BoardServices {
  const saver = createSaver(ipc.applyBoardOps, {
    onError: (error) => console.error("Saving the board failed, will retry", error),
  });
  return {
    saver,
    store: createBoardStore(saver.enqueue),
    media: createMediaStore(),
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Undo/redo/deselect shortcuts, ignored while typing or when a dialog is open. */
function useShortcuts() {
  const { store } = useBoardServices();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || document.querySelector("[role=dialog]")) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const state = store.getState();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        state.redo();
      } else if (event.key === "Escape") {
        state.select(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);
}

/** A quote or text added in "images only" mode would vanish at once, so the mode turns off. */
function showTexts() {
  if (settingsStore.getState().settings.imagesOnly) {
    void settingsStore.getState().update({ imagesOnly: false });
  }
}

function Board() {
  const { t } = useTranslation();
  const { store, media, saver } = useBoardServices();
  const loaded = useBoard((s) => s.loaded);
  const isEmpty = useBoard((s) => Object.keys(s.items).length === 0);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<"quote" | "text" | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback(
    (notice: Omit<Notice, "id">) =>
      setNotices((list) => [...list, { ...notice, id: crypto.randomUUID() }]),
    [],
  );
  const dismiss = useCallback(
    (id: string) => setNotices((list) => list.filter((n) => n.id !== id)),
    [],
  );
  const { placeholders, importFiles } = useImageImport(store, media, notify);
  const pickerRef = useRef<HTMLInputElement>(null);

  useShortcuts();
  const { trayNoticeOpen, acknowledgeTrayNotice } = useWindowLifecycle(saver);

  useEffect(() => {
    // Media first: image items render as soon as the board loads.
    Promise.all([ipc.mediaLibrary(), ipc.loadBoard()])
      .then(([library, items]) => {
        media.getState().setLibrary(library.dir, library.items);
        store.getState().load(items);
      })
      .catch((error: unknown) => {
        console.error("Loading the board failed", error);
        setFailed(true);
      });
  }, [store, media]);

  const add: AddActions = {
    onAddImage: () => pickerRef.current?.click(),
    onAddQuote: () => setDialog("quote"),
    onAddText: () => setDialog("text"),
  };

  return (
    <main className={styles.app}>
      <h1 className={styles.srOnly}>{t("app.title")}</h1>
      {failed ? (
        <p className={styles.error} role="alert">
          {t("board.loadError")}
        </p>
      ) : (
        <>
          <Canvas
            overlay={
              loaded && isEmpty && placeholders.length === 0 ? <EmptyState {...add} /> : null
            }
            placeholders={placeholders}
          />
          {loaded && !isEmpty && <BoardToolbar {...add} />}
        </>
      )}
      <input
        ref={pickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          importFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <Dialog
        open={trayNoticeOpen}
        onOpenChange={(open) => !open && void acknowledgeTrayNotice()}
        title={t("board.trayNotice.title")}
        description={t("board.trayNotice.body")}
        actions={
          <Button variant="primary" onClick={() => void acknowledgeTrayNotice()}>
            {t("board.trayNotice.ok")}
          </Button>
        }
      />
      <Notices notices={notices} onDismiss={dismiss} dismissLabel={t("common.dismiss")} />
      <AddQuoteDialog
        open={dialog === "quote"}
        onOpenChange={(open) => setDialog(open ? "quote" : null)}
        onSubmit={({ text, author }) => {
          showTexts();
          store.getState().add(newQuote(text, author, topZ(store.getState()) + 1));
        }}
      />
      <AddTextDialog
        open={dialog === "text"}
        onOpenChange={(open) => setDialog(open ? "text" : null)}
        onSubmit={({ text, variant }) => {
          showTexts();
          store.getState().add(newText(text, variant, topZ(store.getState()) + 1));
        }}
      />
    </main>
  );
}

export function BoardApp() {
  const [services] = useState(createServices);
  return (
    <BoardContext.Provider value={services}>
      <Board />
    </BoardContext.Provider>
  );
}

export default BoardApp;
