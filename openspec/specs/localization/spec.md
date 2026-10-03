# localization Specification

## Purpose
Umožňuje používat aplikaci v češtině, angličtině a němčině a určuje, jak se jazyk rozhraní vybírá.

## Requirements

### Requirement: Podporované jazyky
Aplikace SHALL mít kompletní texty rozhraní v češtině, angličtině a němčině. Každý text MUST existovat ve všech třech jazycích.

#### Scenario: Chybějící překlad
- **WHEN** automatický test porovná klíče jazykových souborů
- **THEN** test selže, pokud některý klíč chybí v kterémkoli jazyce

### Requirement: Detekce jazyka
Pokud uživatel jazyk nezvolil, aplikace SHALL použít jazyk systému, pokud je podporovaný, jinak angličtinu.

#### Scenario: Systém v češtině
- **WHEN** jazyk systému je čeština
- **THEN** rozhraní se zobrazí česky

#### Scenario: Nepodporovaný jazyk systému
- **WHEN** jazyk systému je francouzština
- **THEN** rozhraní se zobrazí anglicky

### Requirement: Lokalizované formáty
Data a časy SHALL být formátované podle zvoleného jazyka rozhraní.

#### Scenario: Formát času v němčině
- **WHEN** je rozhraní v němčině a zobrazuje se čas 14:30
- **THEN** čas je zobrazen ve 24hodinovém formátu podle německých konvencí
