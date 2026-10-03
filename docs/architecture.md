# Architektura

Stav po fázi 0 (bootstrap-project). Každá další fáze sem doplní svou část.

## Přehled

```
┌─────────────────────────── proces vision-board (Rust, Tauri 2) ───────────────────────────┐
│  lib.rs            pluginy (single-instance, window-state), registrace commandů, setup      │
│  window_manager    vytváření / obnova / zaostření oken (okna na vyžádání, po zavření zrušená)│
│  commands/         tenká IPC vrstva, tauri-specta → src/lib/bindings.ts                    │
│  domain/           doménová logika bez závislosti na Tauri (cargo test)                    │
│  platform/         jediné místo pro FFI a unsafe (Win32 / AppKit / X11), zatím prázdné      │
└──────────────┬─────────────────────────────────────────────────────────────────────────────┘
               │ IPC (invoke)
┌──────────────┴────────── WebView2 / WKWebView (msedgewebview2 procesy) ────────────────────┐
│  src/main.tsx      téma + jazyk před prvním vykreslením → <Root>                            │
│  src/app/          kořeny oken (board; /design = ukázka design systému)                     │
│  src/lib/ipc.ts    jediný přístup k Rustu (typovaný, v E2E mockovaný)                       │
│  src/design/       tokeny, témata Galerie/Noc, fonty, komponenty                            │
│  src/i18n/         cs/en/de, detekce jazyka, formáty data a času                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Klíčová rozhodnutí

Podrobné zdůvodnění je v `openspec/changes/bootstrap-project/design.md`. Tady je jen shrnutí.

- **Jeden proces a okna na vyžádání.** Okno `board` je v `tauri.conf.json` deklarované s `create: false` a vytváří ho `window_manager::open_board`, stejně jako ho později znovu vytvoří tray. Druhé spuštění aplikace (single-instance) zavolá tutéž funkci.
- **Obnova polohy okna.** Plugin window-state ukládá polohu a velikost (bez viditelnosti). Při otevření se poloha obnoví a `domain::window_placement` zkontroluje, že se titulek okna dá chytit na některém monitoru. Když ne, okno se vycentruje na primárním monitoru.
- **Typované IPC.** Rust commandy mají `#[specta::specta]` a jsou registrované v `commands::builder()`. Test `export_bindings` generuje `src/lib/bindings.ts` a CI hlídá, že soubor odpovídá aktuálnímu kódu.
- **`domain` místo `core`.** Modul `core` by zastínil standardní crate `core` a rozbíjel makra.
- **Windows manifest.** `build.rs` vkládá `windows-app-manifest.xml` (Common Controls v6, DPI awareness) do všech binárek, jinak `cargo test` na Windows padá se `STATUS_ENTRYPOINT_NOT_FOUND`.
- **Bezpečnost.** Přísná CSP (`tauri.conf.json`), capability `default` jen s `core:default` pro okno `board`, `unsafe_code = "deny"` mimo `platform`.
- **Téma a jazyk.** Obojí se nastaví synchronně před prvním vykreslením, aby okno neproblikla. Výchozí volba se řídí OS (světlý/tmavý režim, jazyk WebView). Ruční volbu přidá fáze 2.

## Data

Zatím žádná perzistentní data aplikace. Plugin window-state ukládá `.window-state.json` do adresáře konfigurace aplikace. Databázi nástěnky přidá fáze 1 (`board-core`).

## Kde co najít

| Chci změnit…             | Soubor                                               |
| ------------------------ | ---------------------------------------------------- |
| barvy, stíny, typografii | `src/design/tokens.css`                              |
| texty UI                 | `src/i18n/locales/{cs,en,de}.json`                   |
| přidat Rust command      | `src-tauri/src/commands/`, pak `pnpm bindings`       |
| chování oken             | `src-tauri/src/window_manager.rs`, `tauri.conf.json` |
| oprávnění webview        | `src-tauri/capabilities/default.json`                |
