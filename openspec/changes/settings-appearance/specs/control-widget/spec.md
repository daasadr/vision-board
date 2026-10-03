# Spec Delta

## Purpose

Persistentní, vizuálně výrazný ovládací prvek (podlouhlý 3D obdélník) na ploše, který připomíná existenci nástěnky a otevírá nastavení.

## ADDED Requirements

### Requirement: Zobrazení ovládacího prvku
Když aplikace běží a prvek není skrytý, SHALL být v pravém horním rohu primárního monitoru zobrazen podlouhlý 3D obdélník vždy nad ostatními okny, mimo hlavní panel / Dock a mimo přepínač oken (Alt+Tab).

#### Scenario: Start aplikace
- **WHEN** aplikace startuje a prvek není skrytý
- **THEN** obdélník je vidět v pravém horním rohu a nepřekrývá systémové ovládací prvky oken maximalizovaných aplikací víc než o svou velikost (max. 120×40 px)

### Requirement: Interakce
Klik na prvek SHALL otevřít nastavení; najetí myší SHALL zobrazit jemnou 3D reakci (naklonění/světlo) respektující omezení pohybu.

#### Scenario: Klik na obdélník
- **WHEN** uživatel klikne na obdélník
- **THEN** otevře se okno nastavení

### Requirement: Skrytí a obnovení
Uživatel SHALL moci prvek skrýt (z jeho kontextové nabídky nebo v nastavení) a znovu zobrazit v nastavení nebo v tray nabídce.

#### Scenario: Skrytí
- **WHEN** uživatel zvolí „Skrýt“ v kontextové nabídce obdélníku
- **THEN** obdélník zmizí a nezobrazí se ani po restartu, dokud jej uživatel v nastavení nezapne

### Requirement: Lehkost
Ovládací prvek MUST NOT spotřebovávat v klidu CPU a SHALL přidat nejvýše 30 MB paměti.

#### Scenario: Klidový stav prvku
- **WHEN** prvek je zobrazený 60 s bez interakce
- **THEN** jeho vykreslování nespotřebovává CPU (žádné nekonečné animace)
