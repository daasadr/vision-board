# Spec Delta

## Purpose

Okno nastavení je jediné místo, kde uživatel mění chování a vzhled aplikace; změny se ukládají a projeví okamžitě.

## ADDED Requirements

### Requirement: Okno nastavení
Aplikace SHALL poskytovat okno nastavení dostupné z ovládacího prvku, z tray nabídky a z hlavního okna. Změny SHALL být uloženy okamžitě bez tlačítka „Uložit“ a projeví se ve všech otevřených oknech do 1 sekundy.

#### Scenario: Změna tématu
- **WHEN** uživatel v nastavení zvolí téma Noc
- **THEN** hlavní okno i ovládací prvek se přepnou do tématu Noc a volba přetrvá po restartu

### Requirement: Volba tématu a jazyka
Uživatel SHALL moci zvolit téma Galerie, Noc nebo „podle systému“ a jazyk čeština, angličtina, němčina nebo „podle systému“.

#### Scenario: Ruční volba jazyka
- **WHEN** systém je v češtině a uživatel zvolí němčinu
- **THEN** celé rozhraní včetně tray nabídky je německy

### Requirement: Obnovení výchozích hodnot
Uživatel SHALL moci obnovit výchozí nastavení; obsah nástěnky MUST zůstat nedotčen.

#### Scenario: Reset nastavení
- **WHEN** uživatel zvolí „Obnovit výchozí“ a potvrdí
- **THEN** všechna nastavení mají výchozí hodnoty a položky nástěnky zůstanou beze změny
