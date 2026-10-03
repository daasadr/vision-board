import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./Field.module.css";

interface BaseProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };
export type FieldProps = InputProps | TextareaProps;

/** A labelled text input (or textarea) with optional hint and error, wired up for screen readers. */
export function Field(props: FieldProps) {
  const { label, hint, error, id, className, ...rest } = props;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const a11y = {
    id: inputId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {rest.multiline ? (
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          {...a11y}
          {...withoutMultiline(rest)}
        />
      ) : (
        <input className={styles.input} {...a11y} {...withoutMultiline(rest)} />
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function withoutMultiline<T extends { multiline?: boolean }>(props: T): Omit<T, "multiline"> {
  const { multiline: _multiline, ...rest } = props;
  return rest;
}
