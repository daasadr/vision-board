# Spec Delta

## Purpose

Rozhoduje, kdy je vhodná chvíle zobrazit nástěnku, aby uživatele nevyrušila uprostřed činnosti, a to bez sledování obsahu jeho práce.

## ADDED Requirements

### Requirement: Soukromí detekce
Detekce aktivity MUST zjišťovat pouze dobu od posledního vstupu (klávesnice/myš) a systémový příznak „nerušit / fullscreen / prezentace“. MUST NOT číst stisknuté klávesy, obsah obrazovky, názvy oken ani seznam aplikací a MUST NOT tyto údaje ukládat ani odesílat.

#### Scenario: Audit oprávnění
- **WHEN** se prověří systémová oprávnění, která aplikace žádá
- **THEN** aplikace nevyžaduje oprávnění ke sledování vstupu (macOS Input Monitoring / Accessibility) ani k nahrávání obrazovky

### Requirement: Čekání na pauzu
V naplánovaný okamžik SHALL aplikace zobrazit nástěnku až po pauze ve vstupu alespoň N sekund (výchozí 5 s, nastavitelné 2–30 s).

#### Scenario: Uživatel píše
- **WHEN** nastane naplánovaný čas a uživatel právě souvisle píše
- **THEN** nástěnka se zobrazí až po 5 s bez stisku klávesy či pohybu myši

### Requirement: Respektování nerušení
Pokud OS hlásí režim nerušit, aplikaci na celé obrazovce, prezentaci nebo probíhající hovor (kde to OS poskytuje), SHALL aplikace zobrazení odložit, dokud stav netrvá.

#### Scenario: Prezentace
- **WHEN** nastane naplánovaný čas a uživatel prezentuje přes celou obrazovku
- **THEN** nástěnka se nezobrazí, dokud prezentace neskončí

### Requirement: Maximální odklad
Pokud podmínky nejsou splněny do nastavené maximální doby (výchozí 30 min), SHALL aplikace toto zobrazení vynechat (nikoli vnutit) a počkat na další naplánovaný okamžik.

#### Scenario: Celodenní hra
- **WHEN** je uživatel 45 minut ve fullscreen hře od naplánovaného času
- **THEN** zobrazení je po 30 minutách vynecháno

### Requirement: Nečinný uživatel
Pokud uživatel není u počítače (nečinnost delší než 10 min) nebo je obrazovka zamčená, SHALL aplikace zobrazení odložit do návratu uživatele (v rámci maximálního odkladu).

#### Scenario: Zamčená obrazovka
- **WHEN** nastane naplánovaný čas a obrazovka je zamčená
- **THEN** nástěnka se nezobrazí; po odemčení a pauze se zobrazí, pokud neuplynul maximální odklad
