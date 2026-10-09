# tray Specification

## Purpose

Tray ikona (oznamovací oblast na Windows/Linuxu, menu bar na macOS) umožňuje aplikaci běžet bez otevřeného okna s minimální zátěží a nástěnku kdykoli otevřít.

## Requirements

### Requirement: Tray ikona a nabídka
Když aplikace běží, SHALL zobrazovat tray ikonu s nabídkou „Otevřít nástěnku“ a „Ukončit“ v jazyce rozhraní. Kliknutí levým tlačítkem na ikonu (Windows/Linux) SHALL otevřít nástěnku.

#### Scenario: Otevření z tray
- **WHEN** hlavní okno je zavřené a uživatel klikne na tray ikonu
- **THEN** nástěnka se otevře a získá fokus

### Requirement: Zavření okna neukončí aplikaci
Zavření hlavního okna SHALL okno zrušit (uvolnit jeho webview) a aplikace SHALL dál běžet jen s tray ikonou. Při prvním zavření SHALL aplikace jednorázově informovat, že běží dál v tray.

#### Scenario: První zavření okna
- **WHEN** uživatel poprvé zavře hlavní okno
- **THEN** zobrazí se jednorázové upozornění, že Vision Board běží v tray, a aplikace se neukončí

### Requirement: Klidová zátěž bez okna
Bez otevřeného okna MUST aplikace spotřebovávat méně než 40 MB paměti a MUST NOT provádět žádnou periodickou činnost, kterou nevyžaduje zapnutá funkce.

#### Scenario: Aplikace jen v tray
- **WHEN** hlavní okno je zavřené 60 sekund
- **THEN** paměť procesu aplikace je pod 40 MB a nejsou spuštěné procesy webview

### Requirement: Ukončení
Volba „Ukončit“ SHALL dokončit rozpracované ukládání a ukončit aplikaci včetně všech oken.

#### Scenario: Ukončení během importu
- **WHEN** probíhá komprese obrázku a uživatel zvolí „Ukončit“
- **THEN** aplikace počká na dokončení uložení (max. 5 s) a pak se ukončí
