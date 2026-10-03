# Spec Delta

## Purpose

Umožňuje, aby se Vision Board spouštěl sám po přihlášení uživatele, a to jen s jeho výslovným souhlasem.

## ADDED Requirements

### Requirement: Spuštění s přihlášením
Uživatel SHALL moci zapnout a vypnout automatické spuštění po přihlášení. Výchozí stav MUST být vypnuto. Při automatickém spuštění SHALL aplikace startovat bez otevřeného hlavního okna (jen tray a zapnuté režimy).

#### Scenario: Zapnutý autostart
- **WHEN** uživatel zapne autostart a restartuje počítač
- **THEN** po přihlášení běží Vision Board v tray bez otevřeného hlavního okna

### Requirement: Transparentní registrace
Autostart SHALL používat standardní mechanismus OS viditelný v systémových nástrojích (Správce úloh → Po spuštění, Login Items) a MUST být odstraněn při vypnutí i odinstalaci.

#### Scenario: Vypnutí autostartu
- **WHEN** uživatel autostart vypne
- **THEN** položka Vision Board zmizí ze seznamu spouštěných aplikací OS

### Requirement: Kombinace spouštěcích režimů
Nastavení SHALL umožnit nezávisle zapnout režimy „tapeta při startu“ a „naplánované zobrazení“ a oba současně.

#### Scenario: Oba režimy
- **WHEN** uživatel zapne tapetu i naplánované zobrazení
- **THEN** obě volby jsou uložené zapnuté a každý režim se řídí vlastním nastavením
