# Spec Delta

## Purpose

Umožňuje vizuálně sjednotit nebo odlišit položky nástěnky pomocí stylů rámování a skrýt texty, když uživatel chce čistě obrazovou nástěnku.

## ADDED Requirements

### Requirement: Styly rámování
Aplikace SHALL nabízet alespoň tyto styly rámu obrázků: bez rámu, paspartá, polaroid, tenká linka, sklo. Styl SHALL jít nastavit pro celou nástěnku a přepsat u jednotlivé položky. Každý styl MUST vypadat vhodně v obou tématech.

#### Scenario: Polaroid pro celou nástěnku
- **WHEN** uživatel zvolí výchozí rám „polaroid“
- **THEN** všechny obrázky bez vlastního rámu se zobrazí v polaroid rámu

#### Scenario: Výjimka pro jednu položku
- **WHEN** nástěnka má rám polaroid a uživatel u jednoho obrázku zvolí „bez rámu“
- **THEN** jen tento obrázek je bez rámu

### Requirement: Prémiové rámy
Styly označené jako prémiové SHALL být dostupné jen při oprávnění PremiumFrames; bez oprávnění SHALL být v nabídce viditelné se zámkem a vysvětlením, jak je získat.

#### Scenario: Zamčený styl
- **WHEN** oprávnění PremiumFrames není dostupné a uživatel klikne na prémiový rám
- **THEN** rám se nepoužije a zobrazí se informace o odemčení dárkovým kódem

### Requirement: Jen obrázky / s texty
Uživatel SHALL moci přepnout zobrazení nástěnky na „jen obrázky“, při kterém se citáty a texty nezobrazují (ale nemažou).

#### Scenario: Skrytí textů
- **WHEN** uživatel zapne „jen obrázky“
- **THEN** citáty a texty nejsou vidět a po vypnutí se vrátí na původní místa
