# entitlements Specification

## Purpose

Jednotné místo, kde se aplikace ptá, zda je prémiová funkce dostupná, aby šlo freemium model zapnout ve fázi licencí bez zásahu do jednotlivých funkcí.

## Requirements

### Requirement: Dotaz na dostupnost funkce
Aplikace SHALL rozhodovat o dostupnosti každé prémiové funkce (prémiové styly rámování, režim tapety, naplánované pop-upy) výhradně přes dotaz na oprávnění podle identifikátoru funkce.

#### Scenario: Neznámá funkce
- **WHEN** se kód zeptá na funkci, která není v seznamu prémiových funkcí
- **THEN** funkce je vyhodnocena jako dostupná (základní funkce jsou vždy zdarma)

### Requirement: Vše odemčeno před fází licencí
Dokud není implementována aktivace licence, SHALL dotaz vracet „dostupné“ pro všechny funkce.

#### Scenario: Dotaz na režim tapety
- **WHEN** se kód zeptá na dostupnost režimu tapety
- **THEN** odpověď je „dostupné“
