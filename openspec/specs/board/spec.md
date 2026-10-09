# board Specification

## Purpose

Nástěnka je plátno, na které uživatel skládá obrázky, citáty a texty reprezentující své cíle, upravuje je a které se trvale ukládá.

## Requirements

### Requirement: Typy položek
Nástěnka SHALL podporovat položky typu obrázek, citát (text a volitelný autor) a text (volný text se stylem nadpis nebo poznámka).

#### Scenario: Přidání citátu
- **WHEN** uživatel zvolí „Přidat citát“, zadá text a autora a potvrdí
- **THEN** na plátně se ve středu viditelné oblasti objeví citát vysázený typografií citátů aktuálního tématu

#### Scenario: Prázdný text
- **WHEN** uživatel potvrdí citát nebo text bez obsahu
- **THEN** položka se nevytvoří

### Requirement: Přesun a změna velikosti
Uživatel SHALL moci položku přesunout tažením, změnit její velikost úchyty (obrázky se zachováním poměru stran) a natočit ji v rozsahu ±15°. Položky MUST zůstat alespoň částečně (min. 10 %) uvnitř plátna.

#### Scenario: Přesun obrázku
- **WHEN** uživatel táhne obrázek na nové místo a pustí jej
- **THEN** obrázek zůstane na novém místě i po restartu aplikace

#### Scenario: Tažení mimo plátno
- **WHEN** uživatel pustí položku zcela mimo plátno
- **THEN** položka se přichytí tak, aby 10 % její plochy zůstalo na plátně

### Requirement: Pořadí vrstev
Uživatel SHALL moci položku přenést do popředí nebo do pozadí; naposledy přidaná položka je v popředí.

#### Scenario: Přenesení dopředu
- **WHEN** uživatel u překrytého obrázku zvolí „Do popředí“
- **THEN** obrázek se vykreslí nad všemi ostatními položkami

### Requirement: Úprava a smazání
Uživatel SHALL moci upravit text citátu a textové položky na místě a smazat libovolnou položku (klávesou Delete nebo z kontextové nabídky).

#### Scenario: Smazání položky
- **WHEN** uživatel vybere položku a stiskne Delete
- **THEN** položka zmizí z plátna a z uložených dat

### Requirement: Zpět a znovu
Nástěnka SHALL umožnit vrátit a zopakovat alespoň posledních 50 úprav (přidání, přesun, změna velikosti, otočení, úprava textu, smazání, pořadí) klávesovými zkratkami Ctrl/Cmd+Z a Ctrl/Cmd+Shift+Z.

#### Scenario: Obnovení smazané položky
- **WHEN** uživatel smaže obrázek a stiskne Ctrl+Z
- **THEN** obrázek se vrátí na původní místo se stejnou velikostí a pořadím

### Requirement: Automatické ukládání
Každá změna nástěnky SHALL být trvale uložena nejpozději 1 sekundu po jejím dokončení, bez akce uživatele. Pád aplikace MUST NOT poškodit dříve uložená data.

#### Scenario: Ukončení ihned po úpravě
- **WHEN** uživatel přesune položku a do 2 sekund ukončí aplikaci z tray nabídky
- **THEN** po dalším spuštění je položka na novém místě

### Requirement: Rozložení nezávislé na velikosti okna
Nástěnka SHALL mít pevný poměr stran plátna a při jakékoli velikosti okna MUST zobrazit všechny položky ve stejných vzájemných pozicích a poměrech (škálováním).

#### Scenario: Zmenšení okna
- **WHEN** uživatel zmenší okno na polovinu šířky
- **THEN** celá nástěnka je viditelná zmenšená a vzájemné rozmístění položek se nezmění

### Requirement: Prázdný stav
Prázdná nástěnka SHALL zobrazit úvodní výzvu s vysvětlením, jak přidat první obrázek, citát nebo text.

#### Scenario: První spuštění
- **WHEN** uživatel poprvé otevře aplikaci
- **THEN** vidí prázdnou nástěnku s výzvou a akcemi pro přidání obsahu
