import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog, e.g. a Button. */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons shown at the bottom right. Wrap a button in DialogClose to close on click. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Modal dialog: traps focus, closes on Esc and returns focus to the trigger. */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  actions,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          // Without a description, opt out explicitly so Radix does not point at a missing element.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
          {actions && <div className={styles.actions}>{actions}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
