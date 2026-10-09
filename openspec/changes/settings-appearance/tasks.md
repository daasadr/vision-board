# Tasks

## 1. Nastavení – základ

- [x] 1.1 Migrace v2 (tabulka `settings`), `domain::settings` (model s výchozími hodnotami, tolerantní načtení, validace) a ověřit `cargo test` (staré/poškozené JSON, ořez velikosti, reset)
- [x] 1.2 Commands `settings_get` / `settings_set` / `settings_reset`, událost `settings://changed`, `initialization_script` s nastavením pro nová okna a ověřit typovou kontrolou a mockem v `e2e/support/ipc.ts`
- [x] 1.3 Frontend store nastavení, aplikace tématu a jazyka při startu i za běhu, směrování kořenů podle štítku okna (lazy) a ověřit Vitest + E2E změnou tématu přes událost

## 2. Okno nastavení

- [x] 2.1 Okno `settings` ve `window_manager` (vytvoření/zaměření, destroy při zavření), command `window_open_settings`, tlačítko v liště nástěnky a položka v tray a ověřit ručně + E2E kliknutím
- [x] 2.2 UI nastavení se sekcemi Obecné / Vzhled / Zobrazení, téma a jazyk, obnovení výchozích s potvrzením (cs/en/de) a ověřit E2E scénáři „Změna tématu“, „Ruční volba jazyka“, „Reset nastavení“ + axe
- [x] 2.3 Jazyk tray nabídky podle nastavení (přestavění nabídky) a ověřit `cargo test` textů + ručně

## 3. Rámování a jen obrázky

- [x] 3.1 `ItemStyle.frame`, styly rámů v obou tématech (tokeny), vykreslení u obrázků a stránka `/design` a ověřit vizuálně v Galerii i Noci + Vitest rozlišení rámu (položka > nástěnka, prémiový bez oprávnění → bez rámu)
- [x] 3.2 Výchozí rám v nastavení s náhledy, přepis u položky v toolbaru (zpět/znovu), zámek prémiových rámů a ověřit E2E scénáři „Polaroid pro celou nástěnku“, „Výjimka pro jednu položku“, „Zamčený styl“
- [x] 3.3 Režim „jen obrázky“ (nastavení + lišta nástěnky) a ověřit E2E scénářem „Skrytí textů“

## 4. Umístění zobrazení

- [x] 4.1 `domain::placement::rect_in` a TS náhled se shodnými testovacími případy a ověřit `cargo test` + Vitest
- [x] 4.2 Sekce Zobrazení s režimem, posuvníkem velikosti, ukotvením a živým náhledem a ověřit E2E scénáři „Částečné umístění vpravo dole“ a „Změna velikosti v náhledu“

## 5. Autostart

- [x] 5.1 `tauri-plugin-autostart` přes commands `autostart_get/set`, start s `--autostart` bez hlavního okna, přepínač v nastavení, reset vypne autostart a ověřit ručně na Windows (Správce úloh → Po spuštění, restart)
- [ ] 5.2 NSIS hook odstraňující registraci při odinstalaci, `bundle.targets` bez MSI a ověřit ručně instalací a odinstalací

## 6. Ovládací prvek

- [x] 6.1 Okno ovládacího prvku (bez rámečku, průhledné, vždy navrch, bez taskbaru a Alt+Tab, bez fokusu; na Windows nativní vrstvené okno, jinde webview), pozice `control_position` + `cargo test` a ověřit ručně (Alt+Tab, maximalizované okno)
- [x] 6.2 3D obdélník v CSS s hover náklonem (reduced motion), klik otevře nastavení, nativní kontextová nabídka se Skrýt a ověřit E2E (mock) + ručně
- [x] 6.3 Skrytí/obnovení (nastavení, tray zaškrtávací položka), přetrvání po restartu a ověřit E2E + ručně
- [x] 6.4 Měření: klidový CPU prvku 60 s a paměť navíc (< 30 MB) v release buildu, zapsat do `docs/performance.md`

## 7. Dokončení

- [x] 7.1 Review bezpečnosti a kvality nových částí (FFI, autostart, IPC vstupy) a zapracovat nálezy
- [x] 7.2 Aktualizovat `docs/architecture.md` (nastavení, okna, ovládací prvek) a `docs/user/settings.md` (cs), ruční checklist v `docs/testing.md`
