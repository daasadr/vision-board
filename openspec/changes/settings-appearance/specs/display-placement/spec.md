# Spec Delta

## Purpose

Určuje, jakou část obrazovky nástěnka zabírá, když se zobrazuje mimo hlavní okno (naplánovaný pop-up, tapeta).

## ADDED Requirements

### Requirement: Režim umístění
Uživatel SHALL moci zvolit umístění „celá obrazovka“ nebo „částečné“. U částečného SHALL zvolit velikost (30–90 % šířky obrazovky) a ukotvení (střed nebo jeden z rohů). Nastavení MUST platit stejně pro všechny monitory.

#### Scenario: Částečné umístění vpravo dole
- **WHEN** uživatel zvolí „částečné“, 40 % a ukotvení vpravo dole
- **THEN** náhled v nastavení ukazuje nástěnku v pravém dolním rohu o šířce 40 % obrazovky

### Requirement: Náhled umístění
Nastavení SHALL zobrazovat živý náhled umístění na schématu obrazovky.

#### Scenario: Změna velikosti v náhledu
- **WHEN** uživatel mění posuvník velikosti
- **THEN** náhled se průběžně aktualizuje
