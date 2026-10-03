# Spec Delta

## Purpose

Ověřuje uloženou licenci offline a podle ní určuje dostupnost prémiových funkcí, bez pravidelného dotazování serveru.

## ADDED Requirements

### Requirement: Offline ověření
Aplikace SHALL při startu ověřit licenci lokálně pomocí vestavěného veřejného klíče (podpis, vydavatel, identifikátor aplikace, platnost) a MUST k tomu nepotřebovat síť.

#### Scenario: Start bez internetu
- **WHEN** aktivovaná aplikace startuje bez připojení k síti
- **THEN** prémiové funkce jsou dostupné

### Requirement: Freemium dostupnost
Bez platné licence SHALL být dostupné všechny základní funkce nástěnky a MUST být zamčené funkce PremiumFrames, Wallpaper a ScheduledPopup. S platnou licencí SHALL být dostupné funkce uvedené v licenci.

#### Scenario: Bez licence
- **WHEN** uživatel nemá licenci
- **THEN** může přidávat a upravovat položky nástěnky, ale nemůže zapnout tapetu

#### Scenario: Zamčení po ztrátě licence
- **WHEN** měl uživatel zapnutou tapetu a licence přestane být platná
- **THEN** tapeta se vypne, původní tapeta se obnoví a uživatel je informován proč

### Requirement: Obnova licence
Pokud licence obsahuje datum expirace, SHALL se ji aplikace pokusit obnovit nejdříve 14 dní před expirací, nejvýše jednou denně a jen při startu nebo otevření nastavení. Neúspěšná obnova MUST NOT zamknout funkce před skutečnou expirací.

#### Scenario: Obnova offline
- **WHEN** do expirace zbývá 10 dní a zařízení je offline
- **THEN** funkce zůstávají dostupné a obnova se zkusí při dalším startu

### Requirement: Žádná jiná komunikace
Aplikace MUST komunikovat se serverem jen při aktivaci, deaktivaci a obnově licence a MUST NOT odesílat obsah nástěnky ani údaje o používání.

#### Scenario: Běžné používání
- **WHEN** uživatel s platnou licencí týden používá aplikaci a licence neblíží expiraci
- **THEN** aplikace neprovede žádný síťový požadavek
