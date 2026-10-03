# Spec Delta

## Purpose

Umožňuje obdarovanému uživateli s účtem Almost-there.eu odemknout prémiové funkce Vision Boardu uplatněním dárkového kódu.

## ADDED Requirements

### Requirement: Přihlášení účtem Almost-there.eu
Aktivace SHALL vyžadovat přihlášení k účtu Almost-there.eu v systémovém výchozím prohlížeči. Aplikace MUST NOT zobrazovat vlastní formulář pro heslo ani heslo zpracovávat.

#### Scenario: Zahájení aktivace
- **WHEN** uživatel v nastavení zvolí „Aktivovat dárek“
- **THEN** otevře se výchozí prohlížeč s přihlášením Almost-there.eu a po přihlášení se uživatel vrátí do aplikace

#### Scenario: Uživatel nemá účet
- **WHEN** uživatel bez účtu zahájí aktivaci
- **THEN** přihlašovací stránka Almost-there.eu mu nabídne registraci a po ní aktivace pokračuje

### Requirement: Dárkový kód a deep link
Uživatel SHALL moci zadat dárkový kód ručně nebo otevřít odkaz `visionboard://activate?code=<kód>`, který kód předvyplní. Aplikace MUST kód před použitím validovat formátem a MUST ignorovat jiné parametry odkazu.

#### Scenario: Otevření dárkového odkazu
- **WHEN** uživatel s nainstalovanou aplikací klikne na dárkový odkaz
- **THEN** aplikace se otevře na obrazovce aktivace s předvyplněným kódem a aktivace nezačne bez potvrzení uživatele

#### Scenario: Neplatný odkaz
- **WHEN** deep link obsahuje kód v nesprávném formátu
- **THEN** aplikace zobrazí chybu a nic neodešle na server

### Requirement: Výsledek aktivace
Po úspěšném ověření kódu serverem SHALL aplikace uložit licenci a okamžitě odemknout prémiové funkce. Při chybě (kód neplatný, již použitý, expirovaný, síť nedostupná) SHALL zobrazit lokalizovanou srozumitelnou zprávu a nic neodemknout.

#### Scenario: Již uplatněný kód
- **WHEN** uživatel zadá kód, který uplatnil jiný účet
- **THEN** zobrazí se zpráva „Tento kód už byl použit“ a prémiové funkce zůstanou zamčené

### Requirement: Bezpečné uložení
Přihlašovací tokeny SHALL být uloženy v úložišti pověření OS; licence SHALL být uložena lokálně a MUST být chráněna podpisem proti úpravě.

#### Scenario: Úprava souboru licence
- **WHEN** někdo ručně upraví uložený soubor licence
- **THEN** licence je vyhodnocena jako neplatná a prémiové funkce jsou zamčené

### Requirement: Deaktivace
Uživatel SHALL moci licenci na zařízení deaktivovat a odhlásit se; základní nástěnka a její obsah MUST zůstat zachovány.

#### Scenario: Odhlášení
- **WHEN** uživatel zvolí „Odhlásit a deaktivovat“
- **THEN** prémiové funkce se zamknou, obsah nástěnky zůstane a tokeny jsou z úložiště pověření odstraněny
