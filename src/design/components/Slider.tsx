import { useId, type CSSProperties, type ReactNode } from "react";
import styles from "./Slider.module.css";

export interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Text read out and shown for the current value, e.g. "40 % of the screen width". */
  valueText: string;
  /** Called while dragging. */
  onChange: (value: number) => void;
  /** Called once the user lets go (pointer up, key up), e.g. to store the value. */
  onCommit?: (value: number) => void;
}

/** A labelled range input (native, so keyboard and screen readers work as usual). */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  valueText,
  onChange,
  onCommit,
}: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  const commit = (event: { currentTarget: HTMLInputElement }) =>
    onCommit?.(Number(event.currentTarget.value));
  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={commit}
      />
    </div>
  );
}
