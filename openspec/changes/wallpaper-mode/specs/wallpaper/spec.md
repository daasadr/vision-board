# Spec Delta

## Purpose

Zobrazuje nástěnku jako tapetu plochy za ikonami, aby ji uživatel pasivně viděl, kdykoli se podívá na plochu.

## ADDED Requirements

### Requirement: Tapeta za ikonami
Na Windows a macOS SHALL zapnutý režim tapety zobrazit nástěnku za ikonami plochy a pod všemi okny na všech monitorech, v nastaveném umístění a tématu. Ikony plochy MUST zůstat viditelné a ovladatelné.

#### Scenario: Zapnutí tapety na Windows
- **WHEN** uživatel zapne režim tapety
- **THEN** do 3 s je nástěnka vidět jako pozadí plochy, ikony plochy jsou nad ní a lze na ně klikat

### Requirement: Aktualizace po změně nástěnky
Změna nástěnky SHALL být na tapetě vidět nejpozději 5 s po uložení.

#### Scenario: Přidání obrázku
- **WHEN** uživatel přidá na nástěnku obrázek a zavře hlavní okno
- **THEN** obrázek je vidět na tapetě

### Requirement: Odolnost vůči změnám systému
Tapeta SHALL se sama obnovit po restartu shellu (Průzkumník / Finder), po připojení či odpojení monitoru, změně rozlišení a probuzení ze spánku.

#### Scenario: Restart Průzkumníka
- **WHEN** se proces explorer.exe restartuje
- **THEN** tapeta s nástěnkou se do 10 s znovu zobrazí

### Requirement: Obnovení původní tapety
Při vypnutí režimu, ukončení aplikace nebo odinstalaci MUST být plocha ve stavu jako před zapnutím (původní systémová tapeta viditelná, žádná zbytková okna).

#### Scenario: Vypnutí režimu
- **WHEN** uživatel vypne režim tapety
- **THEN** zobrazí se původní systémová tapeta

### Requirement: Spuštění jako tapeta při startu
Pokud je zapnuto „spustit jako tapetu“ a autostart, SHALL se po přihlášení zobrazit tapeta bez otevření hlavního okna.

#### Scenario: Po přihlášení
- **WHEN** uživatel se přihlásí a oba přepínače jsou zapnuté
- **THEN** nástěnka je vidět jako tapeta a hlavní okno není otevřené

### Requirement: Úspornost tapety
Tapeta MUST NOT spotřebovávat CPU, pokud se nástěnka nemění, a SHALL přidat nejvýše 60 MB paměti. Když je plocha zcela zakrytá okny nebo běží aplikace na celou obrazovku, SHALL vykreslování tapety neprobíhat.

#### Scenario: Klid s tapetou
- **WHEN** tapeta je zobrazená 60 s bez změn nástěnky
- **THEN** aplikace nespotřebovává CPU nad 0,5 %

### Requirement: Linux fallback
Na Linuxu SHALL aplikace nabídnout export nástěnky jako obrázku v rozlišení monitoru a, kde to prostředí podporuje (GNOME, KDE), jeho nastavení jako systémové tapety.

#### Scenario: Export na Linuxu
- **WHEN** uživatel na Linuxu zvolí „Nastavit jako tapetu“ v GNOME
- **THEN** systémová tapeta je nahrazena obrázkem aktuální nástěnky

### Requirement: Prémiová funkce
Režim tapety SHALL být dostupný jen při oprávnění Wallpaper.

#### Scenario: Bez oprávnění
- **WHEN** oprávnění Wallpaper není dostupné
- **THEN** přepínač tapety nejde zapnout a zobrazí se informace o odemčení
