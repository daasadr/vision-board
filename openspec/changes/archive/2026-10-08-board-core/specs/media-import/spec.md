# Spec Delta

## Purpose

Zajišťuje příjem obrázků do aplikace a jejich automatickou kompresi, aby aplikace zůstala lehká bez ohledu na velikost vkládaných souborů.

## ADDED Requirements

### Requirement: Zdroje obrázků
Aplikace SHALL přijmout obrázky přetažením souborů z OS na plátno, vložením ze schránky (Ctrl/Cmd+V) a výběrem v systémovém dialogu. Při přetažení více souborů SHALL vytvořit položku pro každý platný soubor.

#### Scenario: Přetažení tří fotek
- **WHEN** uživatel přetáhne na plátno tři soubory JPG
- **THEN** na plátně vzniknou tři obrázkové položky rozmístěné kolem místa puštění

### Requirement: Podporované formáty
Aplikace SHALL přijmout formáty JPEG, PNG, WebP a GIF (první snímek) a MUST odmítnout ostatní soubory i soubory větší než 50 MB se srozumitelnou lokalizovanou zprávou; ostatní soubory ze stejné dávky se zpracují.

#### Scenario: Nepodporovaný soubor v dávce
- **WHEN** uživatel přetáhne jeden PNG a jeden PDF
- **THEN** PNG se přidá a zobrazí se zpráva, že PDF není podporovaný obrázek

### Requirement: Automatická komprese
Každý přijatý obrázek SHALL být před uložením zmenšen tak, aby delší strana měla nejvýše 2560 px, a uložen ve formátu WebP; MUST zachovat orientaci podle EXIF a MUST odstranit metadata (EXIF, GPS). Originál se neukládá.

#### Scenario: Fotka z telefonu
- **WHEN** uživatel vloží 12MP fotku 8 MB s EXIF orientací „otočeno“ a GPS polohou
- **THEN** uložený soubor má delší stranu max. 2560 px, je správně otočený, neobsahuje GPS ani jiná EXIF data a má typicky méně než 1 MB

### Requirement: Průhlednost
Obrázky s průhledností (PNG, WebP) MUST zachovat alfa kanál.

#### Scenario: Logo s průhledným pozadím
- **WHEN** uživatel vloží PNG s průhledným pozadím
- **THEN** obrázek se na plátně zobrazí bez neprůhledného pozadí

### Requirement: Neblokující zpracování
Zpracování obrázků MUST NOT blokovat UI; během zpracování SHALL být na místě položky zobrazen zástupný stav.

#### Scenario: Import velkého souboru
- **WHEN** uživatel vloží 40MB obrázek
- **THEN** UI zůstává ovladatelné a na místě položky je indikátor zpracování až do jejího zobrazení

### Requirement: Úklid médií
Soubor obrázku SHALL být odstraněn z úložiště, jakmile na něj neodkazuje žádná položka ani historie zpět/znovu aktuální relace.

#### Scenario: Smazání obrázku a ukončení
- **WHEN** uživatel smaže obrázek a ukončí aplikaci
- **THEN** soubor obrázku už není v úložišti médií
