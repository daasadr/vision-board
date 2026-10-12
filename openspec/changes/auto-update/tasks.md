# Tasks

## 1. Podpis a konfigurace

- [x] 1.1 Klíč `tauri signer generate` mimo repo, veřejný klíč a endpoint v `tauri.conf.json`, `createUpdaterArtifacts`, plugin `tauri-plugin-updater` a ověřit `pnpm tauri build` s klíčem (vznikne `.sig`)

## 2. Kontrola a instalace

- [x] 2.1 `domain::updates` (příští kontrola) a `Settings.updates.autoCheck` a ověřit `cargo test`
- [x] 2.2 `updates.rs` (úloha na pozadí, ruční kontrola, instalace, tray položka, událost) a commands `update_status`, `update_check`, `update_install` a ověřit `cargo test` + ručně proti lokálnímu `latest.json`
- [x] 2.3 UI: Nastavení → Aktualizace, upozornění v okně nástěnky (cs/en/de) a ověřit E2E s mockem IPC

## 3. Vydávání

- [x] 3.1 `scripts/version.mjs`, `CHANGELOG.md`, `.github/workflows/release.yml` (kontrola verze, tauri-action, poznámky z changelogu) a ověřit lokálním během skriptů a prvním vydáním
- [x] 3.2 Celý tok ručně: nainstalovat starší verzi, nabídnout novější, nainstalovat, data zůstala, aplikace se spustila

## 4. Dokončení

- [x] 4.1 Review (ověření podpisu, tajemství v CI, přepsání endpointu) a zapracovat nálezy
- [x] 4.2 Dokumentace: `docs/releasing.md` (i pro okno Almost-there), `docs/user/settings.md`, `docs/architecture.md`, měření velikosti exe do `docs/performance.md`
