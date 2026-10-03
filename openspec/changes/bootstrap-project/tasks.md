# Tasks

## 1. Kostra aplikace

- [x] 1.1 Vygenerovat Tauri 2 + React + TS + Vite projekt přes pnpm (identifier `eu.almost-there.visionboard`, productName „Vision Board“) a ověřit, že `pnpm tauri dev` otevře okno
- [x] 1.2 Zavést strukturu adresářů dle design.md (`src/app`, `src/design`, `src/i18n`, `src/lib/ipc.ts`, `src-tauri/src/{commands,domain,platform}`) a ověřit `cargo build` + `pnpm build`
- [x] 1.3 Přidat `tauri-plugin-single-instance` a ověřit, že druhé spuštění jen zaostří existující okno (manuálně + zápis do docs/testing.md)
- [x] 1.4 Přidat `tauri-plugin-window-state` s kontrolou dostupnosti monitoru a ověřit Rust testem logiku „poloha mimo monitory → vycentrovat“
- [x] 1.5 Nastavit `tauri-specta` pro generování TS typů commandů a ověřit, že ukázkový command `app_version` je volatelný z `lib/ipc.ts` s typem

## 2. Kvalitativní nástroje

- [x] 2.1 ESLint (typescript, react-hooks, jsx-a11y) + Prettier a ověřit `pnpm lint` bez chyb
- [x] 2.2 Vitest + Testing Library a ověřit ukázkový test přes `pnpm test`
- [x] 2.3 `cargo fmt`, `clippy -D warnings`, `cargo test` pro src-tauri a ověřit čistý běh
- [x] 2.4 Změřit klidovou paměť a CPU release buildu (Správce úloh) a zapsat výsledek do docs/performance.md
- [x] 2.5 Playwright s `mockIPC` proti `vite preview` a ověřit smoke test „okno se načte a zobrazí název“ přes `pnpm e2e`

## 3. Design systém

- [x] 3.1 Vybrat a přibalit fonty (subset WOFF2, OFL licence do `src/design/fonts/LICENSES`) – porovnat návrhy z design.md na ukázkové stránce a ověřit start bez sítě
- [x] 3.2 Definovat tokeny a témata Galerie a Noc v `src/design/tokens.css` a ověřit Vitest testem, že obě témata mají shodnou množinu tokenů
- [x] 3.3 Výchozí téma podle `prefers-color-scheme` s reakcí na změnu za běhu a ověřit unit testem + ručním přepnutím OS
- [x] 3.4 Stylelint s pravidlem proti pevným barvám/fontům/stínům mimo tokeny a ověřit, že testovací porušení build shodí
- [x] 3.5 Stylovaná primitiva Button, Field, Dialog, Switch (Radix headless) s fokusem a `prefers-reduced-motion` a ověřit na ukázkové stránce `/design` v obou tématech + axe kontrolou v Playwright
- [x] 3.6 Zdokumentovat design systém (principy, tokeny, použití primitiv) v docs/design-system.md

## 4. Lokalizace

- [x] 4.1 i18next s cs/en/de, detekce z `navigator.language`, fallback en a ověřit unit testy scénářů ze spec localization
- [x] 4.2 Test úplnosti klíčů napříč jazyky a ověřit, že chybějící klíč test shodí
- [x] 4.3 Pomocné funkce pro formát data/času přes `Intl` a ověřit unit testem formát pro de a cs

## 5. Git hooky a CI

- [x] 5.1 `lefthook.yml` s pre-commit (lint, format, stylelint, tsc, cargo fmt, clippy) a ověřit, že commit se chybou formátu je zastaven
- [x] 5.2 `scripts/agent-review.sh` (Claude Code CLI, code + security review nad diffem, graceful fallback bez CLI) napojený na pre-push a ověřit na testovací větvi
- [x] 5.3 `.github/workflows/ci.yml` (Windows + macOS: lint, testy, debug build) a ověřit `act` nebo prvním pushem
- [x] 5.4 `.github/workflows/security.yml` (Gitleaks, Trivy fs, Semgrep, libyear) a ověřit lokálním spuštěním Gitleaks a Semgrep
- [x] 5.5 Zdokumentovat workflow (hooky, CI, jak přeskočit v nouzi) v docs/development.md

## 6. Dokumentace a integrace

- [x] 6.1 Vyplnit CLAUDE.md (build/test příkazy, architektura, konvence) a docs/architecture.md
- [x] 6.2 Integrační kontrola: čistý klon → `pnpm install` → `pnpm tauri build` projde, hooky se nainstalují, `pnpm test`, `pnpm e2e`, `cargo test` zelené
