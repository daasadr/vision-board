# Proposal

## Why

Projekt je zatím jen zadání. Než začne vznikat samotná nástěnka (fáze 1), potřebujeme spustitelnou kostru aplikace, design systém se dvěma tématy, lokalizaci a automatické kontroly kvality. Bez nich by se „nevibecoded“ vzhled, lehkost a bezpečnost dohánějí zpětně – a to u projektu udržovaného primárně agentem nefunguje.

## What Changes

- Kostra Tauri 2 aplikace (Rust + React/TypeScript/Vite, pnpm) s identifikátorem `eu.almost-there.visionboard`, jedinou instancí a hlavním oknem.
- Design systém: tokeny (barvy, typografie, stíny, rádiusy, pohyb) a dvě témata **Galerie** (světlé, papírové, serif) a **Noc** (tmavé, sklo, kovové akcenty); výchozí téma podle světlého/tmavého režimu OS. Přibalené fonty, sada základních stylovaných primitiv (tlačítko, pole, dialog, přepínač).
- Lokalizace cs/en/de s výběrem podle jazyka systému a fallbackem na angličtinu.
- Kvalita: ESLint + Prettier, `cargo fmt` + `clippy`, Vitest, `cargo test`, Playwright proti frontendu s mockovaným Tauri IPC.
- Lefthook: pre-commit (lint, formát, typy), pre-push (testy + agentické code/security review přes Claude Code CLI).
- CI (GitHub Actions): build a testy na Windows/macOS, Trivy, Gitleaks, Semgrep, libyear.
- Kostra dokumentace (`docs/`), vyplněný `CLAUDE.md`.

## Non-goals

- Žádná funkce nástěnky (fáze 1), žádné nastavení kromě automatického výběru tématu a jazyka.
- Žádný code signing ani publikace instalátorů (odloženo, viz docs/rozhodnuti.md).
- Žádná síťová komunikace.

## Capabilities

### New Capabilities
- `app-shell`: spuštění aplikace, jediná instance, hlavní okno, chování při zavření.
- `design-system`: vizuální témata Galerie a Noc, jejich výchozí volba a konzistentní použití tokenů.
- `localization`: jazyk UI (cs/en/de), jeho detekce a fallback.

### Modified Capabilities
<!-- žádné – první změna projektu -->

## Impact

- Nové adresáře `src/` (frontend), `src-tauri/` (Rust), `e2e/`, `.github/workflows/`, `lefthook.yml`.
- Závislosti: tauri 2, react, vite, zustand, i18next, @radix-ui (headless), vitest, playwright, eslint, prettier.
- Fáze 0 z plánu (předchází fázi 1 „Základ“ v zadani.txt bod 5).
