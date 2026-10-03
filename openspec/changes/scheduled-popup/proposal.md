# Proposal

## Why

Fáze 3 ze zadani.txt bod 5 a body 2.1 (režim 3) a 3.2: aktivní připomínání – nástěnka se v naplánovaný čas zobrazí přes všechna okna, ale jen ve chvíli, kdy tím uživatele nevyruší uprostřed práce, hovoru nebo prezentace. Tím appka plní svůj hlavní účel i u lidí, kteří plochu nevidí.

## What Changes

- Plánování zobrazení: konkrétní časy a/nebo interval, dny v týdnu, délka zobrazení.
- Detekce aktivity: čekání na pauzu ve vstupu (jen čas od posledního vstupu), respektování režimu nerušit / fullscreen / prezentace, maximální doba odkladu.
- Pop-up přes všechna okna na všech monitorech v nastaveném umístění, s tlačítky Zavřít a Odložit, automatické zavření po uplynutí délky.
- Sekce „Časování“ v nastavení.
- Prémiová funkce (oprávnění ScheduledPopup).

## Non-goals

- Zobrazení jako tapeta (fáze 4).
- Notifikace OS / zvuky.
- Sledování obsahu psaní, aktivních aplikací nebo oken jinak než jako příznak „fullscreen / nerušit“.

## Capabilities

### New Capabilities
- `popup-schedule`: kdy a jak často se nástěnka zobrazuje.
- `activity-detection`: rozhodování, zda je vhodná chvíle pro zobrazení, s garancí soukromí.
- `popup-display`: samotné zobrazení přes okna, jeho ovládání a ukončení.

### Modified Capabilities
<!-- žádné -->

## Impact

- Nativní moduly `platform/windows.rs` (GetLastInputInfo, SHQueryUserNotificationState), `platform/macos.rs` (CGEventSourceSecondsSinceLastEventType, detekce fullscreen), `platform/linux.rs` (XScreenSaverQueryInfo; na Wayland omezeně).
- Časovač v Rust procesu (jediné plánované probuzení, žádné polling bez zapnutého režimu).
- Codex review nativního FFI.
