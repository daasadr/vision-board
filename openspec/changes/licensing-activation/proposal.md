# Proposal

## Why

Fáze 6 ze zadani.txt bod 5 a body 3.4 a 4: Vision Board je dárek pro uživatele Almost-there.eu. Prémiové funkce (styly rámování, tapeta, pop-upy) odemyká licence navázaná na účet Almost-there.eu. Po aktivaci musí appka fungovat offline, bez pravidelného dotazování serveru.

Upřesnění od uživatelky (2026-10-12): každý registrovaný uživatel Almost-there.eu dostane licenci ke svému účtu a může jednou darovat aplikaci jednomu člověku odkazem (dárková licence). Obdarovaný si vytvoří účet a licence se připíše jemu. Dárky, registrace a evidence licencí jsou celé na webu Almost-there.eu (Next.js, vlastní server) a implementuje je Claude Code v jeho repu podle `docs/almost-there-api.md`.

## What Changes

- Aktivace: přihlášení k účtu Almost-there.eu v systémovém prohlížeči (authorization code + PKCE, návrat deep linkem `visionboard://activate`, záložně ruční opsání kódu), vydání licence pro tuto instalaci.
- Licence: JWT podepsaný Ed25519 a vázaný na instalaci, uložený lokálně a ověřený offline vestavěným veřejným klíčem. Volitelná expirace s tichou obnovou.
- Napojení vrstvy Entitlements na licenci (dosud vše odemčeno, nově podle licence).
- Sekce „Licence“ v nastavení: stav, účet, aktivace, deaktivace zařízení.
- API kontrakt pro Almost-there.eu (`docs/almost-there-api.md`). Implementace je v jejich repu.

## Non-goals

- Dárková mechanika, registrace, alotmenty a UI „Darovat Vision Board“ v Almost-there.eu (jiné repo). Aplikace dárkové kódy vůbec nezná: dárek se uplatní na webu a aktivace pak probíhá stejně jako u vlastní licence.
- Platby přímo ve Vision Boardu.
- Synchronizace dat nástěnky s účtem.
- Dlouhodobé přihlášení v aplikaci (refresh tokeny). Po aktivaci aplikace drží jen licenci.

## Capabilities

### New Capabilities
- `license-activation`: přihlášení v prohlížeči, výměna kódu za licenci, deep link, ruční kód, deaktivace.
- `license-validation`: offline ověření licence, platnost, obnova a vliv na dostupnost prémiových funkcí.

### Modified Capabilities
- `entitlements`: „Vše odemčeno před fází licencí“ nahradí vazba na licenci.

## Impact

- Síť: jen při aktivaci, deaktivaci a obnově licence (HTTPS na almost-there.eu). Žádné jiné požadavky.
- Nové závislosti: `tauri-plugin-deep-link` (registrace schématu `visionboard://`), `ed25519-dalek` (ověření podpisu), HTTP klient `reqwest` (už ve stromu přes updater, viz změna `auto-update`), `sha2` (PKCE).
- Bez úložiště pověření OS (`keyring`): aplikace neukládá žádné přihlašovací tokeny.
- Review ověřování licence a aktivačního toku (dělá Claude, viz rozhodnutí 2026-10-08).
