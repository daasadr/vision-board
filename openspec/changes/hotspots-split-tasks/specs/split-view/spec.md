# Spec Delta

## Purpose

Rozdělené zobrazení, kde jedna polovina ukazuje nástěnku (vize) a druhá úkoly na další den (kroky).

## ADDED Requirements

### Requirement: Rozdělené zobrazení
Uživatel SHALL moci zapnout split-screen, při kterém se nástěnka zobrazí v jedné polovině a seznam úkolů v druhé; strana nástěnky (vlevo/vpravo) je volitelná.

#### Scenario: Zapnutí v hlavním okně
- **WHEN** uživatel zapne split-screen s nástěnkou vlevo
- **THEN** levá polovina okna ukazuje zmenšenou nástěnku a pravá seznam úkolů

### Requirement: Kde split-screen platí
Split-screen SHALL jít nezávisle zapnout pro hlavní okno, pop-up a tapetu. Na tapetě je seznam úkolů jen ke čtení.

#### Scenario: Pop-up se split-screenem
- **WHEN** split-screen je zapnutý pro pop-up a nastane zobrazení
- **THEN** pop-up ukazuje nástěnku a úkoly a úkoly v něm lze odškrtnout

#### Scenario: Tapeta se split-screenem
- **WHEN** split-screen je zapnutý pro tapetu
- **THEN** tapeta ukazuje nástěnku a aktuální úkoly bez ovládacích prvků
