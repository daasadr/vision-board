# Proposal

## Why

Fáze 5 ze zadani.txt bod 5 a body 2.4 (split-screen) a 2.5: obrázek cíle má vést dál – k detailům a dalším fotkám snu nebo k webu (např. vysněná destinace). Split-screen propojuje vizi s konkrétními kroky na zítřek, což je jádro filozofie Almost-there.eu.

## What Changes

- Hotspoty na obrázcích: malá tlačítka na obrázku, každé buď otevře okno detailu (galerie dalších fotek + text), nebo odkaz ve výchozím prohlížeči.
- Split-screen režim: polovina nástěnka, polovina seznam úkolů na další den; lze zapnout pro hlavní okno, pop-up i tapetu (tam jen ke čtení).
- Lokální seznam úkolů (přidat, odškrtnout, přeřadit, přesun nedokončených na další den).
- Příprava rozhraní pro pozdější synchronizaci úkolů s Almost-there.eu (bez implementace).

## Non-goals

- Synchronizace úkolů s Almost-there.eu (samostatná budoucí změna po fázi 6).
- Hotspoty na tapetě (tapeta je jen zobrazovací).
- Plnohodnotný task manager (projekty, štítky, připomínky).

## Capabilities

### New Capabilities
- `hotspots`: interaktivní tlačítka na obrázcích a okno detailu.
- `daily-tasks`: lokální seznam úkolů na další den.
- `split-view`: rozdělené zobrazení nástěnky a úkolů.

### Modified Capabilities
<!-- žádné -->

## Impact

- DB: tabulky `hotspots`, `detail_media`, `tasks`; `tauri-plugin-opener` pro odkazy; nové okno `detail`.
- Závisí na board-core (položky, média); split-view v pop-upu a tapetě závisí na fázích 3 a 4 (pokud nejsou hotové, split-view platí jen pro hlavní okno a doplní se).
