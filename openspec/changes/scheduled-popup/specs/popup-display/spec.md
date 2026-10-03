# Spec Delta

## Purpose

Samotné zobrazení nástěnky přes všechna okna – elegantní, snadno zavíratelné a bez krádeže vstupu uživatele.

## ADDED Requirements

### Requirement: Zobrazení přes okna na všech monitorech
Pop-up SHALL zobrazit nástěnku nad všemi okny na všech připojených monitorech v nastaveném umístění (display-placement) s jemným prolnutím dovnitř i ven.

#### Scenario: Dva monitory
- **WHEN** se spustí zobrazení a jsou připojeny dva monitory
- **THEN** nástěnka je vidět na obou monitorech ve stejném umístění

### Requirement: Ovládání a ukončení
Pop-up SHALL nabídnout „Zavřít“ a „Odložit“ (5 / 15 / 60 min), zavřít se klávesou Esc a automaticky po uplynutí délky zobrazení. Najetí myší SHALL odpočet pozastavit.

#### Scenario: Odložení
- **WHEN** uživatel zvolí „Odložit 15 min“
- **THEN** pop-up zmizí a znovu se zobrazí za 15 min (při splnění podmínek aktivity)

#### Scenario: Automatické zavření
- **WHEN** délka zobrazení je 30 s a uživatel nereaguje
- **THEN** po 30 s pop-up zmizí

### Requirement: Nerušení rozdělané práce
Pop-up MUST NOT převzít vstup z klávesnice, dokud s ním uživatel neinteraguje (klik nebo Esc), aby omylem napsaný text nešel do pop-upu ani neztratil fokus v původní aplikaci po zavření.

#### Scenario: Zavření vrací fokus
- **WHEN** pop-up se zavře
- **THEN** fokus je v aplikaci, která ho měla před zobrazením

### Requirement: Ruční spuštění
Uživatel SHALL moci zobrazení spustit ručně z tray nabídky („Zobrazit nástěnku teď“) bez ohledu na plán.

#### Scenario: Ukázka z tray
- **WHEN** uživatel zvolí „Zobrazit nástěnku teď“
- **THEN** pop-up se okamžitě zobrazí s nastavenou délkou

### Requirement: Úklid okna
Po zavření SHALL být okno pop-upu zrušeno a jeho webview uvolněno.

#### Scenario: Paměť po zavření
- **WHEN** pop-up se zavře
- **THEN** do 5 s nejsou spuštěné procesy webview pop-upu
