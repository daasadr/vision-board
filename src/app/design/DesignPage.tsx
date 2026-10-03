import { useState } from "react";
import { Button, Dialog, DialogClose, Field, Switch } from "../../design/components";
import { applyTheme, THEMES, type ThemeName } from "../../design/theme";
import styles from "./DesignPage.module.css";

const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface-raised",
  "surface-sunken",
  "ink",
  "ink-muted",
  "ink-subtle",
  "border",
  "accent",
  "on-accent",
  "danger",
  "frame",
];

const PANGRAM_CS = "Příliš žluťoučký kůň úpěl ďábelské ódy.";
const PANGRAM_DE = "Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich.";

/** Living specimen of the design system in both themes. */
export default function DesignPage() {
  const [theme, setTheme] = useState<ThemeName>(
    (document.documentElement.dataset.theme as ThemeName) ?? "galerie",
  );

  function switchTheme(next: ThemeName) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Design system</h1>
        <div className={styles.themeSwitch} role="group" aria-label="Theme">
          {THEMES.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.themeButton}
              aria-pressed={theme === name}
              onClick={() => switchTheme(name)}
            >
              {name === "galerie" ? "Galerie" : "Noc"}
            </button>
          ))}
        </div>
      </header>

      <section className={styles.section} aria-labelledby="type-heading">
        <h2 id="type-heading" className={styles.sectionTitle}>
          Typography
        </h2>
        <blockquote className={styles.quote}>
          <p>„Cíl bez plánu je jen přání.“</p>
          <footer className={styles.quoteAuthor}>Antoine de Saint-Exupéry</footer>
        </blockquote>
        <p className={styles.display}>{PANGRAM_CS}</p>
        <p className={styles.body}>{PANGRAM_CS}</p>
        <p className={styles.body}>{PANGRAM_DE}</p>
        <p className={styles.muted}>Secondary text · 14:30 · 26. 9. 2026</p>
      </section>

      <section className={styles.section} aria-labelledby="components-heading">
        <h2 id="components-heading" className={styles.sectionTitle}>
          Components
        </h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className={styles.form}>
          <Field label="Citát" placeholder="Co vás žene dopředu?" hint="Zobrazí se na nástěnce." />
          <Field label="Autor" defaultValue="" error="Toto pole je povinné." />
          <Switch label="Spustit při přihlášení" />
          <Switch label="Režim tapety" defaultChecked />
        </div>
        <div className={styles.row}>
          <Dialog
            trigger={<Button>Open dialog</Button>}
            title="Přidat citát"
            description="Citát se objeví ve středu nástěnky."
            actions={
              <>
                <DialogClose asChild>
                  <Button variant="ghost">Zrušit</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="primary">Přidat</Button>
                </DialogClose>
              </>
            }
          >
            <Field label="Text citátu" />
          </Dialog>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="color-heading">
        <h2 id="color-heading" className={styles.sectionTitle}>
          Color
        </h2>
        <ul className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <li key={token} className={styles.swatch}>
              <span
                className={styles.swatchColor}
                style={{ background: `var(--color-${token})` }}
              />
              <code className={styles.swatchName}>--color-{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="surface-heading">
        <h2 id="surface-heading" className={styles.sectionTitle}>
          Surfaces
        </h2>
        <div className={styles.surfaces}>
          <div className={styles.surfaceCard}>Surface</div>
          <div className={styles.raisedCard}>Raised</div>
          <div className={styles.itemCard}>Board item</div>
          <div className={styles.accentCard}>Accent</div>
        </div>
      </section>
    </main>
  );
}
