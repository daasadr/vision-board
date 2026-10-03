# Proposal

## Why

Fáze 4 ze zadani.txt bod 5 a body 2.1 (režim 1) a 3.1: pasivní připomínání. Nástěnka je trvale vidět jako tapeta plochy za ikonami, takže ji uživatel vidí pokaždé, když se podívá na plochu, a nic ho neruší.

## What Changes

- Windows: nástěnka vykreslená za ikonami plochy (WorkerW), na všech monitorech, obnova po restartu Průzkumníka a změně monitorů.
- macOS: okno na úrovni plochy pod ikonami na všech Spaces a monitorech.
- Linux: export nástěnky jako obrázku a nastavení jako systémové tapety (kde to DE umožňuje), jinak jen export souboru.
- Nastavení „Tapeta“: zapnout/vypnout, spustit jako tapetu při startu, obnovit původní tapetu při vypnutí.
- Prémiová funkce (oprávnění Wallpaper).

## Non-goals

- Interaktivita tapety (kliknutí, hotspoty) – tapeta je jen zobrazovací (docs/rozhodnuti.md bod 1).
- Animovaná / video tapeta.
- Plná live tapeta na Linuxu.

## Capabilities

### New Capabilities
- `wallpaper`: zobrazení nástěnky jako tapety plochy a jeho životní cyklus.

### Modified Capabilities
<!-- žádné -->

## Impact

- Nativní moduly `platform/windows.rs` (FindWindow Progman, SendMessageTimeout 0x052C, EnumWindows → WorkerW, SetParent), `platform/macos.rs` (NSWindow level kCGDesktopWindowLevel, collectionBehavior), `platform/linux.rs` (export + gsettings/feh fallback).
- Designová otázka pro design.md této fáze: živé webview okno vs. vyrenderovaný statický snímek nástěnky zobrazený nativně (výrazně menší paměť; snímek se přegeneruje po změně nástěnky). Rozhodne se měřením na výsledcích fáze 3.
- Codex review nativního FFI.
