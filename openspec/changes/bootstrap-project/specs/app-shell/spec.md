# Spec Delta

## Purpose

Definuje základní životní cyklus desktopové aplikace Vision Board: spuštění, jedinou běžící instanci a chování hlavního okna.

## ADDED Requirements

### Requirement: Spuštění aplikace
Aplikace SHALL po spuštění zobrazit hlavní okno nástěnky do 2 sekund na běžném hardwaru a MUST NOT spouštět žádné vlastní procesy na pozadí kromě procesů webview, které vyžaduje operační systém.

#### Scenario: Studený start
- **WHEN** uživatel spustí aplikaci z nabídky Start / Launchpadu
- **THEN** zobrazí se hlavní okno s názvem „Vision Board“ ve výchozím tématu a jazyce

### Requirement: Jediná instance
Aplikace SHALL běžet nejvýše v jedné instanci na uživatelský účet.

#### Scenario: Opakované spuštění
- **WHEN** aplikace už běží a uživatel ji spustí znovu
- **THEN** nová instance se ukončí a existující hlavní okno se zobrazí a získá fokus

### Requirement: Nízká klidová zátěž
Aplikace v klidu (hlavní okno otevřené, bez interakce) MUST NOT vytěžovat CPU nad 1 % a SHALL vystačit s pamětí do 150 MB včetně procesů webview (součet privátních pracovních sad, tj. sloupec „Paměť“ ve Správci úloh).

#### Scenario: Klidový stav
- **WHEN** hlavní okno je otevřené 60 sekund bez interakce
- **THEN** průměrné využití CPU aplikace je pod 1 % a paměť pod 150 MB

### Requirement: Obnova polohy okna
Aplikace SHALL při dalším spuštění obnovit velikost a polohu hlavního okna; pokud je uložená poloha mimo dostupné monitory, SHALL okno vycentrovat na primárním monitoru.

#### Scenario: Odpojený monitor
- **WHEN** okno bylo naposledy na sekundárním monitoru, který už není připojený
- **THEN** okno se otevře vycentrované na primárním monitoru
