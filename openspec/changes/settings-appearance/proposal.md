# Proposal

## Why

Fáze 2 „Nastavení“ ze zadani.txt bod 5 a body 2.2–2.3: uživatel si potřebuje appku přizpůsobit (téma, jazyk, rámování, umístění) a nechat ji spouštět se systémem. Zároveň vzniká persistentní ovládací prvek – 3D obdélník v pravém horním rohu obrazovky, přes který se nastavení otevírá.

## What Changes

- Okno nastavení se sekcemi Obecné, Vzhled, Zobrazení (časování doplní fáze 3, tapetu fáze 4, licenci fáze 6).
- Volba tématu (Galerie / Noc / podle systému) a jazyka (cs / en / de / podle systému).
- Rámování položek: několik stylů rámu (část prémiových), bez rámu; režim „jen obrázky“ vs. „s texty“.
- Umístění zobrazení nástěnky (pro pop-up a tapetu): celá obrazovka / částečné (velikost a poloha).
- Automatický start se systémem (do tray), zapínání/vypínání a kombinace spouštěcích režimů.
- Ovládací prvek: malé frameless okno vždy navrch v pravém horním rohu, 3D obdélník; klik otevře nastavení; lze skrýt.

## Non-goals

- Samotné časování a pop-up (fáze 3), režim tapety (fáze 4).
- Vlastní uživatelské styly rámů / editor stylů.

## Capabilities

### New Capabilities
- `settings`: okno nastavení, ukládání preferencí, téma a jazyk.
- `item-framing`: styly rámování položek a režim jen obrázky / s texty.
- `display-placement`: kde a jak velká se nástěnka zobrazuje mimo hlavní okno.
- `autostart`: spuštění aplikace s přihlášením uživatele.
- `control-widget`: persistentní 3D ovládací prvek na ploše.

### Modified Capabilities
- `tray`: klidová zátěž bez okna počítá se zobrazeným ovládacím prvkem (webview prvku je povolené, s vlastním limitem).

## Impact

- `tauri-plugin-autostart`, nové okno `control` a `settings`, tabulka `settings` v DB.
- Závisí na board-core (položky, entitlements pro prémiové rámy).
