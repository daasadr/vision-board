# Proposal

## Why

Fáze 1 „Základ“ ze zadani.txt bod 5: samostatně použitelný produkt, tedy nástěnka, na kterou uživatel skládá obrázky, citáty a texty svých cílů, a která je po zavření okna dostupná z tray ikony. Všechny další fáze (pop-up, tapeta, hotspoty) jen zobrazují nebo rozšiřují tuto nástěnku.

## What Changes

- Plátno nástěnky s položkami tří typů: **obrázek**, **citát** (text + volitelný autor), **text** (volný nadpis/poznámka).
- Přidávání položek: přetažením souborů z OS, vložením ze schránky, přes dialog výběru souboru a tlačítky pro citát/text.
- Editace: přesun (drag & drop), změna velikosti, otočení o malý úhel, pořadí vrstev, úprava textu, smazání; zpět/znovu.
- Automatické ukládání do lokální databáze, rozložení nezávislé na velikosti okna (nástěnka se škáluje).
- Automatická komprese obrázků (zmenšení, WebP) a náhledy.
- Tray ikona: otevřít nástěnku, ukončit aplikaci; zavření okna aplikaci neukončí.
- Vrstva oprávnění (Entitlements) – dotaz „je funkce X dostupná?“; v této fázi vrací vždy ano.

## Non-goals

- Nastavení, rámování a styly položek nad rámec výchozího stylu tématu (fáze 2).
- Více nástěnek, split-screen, hotspoty (fáze 5).
- Synchronizace, cloud, sdílení.
- Automatický start s OS (fáze 2).

## Capabilities

### New Capabilities
- `board`: plátno nástěnky, položky, jejich editace, uspořádání, zpět/znovu a trvalé uložení.
- `media-import`: příjem obrazových souborů, validace, komprese a úložiště médií.
- `tray`: ikona v oznamovací oblasti / menu baru a životní cyklus aplikace bez otevřeného okna.
- `entitlements`: dotazování dostupnosti prémiových funkcí.

### Modified Capabilities
<!-- žádné – chování při zavření okna popisuje nová capability `tray` -->


## Impact

- Rust: `rusqlite` (bundled), `image`, `webp`, `tauri` tray feature; nové moduly `domain/board`, `domain/media`, `domain/entitlements`.
- Frontend: `src/app/board/*`, store nástěnky, IPC commands.
- Data v app data adresáři uživatele (`board.db`, `media/`).
