# Spec Delta

## Purpose

Uživatel najde stručný návod ke všem funkcím přímo v aplikaci, ve svém jazyce a bez internetu.

## ADDED Requirements

### Requirement: Návod v aplikaci
Aplikace SHALL obsahovat sekci Nápověda s krátkými tématy ke každé funkci (nástěnka, hotspoty, úkoly, naplánované zobrazení, tapeta, ovládací prvek a ikona, soukromí, aktualizace) ve všech jazycích UI. Nápověda MUST fungovat offline. Volitelné funkce (úkoly) MUST být jako volitelné označené.

#### Scenario: Otevření z nabídky ikony
- **WHEN** uživatel v nabídce ikony zvolí Nápověda
- **THEN** otevře se okno nastavení na sekci Nápověda (i když už bylo otevřené na jiné sekci)

#### Scenario: Prázdná nástěnka
- **WHEN** uživatel otevře aplikaci poprvé a nástěnka je prázdná
- **THEN** vedle tlačítek pro přidání obsahu vidí odkaz „Jak Vision Board funguje?“, který otevře nápovědu