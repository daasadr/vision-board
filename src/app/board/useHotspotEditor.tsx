import { useCallback, useMemo, useState } from "react";
import type { Hotspot, Item } from "../../lib/ipc";
import { useBoardActions } from "./boardContext";
import { HotspotDialog } from "./HotspotDialog";
import { activateHotspot, type HotspotBehavior } from "./hotspotContext";

interface DialogState {
  itemId: string;
  hotspot: Hotspot;
  isNew: boolean;
}

function hotspotsOf(item: Item): Hotspot[] {
  return item.content.kind === "image" ? (item.content.hotspots ?? []) : [];
}

/**
 * The hotspot editor of the board window: which image is being edited, the dialog for one
 * hotspot, and the hotspot behavior for the canvas. Every change is an ordinary item update,
 * so undo/redo covers it.
 */
export function useHotspotEditor(items: Record<string, Item>, selectedId: string | null) {
  const actions = useBoardActions();
  const [chosenId, setItemId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // Editing ends as soon as another item (or none) is selected.
  const itemId = chosenId && chosenId === selectedId ? chosenId : null;

  const setHotspots = useCallback(
    (id: string, change: (list: Hotspot[]) => Hotspot[]) => {
      const item = items[id];
      if (item?.content.kind !== "image") return;
      actions.update(id, {
        content: { ...item.content, hotspots: change(hotspotsOf(item)) },
      });
    },
    [actions, items],
  );

  const behavior: HotspotBehavior = useMemo(
    () => ({
      mode: "active",
      onActivate: activateHotspot,
      editing: itemId
        ? {
            itemId,
            onAdd: (item, x, y) =>
              setDialog({
                itemId: item.id,
                isNew: true,
                hotspot: {
                  id: crypto.randomUUID(),
                  x,
                  y,
                  label: "",
                  action: { kind: "link", url: "" },
                },
              }),
            onEdit: (item, hotspot) => setDialog({ itemId: item.id, hotspot, isNew: false }),
            onMove: (item, hotspotId, x, y) =>
              setHotspots(item.id, (list) =>
                list.map((h) => (h.id === hotspotId ? { ...h, x, y } : h)),
              ),
          }
        : null,
    }),
    [itemId, setHotspots],
  );

  const dialogElement = (
    <HotspotDialog
      hotspot={dialog?.hotspot ?? null}
      isNew={dialog?.isNew ?? false}
      onClose={() => setDialog(null)}
      onSave={(saved) => {
        if (!dialog) return;
        setHotspots(dialog.itemId, (list) =>
          dialog.isNew ? [...list, saved] : list.map((h) => (h.id === saved.id ? saved : h)),
        );
        setDialog(null);
      }}
      onRemove={() => {
        if (!dialog) return;
        setHotspots(dialog.itemId, (list) => list.filter((h) => h.id !== dialog.hotspot.id));
        setDialog(null);
      }}
    />
  );

  return {
    behavior,
    dialog: dialogElement,
    editingItemId: itemId,
    toggle: (id: string) => setItemId(itemId === id ? null : id),
  };
}
