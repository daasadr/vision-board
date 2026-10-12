# Proposal

## Why

Uživatelka (2026-10-12) chce v aplikaci jednoduchý, ale dostatečně popisný návod. Dosud byl návod jen v `docs/user/*.md` v repu, kam se uživatel aplikace nedostane. Navazuje na fáze 1–5 (zadani.txt bod 5) a na automatické aktualizace.

## What Changes

- Sekce **Nápověda** v okně nastavení: krátká témata (Začínáme, Nástěnka, Hotspoty, Úkoly, Naplánované zobrazení, Tapeta, Ovládací prvek a ikona, Soukromí, Aktualizace) v cs/en/de.
- Nápovědu otevře tlačítko na nástěnce, odkaz na prázdné nástěnce a položka **Nápověda** v nabídce ikony.

## Non-goals

- Interaktivní průvodce (onboarding krok za krokem), videa, vyhledávání v nápovědě.
- Online nápověda (aplikace má fungovat offline).

## Capabilities

### New Capabilities
- `in-app-help`: návod přímo v aplikaci a cesty, jak ho otevřít.

### Modified Capabilities
<!-- žádné -->

## Impact

- Jen frontend a texty v locales. Rust: `window_open_settings(section)` a položka v tray menu. Žádné nové závislosti.