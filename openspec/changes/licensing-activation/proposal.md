# Proposal

## Why

Fáze 6 ze zadani.txt bod 5 a body 3.4 a 4: Vision Board je dárek pro předplatitele Almost-there.eu. Prémiové funkce (styly rámování, tapeta, pop-upy) se odemykají dárkovým kódem navázaným na účet Almost-there.eu. Po aktivaci musí appka fungovat offline, bez pravidelného dotazování serveru.

## What Changes

- Aktivace: přihlášení k účtu Almost-there.eu v systémovém prohlížeči (OAuth 2.0 authorization code + PKCE), uplatnění dárkového kódu, vydání licence.
- Deep link `visionboard://activate?code=…` z dárkového odkazu předvyplní kód.
- Licence: podepsaný token (Ed25519, formát JWT/PASETO – rozhodne design.md) uložený lokálně, ověřený offline vestavěným veřejným klíčem.
- Napojení vrstvy Entitlements na licenci (dosud vše odemčeno → nově dle licence).
- Sekce „Licence“ v nastavení: stav, účet, odhlášení/deaktivace zařízení.
- Návrh API kontraktu pro Almost-there.eu (`docs/almost-there-api.md`) – implementace je v jejich repu.

## Non-goals

- Implementace gift mechaniky, alotmentů a UI „Darovat vision board“ v Almost-there.eu (jiné repo).
- Platby přímo ve Vision Boardu.
- Synchronizace dat nástěnky s účtem.

## Capabilities

### New Capabilities
- `license-activation`: přihlášení, uplatnění kódu, deep link a uložení licence.
- `license-validation`: offline ověření licence, platnost, obnova a vliv na dostupnost prémiových funkcí.

### Modified Capabilities
<!-- `entitlements` z board-core bude po archivaci upraven: "Vše odemčeno před fází licencí" nahradí vazba na licenci. Delta se doplní v design fázi této změny, až bude `entitlements` v openspec/specs. -->

## Impact

- Síť: jediná komunikace s almost-there.eu při aktivaci a volitelné obnově (HTTPS, certifikát pinning zvážit v design.md).
- `tauri-plugin-deep-link`, `tauri-plugin-opener`, `ed25519-dalek`, HTTP klient (`reqwest` s rustls).
- Uložení tokenů v úložišti pověření OS (Windows Credential Manager / macOS Keychain) přes `keyring`.
- Codex review ověřování licence a OAuth toku.
- Otevřená rozhodnutí pro Almost-there.eu (zadani.txt bod 4): obnovování alotmentu kódů – nemá vliv na tuto appku.
