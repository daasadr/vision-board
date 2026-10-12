# Spec Delta

## Purpose

Umožňuje uživateli s účtem Almost-there.eu (vlastní nebo darovanou licencí) odemknout prémiové funkce Vision Boardu na svém počítači.

## ADDED Requirements

### Requirement: Přihlášení účtem Almost-there.eu
Aktivace SHALL probíhat přihlášením k účtu Almost-there.eu v systémovém výchozím prohlížeči. Aplikace MUST NOT zobrazovat vlastní formulář pro heslo ani heslo zpracovávat.

#### Scenario: Zahájení aktivace
- **WHEN** uživatel v nastavení zvolí „Aktivovat“
- **THEN** otevře se výchozí prohlížeč se stránkou aktivace Almost-there.eu a po přihlášení a potvrzení se uživatel vrátí do aplikace

#### Scenario: Uživatel nemá účet
- **WHEN** uživatel bez účtu zahájí aktivaci
- **THEN** stránka Almost-there.eu mu nabídne registraci a po ní aktivace pokračuje

### Requirement: Výměna kódu za licenci
Aplikace SHALL vyměnit jednorázový aktivační kód za licenci jen spolu s tajným ověřovačem (PKCE) z právě zahájené aktivace. Kód z deep linku SHALL přijmout jen se shodným parametrem `state`. Aplikace MUST kód před odesláním validovat formátem a MUST ignorovat jiné parametry odkazu.

#### Scenario: Návrat deep linkem
- **WHEN** prohlížeč po potvrzení otevře `visionboard://activate?code=…&state=…` se shodným `state`
- **THEN** aplikace kód vymění za licenci a ukáže výsledek

#### Scenario: Cizí odkaz
- **WHEN** aplikace dostane aktivační odkaz bez zahájené aktivace nebo s jiným `state`
- **THEN** nic neodešle na server a nic neodemkne

#### Scenario: Ruční opsání kódu
- **WHEN** se deep link neotevře a uživatel opíše kód zobrazený na stránce do aplikace
- **THEN** aplikace kód vymění stejně jako z odkazu

### Requirement: Výsledek aktivace
Po přijetí platné licence SHALL aplikace licenci uložit a odemknout prémiové funkce. Při chybě (kód neplatný nebo prošlý, účet bez licence, příliš mnoho zařízení, síť nedostupná) SHALL zobrazit lokalizovanou srozumitelnou zprávu a nic neodemknout.

#### Scenario: Účet bez licence
- **WHEN** se přihlásí účet, který licenci nemá
- **THEN** aplikace zobrazí zprávu s odkazem na Almost-there.eu a prémiové funkce zůstanou zamčené

### Requirement: Bezpečné uložení
Licence SHALL být uložena lokálně a MUST být chráněna podpisem proti úpravě. Aplikace MUST NOT ukládat přihlašovací údaje ani tokeny účtu.

#### Scenario: Úprava uložené licence
- **WHEN** někdo ručně upraví uloženou licenci
- **THEN** licence je vyhodnocena jako neplatná a prémiové funkce jsou zamčené

### Requirement: Deaktivace
Uživatel SHALL moci licenci na zařízení deaktivovat. Základní nástěnka a její obsah MUST zůstat zachovány.

#### Scenario: Deaktivace
- **WHEN** uživatel zvolí „Deaktivovat na tomto počítači“
- **THEN** prémiové funkce se zamknou, obsah nástěnky zůstane, licence se smaže a server se (pokud je dostupný) dozví, že místo pro zařízení je volné
