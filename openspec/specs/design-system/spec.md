# design-system Specification

## Purpose
Zajišťuje jednotný, prémiový vzhled aplikace pomocí dvou ručně navržených vizuálních témat (Galerie a Noc) postavených na sdílené sadě design tokenů.

## Requirements

### Requirement: Dvě vizuální témata
Aplikace SHALL nabízet témata **Galerie** (světlé, teplé papírové tóny, serifová typografie citátů) a **Noc** (tmavé, průsvitné sklo, kovové akcenty). Každé téma MUST definovat všechny sémantické tokeny (pozadí, povrchy, text, akcent, okraje, stíny, rádiusy, typografie, pohyb).

#### Scenario: Úplnost tokenů
- **WHEN** automatický test porovná sady tokenů obou témat
- **THEN** obě témata definují stejnou množinu tokenů a žádný token nechybí

### Requirement: Výchozí téma podle systému
Pokud si uživatel téma výslovně nezvolil, aplikace SHALL použít Galerii ve světlém režimu OS a Noc v tmavém režimu OS a SHALL reagovat na změnu režimu OS za běhu.

#### Scenario: Přepnutí OS do tmavého režimu
- **WHEN** uživatel za běhu aplikace přepne OS do tmavého režimu
- **THEN** aplikace bez restartu přejde na téma Noc

### Requirement: Konzistentní použití tokenů
Komponenty UI MUST používat výhradně tokeny tématu, nikoli pevně zadané barvy, písma nebo stíny.

#### Scenario: Kontrola pevných barev
- **WHEN** proběhne lint stylů
- **THEN** build selže, pokud styl komponenty obsahuje barvu mimo definici tokenů

### Requirement: Offline typografie
Všechna písma SHALL být součástí aplikace; aplikace MUST NOT načítat fonty ani jiné zdroje vzhledu ze sítě.

#### Scenario: Start bez internetu
- **WHEN** aplikace startuje bez připojení k síti
- **THEN** texty se vykreslí v navržených písmech bez záložního systémového fontu

### Requirement: Přístupnost základních prvků
Interaktivní prvky SHALL mít viditelný stav fokusu a MUST dosahovat kontrastu textu alespoň WCAG AA v obou tématech; animace MUST respektovat systémové nastavení omezení pohybu.

#### Scenario: Omezení pohybu
- **WHEN** je v OS zapnuté omezení animací
- **THEN** přechody v aplikaci jsou okamžité nebo pouze prolínací
