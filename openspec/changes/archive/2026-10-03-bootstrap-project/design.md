# Design

## Context

Projekt začíná od nuly (jen `zadani.txt`, `docs/rozhodnuti.md`, inicializovaný OpenSpec a Beads). Vývoj probíhá na Windows 11, Rust 1.98, Node 22, pnpm 10+. Motivace viz proposal.md – Why; požadavky viz specs/.

## Goals / Non-Goals

**Goals:**
- Architektura, do které půjdou fáze 1–6 přidat bez přestavby (okna na vyžádání, izolované platformní moduly, vrstva Entitlements).
- Kvalitativní brány běží od prvního commitu.

**Non-Goals:**
- Optimalizace velikosti instalátoru nad rámec výchozího release profilu (řeší se před vydáním).
- Plná E2E automatizace nativních oken (viz Decisions – Testování).

## Decisions

### Struktura repozitáře
```
src/                 React frontend
  app/               vstupní body oken (board, control, popup, wallpaper – zatím jen board)
  design/            tokeny, témata, fonty, primitiva (Button, Field, Dialog, Switch)
  i18n/              cs.json, en.json, de.json, inicializace
  lib/ipc.ts         typované obaly nad invoke() – jediné místo, kde frontend volá Rust
src-tauri/
  src/commands/      Tauri commands (tenká vrstva)
  src/domain/          doménová logika bez závislosti na Tauri (testovatelná cargo testem)
  src/platform/      mod.rs s traity + windows.rs / macos.rs / linux.rs (zatím prázdné)
e2e/                 Playwright testy + mock IPC
docs/                architektura, rozhodnutí, průvodce vývojem
```
Proč: oddělení `domain` od `commands` umožní testovat logiku bez spuštěné appky; `lib/ipc.ts` je jediný bod pro mockování v E2E.

### Jeden proces, okna na vyžádání
Tauri 2 s více okny v jednom procesu. Okna `control`, `popup`, `wallpaper` se v dalších fázích vytvářejí až při potřebě a při zavření se ruší (ne skrývají), aby neblokovala paměť webview. Alternativa (Electron, samostatné procesy) zamítnuta kvůli paměti. Pluginy: `tauri-plugin-single-instance`, `tauri-plugin-window-state` (obnova polohy s kontrolou monitoru).

### Styling: CSS Modules + CSS proměnné
Tokeny jako CSS custom properties v `design/tokens.css`, téma = `[data-theme="galerie"|"noc"]` na `<html>`. Komponenty v CSS Modules. Stylelint s pravidlem na zákaz pevných barev (`scale-unlimited/declaration-strict-value` pro color/background/box-shadow/font-family) mimo soubory tokenů.
Zamítnuto: Tailwind (vede k „generickému“ vzhledu a nutí utility-first i tam, kde chceme ručně laděné komponenty), shadcn/MUI (defaultní vzhled). Radix primitives jen headless kvůli přístupnosti (fokus, klávesnice, ARIA) – ~10–20 kB gzip na použitý primitiv.

### Typografie (návrh, finální volba v úkolu 3.1)
Fonty s licencí OFL, podpora Latin Extended (čeština, němčina), přibalené jako WOFF2 s podmnožinou znaků:
- Galerie: citáty *Fraunces* (variabilní serif), UI *Figtree*.
- Noc: citáty *Instrument Serif*, UI *Geist*.
Odhad: ~250 kB celkem.

### Lokalizace
`i18next` + `react-i18next`, jazyk z `navigator.language` (WebView přebírá jazyk OS), fallback `en`. Formáty přes `Intl`. Test porovnává klíče všech tří JSON souborů.

### Stav
Zustand (≈1 kB) – malý, bez boilerplatu, snadno mockovatelný. Redux zamítnut jako zbytečně těžký.

### Testování
- Unit: Vitest (frontend), `cargo test` (src-tauri/domain).
- E2E: Playwright proti `vite preview` s `mockIPC` z `@tauri-apps/api/mocks` – kryje UI flow na všech OS. Nativní chování (okna, tray, autostart) se ověřuje Rust testy a manuálním checklistem v `docs/testing.md`; Playwright nad reálným WebView2 přes CDP se zvažuje ve fázi 1 pro kritické flow.
Zamítnuto: WebdriverIO + tauri-driver jako hlavní nástroj – nefunguje na macOS a zadání požaduje Playwright.

### Lefthook
- `pre-commit` (paralelně, jen změněné soubory): eslint, prettier --check, stylelint, `tsc --noEmit`, `cargo fmt --check`, `cargo clippy -D warnings`.
- `pre-push`: `pnpm test`, `cargo test`, pak `scripts/agent-review.sh` – spustí `claude -p` s promptem pro code review a security review nad `git diff origin/main...HEAD`; nalezené problémy vysoké závažnosti push zastaví. Když CLI chybí, skript vypíše varování a push pustí (nesmí blokovat vývoj offline).

### CI (GitHub Actions)
- `ci.yml`: matrix windows-latest + macos-latest – install, lint, testy, `tauri build --debug`.
- `security.yml`: Gitleaks (celá historie), Trivy (fs scan – závislosti a konfigurace), Semgrep (p/typescript, p/rust, p/secrets), libyear (report stáří závislostí, zatím jen upozornění).

## Risks / Trade-offs

- [WebView2 procesy zvyšují paměť nad samotný proces] → limit 150 MB ve spec počítá i s nimi; měří se v úkolu 2.4.
- [Agentické review v pre-push zpomaluje push a stojí tokeny] → review jen nad diffem, lze přeskočit `LEFTHOOK=0` v nouzi (dokumentováno).
- [Mock IPC se může rozejít s reálným Rust API] → `lib/ipc.ts` je typovaný; typy commandů generované přes `tauri-specta`, mock implementuje stejné typy.
- [Fonty zvětší balíček] → subset WOFF2, max ~250 kB.

## Open Questions

- Finální páry fontů – rozhodne se vizuálním porovnáním v úkolu 3.1 (nemění specs ani strukturu úkolů).
