# Spec Delta

## Purpose

Persistentní, vizuálně výrazný ovládací prvek (podlouhlý 3D obdélník) na ploše, který připomíná existenci nástěnky a otevírá nastavení.

## ADDED Requirements

### Requirement: Zobrazení ovládacího prvku
Když aplikace běží a prvek není skrytý, SHALL být zobrazen podlouhlý 3D obdélník (max. 120×40 px) mimo hlavní panel / Dock a mimo přepínač oken (Alt+Tab). Výchozí poloha je pravý horní roh primárního monitoru.

#### Scenario: Start aplikace
- **WHEN** aplikace startuje, prvek není skrytý a uživatel ho nepřesunul
- **THEN** obdélník je vidět v pravém horním rohu a nepřekrývá systémové ovládací prvky oken maximalizovaných aplikací víc než o svou velikost

### Requirement: Vrstva prvku
Uživatel SHALL moci v nastavení zvolit, zda je prvek **za okny** (na úrovni plochy, ostatní okna ho překrývají) nebo **před okny** (vždy navrch). Výchozí MUST být „za okny“, aby prvek nepřekážel práci.

#### Scenario: Prvek za okny
- **WHEN** je zvolena vrstva „za okny“ a uživatel otevře jinou aplikaci přes místo, kde prvek leží
- **THEN** aplikace prvek překryje a prvek je vidět jen tam, kde je plocha volná

#### Scenario: Prvek před okny
- **WHEN** je zvolena vrstva „před okny“
- **THEN** prvek zůstává nad všemi okny

### Requirement: Přesun tažením
Uživatel SHALL moci prvek přesunout tažením myší v obou vrstvách; krátký klik bez tažení dál otevírá nastavení. Poloha MUST přetrvat restart. Pokud uložená poloha neleží na žádném připojeném monitoru, prvek se zobrazí ve výchozím rohu. Volba „Vrátit do rohu“ (v nabídce prvku a v nastavení) SHALL obnovit výchozí polohu.

#### Scenario: Odsunutí prvku
- **WHEN** uživatel prvek přetáhne jinam a restartuje aplikaci
- **THEN** prvek je na místě, kam ho přetáhl

#### Scenario: Odpojený monitor
- **WHEN** prvek byl přesunut na monitor, který už není připojený
- **THEN** prvek se zobrazí ve výchozím pravém horním rohu primárního monitoru

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
