# Design

## Context

Aplikace běží v trayi celé dny, spouští se po přihlášení a nemá žádné pozadí, které by se neustále probouzelo. Instaluje se jen NSIS instalátorem do profilu uživatele (bez admin práv). Repo je veřejné na GitHubu.

## Goals / Non-Goals

**Goals:**
- Uživatel o nové verzi ví a nainstaluje ji jedním kliknutím; nic se neinstaluje bez jeho souhlasu.
- Vydání verze = jeden tag, žádné ruční nahrávání souborů.
- Žádné trvalé probouzení: jedna kontrola denně.

**Non-Goals:**
- Viz proposal (code signing, macOS, kanály).

## Decisions

### Zdroj aktualizací: GitHub Releases
Endpoint `https://github.com/daasadr/vision-board/releases/latest/download/latest.json` (statický soubor, který vytvoří `tauri-action`). Zdarma, spolehlivé CDN, nic se neprovozuje. Almost-there.eu z téhož souboru může brát odkaz ke stažení. Pro test lze endpoint přepsat proměnnou `VISION_BOARD_UPDATE_URL` (i v release buildu, protože podpis chrání instalaci tak jako tak).

### Podpis
Tauri updater (minisign). Pár klíčů vygenerovaný `tauri signer generate` s heslem. Veřejný klíč je v `tauri.conf.json` (`plugins.updater.pubkey`), soukromý klíč a heslo jsou ve správci hesel uživatelky a v GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). Ztráta klíče = nutnost ruční reinstalace u všech, proto záloha.

### Kontrola (`updates.rs`)
- Úloha na pozadí jen se zapnutou kontrolou (`Settings.updates.autoCheck`, výchozí zapnuto). První kontrola nejdřív 60 s po startu (start po přihlášení nemá zdržovat ani síť, ani disk), další 24 h po poslední. Čas poslední kontroly je v `app_state` (`AppValue::UpdateLastCheck`), takže restart nezpůsobí kontrolu navíc. Spí max. 1 h a čas přepočítává podle hodin (spánek počítače).
- Výpočet příští kontroly je čistá funkce v `domain::updates` (testy).
- Nalezená verze se drží v paměti (`Updates.available`), emituje `update://available` a přidá položku do tray menu.
- Chyby automatické kontroly se jen zalogují. Ruční „Zkontrolovat teď“ vrací chybu do UI.

### Instalace
`update_install`: stáhne a ověří balíček (plugin), před ukončením odstraní ikonu z trayi (Windows by jinak nechal „mrtvou“ ikonu do najetí myší) a spustí NSIS v režimu `passive` (jen ukazatel průběhu). Instalátor v režimu aktualizace nemaže autostart ani nevrací tapetu (`hooks.nsh`, `$UpdateMode`) a aplikaci po instalaci spustí znovu. Data jsou v `%APPDATA%`, instalace na ně nesahá.

### UI
- **Nastavení → Obecné → Aktualizace:** verze, přepínač automatické kontroly, „Zkontrolovat teď“, stav (aktuální / nová verze X s poznámkami / chyba) a „Nainstalovat a restartovat“.
- **Okno nástěnky:** jednou za verzi nenápadné upozornění (Notices) s tlačítkem „Nainstalovat“.
- **Tray:** položka „Nainstalovat aktualizaci X“, jen když je verze k dispozici.

### Vydání (`.github/workflows/release.yml`)
- Spouští se tagem `v*`. Krok 1 ověří, že tag = `version` v `tauri.conf.json` = `package.json` = `Cargo.toml`.
- `tauri-apps/tauri-action@v1` na `windows-latest`: `pnpm tauri build` (NSIS + `.sig`), vytvoří release s názvem a popisem z `CHANGELOG.md` (oddíl dané verze) a nahraje `latest.json`.
- `scripts/version.mjs X.Y.Z` přepíše verzi ve všech třech souborech a v `Cargo.lock`.
- `bundle.createUpdaterArtifacts: true`. Lokální `pnpm tauri build` pak potřebuje klíč v prostředí (postup v `docs/releasing.md`); CI build `--no-bundle` ho nepotřebuje.

## Risks / Trade-offs

- [Únik soukromého klíče] → útočník by mohl podepsat škodlivou aktualizaci, ale musel by ji i dostat na GitHub Releases repa (účet uživatelky). Klíč má heslo, GitHub Secrets jsou šifrované.
- [SmartScreen bez Authenticode] → týká se první instalace z prohlížeče. Aktualizace z aplikace SmartScreen nespouští (nejde o stažení prohlížečem).
- [GitHub nedostupný] → kontrola tiše selže, zkusí se zítra.

## Dopad závislostí

- `tauri-plugin-updater` =2.12.0 (poslední pro Tauri 2.11; novější chtějí 2.12, viz vb-a9v): přidá `reqwest` (rustls, ~1–1,5 MB v binárce), `minisign-verify`, `tar`/`flate2`/`zip` (rozbalení). Paměť v klidu beze změny (klient se vytvoří jen při kontrole). Změřit velikost exe před a po.

## Review (úkol 4.1, 2026-10-12)

- **Podpis:** `Update::download` ověří minisign podpis veřejným klíčem z `tauri.conf.json` dřív, než vrátí bajty. Neplatný podpis = chyba a nic se nespustí. Plugin nabízí jen vyšší verzi (semver), takže podvržený `latest.json` nemůže vnutit downgrade na starou verzi se známou chybou.
- **Endpoint:** jen HTTPS na github.com (přesměrování na `objects.githubusercontent.com`, také HTTPS). Přepsání `VISION_BOARD_UPDATE_URL` je přijaté riziko: kdo může nastavit proměnnou prostředí uživatele, už spouští kód jeho jménem, a nepodepsaný balíček se stejně nenainstaluje.
- **Tajemství v CI:** klíč a heslo jen v GitHub Secrets, předávané přes `env` jen kroku `tauri-action`. Kontrola existence klíče ho nevypisuje. Workflow běží jen na push tagu (jen správci repa), `contents: write` má jen tato úloha. Poznámky z `CHANGELOG.md` jdou do vstupu akce, ne do skriptu (žádná injekce do shellu).
- **UI:** poznámky k verzi se vykreslují jako text (React, `white-space: pre-line`), ne jako HTML.
- **Instalace:** před spuštěním instalátoru se uloží rozpracované úpravy nástěnky a doběhnou importy (`lifecycle::prepare_for_update`, max. 5 s). Při chybě instalace se stav „končím“ vrátí a ikona v trayi se obnoví.
- **Soukromí:** kontrola je anonymní GET bez parametrů. GitHub vidí IP adresu a User-Agent, jako u každého stažení. Uvedeno v nápovědě a `docs/user/settings.md`.

## Odchylky při implementaci (2026-10-12)

- Endpoint přepisovatelný i v release buildu (místo jen debug), aby šel celý tok otestovat na nainstalované aplikaci. Odůvodnění v Review.
- Upozornění na nástěnce si pamatuje zobrazenou verzi v `localStorage` okna (jen pohodlí, při ztrátě se ukáže znovu).
