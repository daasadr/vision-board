# Spec Delta

## REMOVED Requirements

### Requirement: Vše odemčeno před fází licencí
**Reason**: Fáze 6 zavádí licence; dostupnost prémiových funkcí určuje licence.
**Migration**: Funkce se dál ptají přes `Entitlements`; odpověď nově dává platná licence (viz `license-validation`).

## ADDED Requirements

### Requirement: Dostupnost podle licence
Dotaz na prémiovou funkci SHALL vracet „dostupné“ právě tehdy, když je uložena platná licence, která funkci uvádí. Změna licence (aktivace, deaktivace, expirace) SHALL změnit odpověď bez restartu aplikace.

#### Scenario: Po aktivaci
- **WHEN** uživatel aktivuje licenci s funkcí tapety
- **THEN** přepínač tapety v nastavení je hned dostupný

#### Scenario: Po deaktivaci
- **WHEN** uživatel licenci deaktivuje
- **THEN** dotaz na režim tapety vrací „nedostupné“
