# Spec Delta

## Purpose

Dostane nové verze Vision Boardu k uživatelům bez ručního stahování a jen v podobě podepsané vydavatelem.

## ADDED Requirements

### Requirement: Kontrola aktualizací
Se zapnutou automatickou kontrolou (výchozí) SHALL aplikace zkontrolovat dostupnost nové verze krátce po startu a dál nejvýše jednou za 24 hodin. Kontrolu SHALL jít v nastavení vypnout a kdykoli spustit ručně. Kontrola MUST NOT odesílat nic jiného než běžný HTTP požadavek na popis nejnovější verze.

#### Scenario: Nová verze je k dispozici
- **WHEN** na GitHub Releases je verze vyšší než nainstalovaná
- **THEN** nastavení, tray menu a okno nástěnky nabídnou „Nainstalovat aktualizaci“ s číslem verze

#### Scenario: Offline
- **WHEN** kontrola selže kvůli síti
- **THEN** aplikace nic nehlásí (kromě ruční kontroly, kde ukáže chybu) a zkusí to při další kontrole

#### Scenario: Vypnutá kontrola
- **WHEN** uživatel automatickou kontrolu vypne
- **THEN** aplikace neprovede žádný požadavek, dokud nezvolí „Zkontrolovat teď“

### Requirement: Instalace jen podepsané aktualizace
Aplikace SHALL nainstalovat aktualizaci až po potvrzení uživatelem a jen tehdy, když podpis balíčku odpovídá veřejnému klíči zabudovanému v aplikaci. Data nástěnky, úkoly a nastavení MUST aktualizaci přežít.

#### Scenario: Instalace
- **WHEN** uživatel zvolí „Nainstalovat aktualizaci“
- **THEN** aplikace stáhne balíček, ověří podpis, nainstaluje ho a znovu se spustí s nezměněnou nástěnkou

#### Scenario: Neplatný podpis
- **WHEN** stažený balíček nemá platný podpis
- **THEN** aplikace ho nenainstaluje a zobrazí chybu

### Requirement: Vydání verze
Vydání SHALL proběhnout jedním tagem `vX.Y.Z` v repozitáři. CI MUST ověřit, že tag odpovídá verzi aplikace, sestavit a podepsat instalátor a zveřejnit release s popisem změn a souborem `latest.json`. Soukromý podpisový klíč MUST NOT být v repozitáři.

#### Scenario: Nový tag
- **WHEN** správce pushne tag `v0.2.0` a verze aplikace je 0.2.0
- **THEN** na GitHub Releases vznikne release 0.2.0 s instalátorem, podpisem a `latest.json` a nainstalované aplikace ho nabídnou

#### Scenario: Nesouhlasná verze
- **WHEN** tag neodpovídá verzi v `tauri.conf.json`
- **THEN** CI vydání zastaví a nic nezveřejní
