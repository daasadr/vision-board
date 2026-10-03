# Spec Delta

## Purpose

Umožňuje uživateli naplánovat, kdy a jak často se mu nástěnka připomene zobrazením přes všechna okna.

## ADDED Requirements

### Requirement: Nastavení plánu
Uživatel SHALL moci zapnout naplánované zobrazení a nastavit: pevné časy během dne (0–12 časů) a/nebo opakování v intervalu (15 min – 8 h) v časovém okně (např. 9:00–18:00), dny v týdnu a délku zobrazení (10 s – 10 min). Výchozí stav MUST být vypnuto.

#### Scenario: Denní připomenutí
- **WHEN** uživatel nastaví čas 8:30 v pracovní dny s délkou 30 s
- **THEN** v pracovní dny se od 8:30 (po splnění podmínek aktivity) zobrazí nástěnka na 30 s

### Requirement: Úspornost plánovače
Pokud je naplánované zobrazení vypnuté, aplikace MUST NOT spouštět žádné časovače ani dotazy na aktivitu. Pokud je zapnuté, SHALL se aplikace probouzet jen k nejbližšímu naplánovanému okamžiku a během čekání na pauzu nejvýše jednou za 5 s.

#### Scenario: Vypnutý plán
- **WHEN** naplánované zobrazení je vypnuté
- **THEN** aplikace neprovádí žádné periodické probouzení

### Requirement: Uspání a změna času
Plánovač SHALL správně navázat po probuzení počítače ze spánku a po změně systémového času či časového pásma; zmeškané zobrazení během spánku SHALL proběhnout nejvýše jednou po probuzení, pokud je stále v časovém okně.

#### Scenario: Zmeškaná připomínka
- **WHEN** počítač spal v 8:30 a probudí se v 9:15 (časové okno do 18:00)
- **THEN** nástěnka se zobrazí jednou po probuzení při splnění podmínek aktivity

### Requirement: Prémiová funkce
Naplánované zobrazení SHALL být dostupné jen při oprávnění ScheduledPopup; bez něj SHALL být sekce viditelná se zámkem a vysvětlením.

#### Scenario: Bez oprávnění
- **WHEN** oprávnění ScheduledPopup není dostupné
- **THEN** přepínač naplánovaného zobrazení nejde zapnout a zobrazí se informace o odemčení
