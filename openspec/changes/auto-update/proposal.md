# Proposal

## Why

Vision Board se bude rozdávat uživatelům Almost-there.eu a dál se vyvíjí. Každá nová verze (oprava, nová funkce, napojení licencí ve fázi 6, rotace klíče) se k nim musí dostat bez ručního stahování. Rozhodnutí bod 5 a 6 v `docs/rozhodnuti.md`: auto-update přes `tauri-plugin-updater` s podepsanými aktualizacemi. Uživatelka 2026-10-12 odsouhlasila hosting na GitHub Releases.

## What Changes

- Aplikace si jednou denně (a při startu) zkontroluje, jestli na GitHub Releases není novější verze, a nabídne ji v nastavení, v tray menu a krátkým upozorněním v okně nástěnky. Instalace jedním kliknutím, aplikace se sama restartuje.
- Kontrolu jde v nastavení vypnout a spustit ručně. Nastavení ukazuje aktuální verzi.
- Aktualizace jsou podepsané vlastním klíčem (minisign). Aplikace nainstaluje jen balíček podepsaný tímto klíčem.
- Vydání verze: tag `vX.Y.Z` → GitHub Actions sestaví instalátor, podepíše ho a zveřejní release s `latest.json`. Postup v `docs/releasing.md`.

## Non-goals

- Code signing instalátoru (Authenticode, rozhodnutí: odloženo). SmartScreen může při první instalaci varovat.
- Aktualizace na macOS a Linuxu (zatím se vydává jen Windows; macOS bez podpisu Apple nejde rozumně distribuovat).
- Kanály (beta/stable), postupné nasazování, rollback.
- Automatická instalace bez potvrzení uživatele.

## Capabilities

### New Capabilities
- `app-updates`: kontrola, nabídka, instalace aktualizace a vydávání verzí.

### Modified Capabilities
<!-- žádné -->

## Impact

- Síť: `GET https://github.com/daasadr/vision-board/releases/latest/download/latest.json` max. jednou denně, a stažení instalátoru, když ho uživatel potvrdí. Žádné údaje o uživateli.
- Nová závislost `tauri-plugin-updater` (s `reqwest`, rustls a `minisign-verify`). Fáze 6 stejný HTTP klient použije pro licence.
- Tajemství v GitHubu: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Soukromý klíč má jen uživatelka (správce hesel) a GitHub.
- Nové soubory: `.github/workflows/release.yml`, `docs/releasing.md`, `CHANGELOG.md`, `scripts/version.mjs`.
