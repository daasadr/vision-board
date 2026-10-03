# Spec Delta

## Purpose

Jednoduchý lokální seznam úkolů na další den, který propojuje vizi na nástěnce s konkrétními kroky.

## ADDED Requirements

### Requirement: Úkoly na den
Uživatel SHALL moci přidat úkol (text do 200 znaků) k určitému dni (výchozí zítřek), odškrtnout jej, upravit, smazat a změnit pořadí.

#### Scenario: Plánování večer
- **WHEN** uživatel večer přidá tři úkoly
- **THEN** úkoly jsou přiřazené zítřejšímu dni a zobrazí se v pořadí přidání

### Requirement: Přenos nedokončených úkolů
Nedokončené úkoly minulých dnů SHALL být při prvním zobrazení nového dne nabídnuty k přesunutí na dnešek nebo k zahození.

#### Scenario: Nový den
- **WHEN** včera zůstaly 2 neodškrtnuté úkoly a uživatel otevře seznam
- **THEN** aplikace nabídne tyto 2 úkoly přesunout na dnešek

### Requirement: Rozhraní pro budoucí synchronizaci
Každý úkol SHALL mít stabilní identifikátor a časy vytvoření a změny, aby jej šlo později synchronizovat s Almost-there.eu; do té doby MUST úkoly zůstat pouze lokálně.

#### Scenario: Offline úkoly
- **WHEN** uživatel přidá úkol
- **THEN** aplikace neprovede žádný síťový požadavek
