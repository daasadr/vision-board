# Spec Delta

## Purpose

Interaktivní tlačítka na obrázcích nástěnky vedou k detailům snu nebo cíle – další fotky a text v malém okně, nebo webová stránka.

## ADDED Requirements

### Requirement: Správa hotspotů
Uživatel SHALL moci na obrázek přidat až 5 hotspotů, umístit je na libovolné místo obrázku, pojmenovat je a zvolit akci „detail“ nebo „odkaz“. Hotspot se pohybuje a škáluje s obrázkem.

#### Scenario: Přidání odkazu
- **WHEN** uživatel na obrázku moře přidá hotspot „Ubytování“ s odkazem https://example.com
- **THEN** na obrázku je malé tlačítko v místě, kam jej uživatel umístil

### Requirement: Bezpečné odkazy
Hotspot typu odkaz MUST přijmout jen adresy `http` a `https` a SHALL je otevřít ve výchozím prohlížeči OS, nikdy uvnitř aplikace.

#### Scenario: Nepovolené schéma
- **WHEN** uživatel zadá odkaz `file:///C:/Windows` nebo `javascript:...`
- **THEN** odkaz se neuloží a zobrazí se chyba validace

#### Scenario: Otevření odkazu
- **WHEN** uživatel klikne na hotspot s odkazem
- **THEN** stránka se otevře ve výchozím prohlížeči

### Requirement: Okno detailu
Hotspot typu detail SHALL otevřít malé okno s nadpisem, textem a galerií dalších obrázků (až 20, se stejnou kompresí jako obrázky nástěnky), ve kterém lze obrázky listovat. Okno SHALL jít zavřít klávesou Esc.

#### Scenario: Prohlížení detailu
- **WHEN** uživatel klikne na hotspot „Dům snů“ s 6 fotkami
- **THEN** otevře se okno detailu s první fotkou a lze listovat šipkami

### Requirement: Viditelnost hotspotů
Hotspoty SHALL být v klidu nenápadné a zvýrazní se při najetí na obrázek; v pop-upu jsou aktivní, na tapetě se nezobrazují.

#### Scenario: Tapeta
- **WHEN** je nástěnka zobrazena jako tapeta
- **THEN** hotspoty nejsou vidět
