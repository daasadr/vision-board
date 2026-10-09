# Architektura

Stav po fázi 2 (settings-appearance). Každá další fáze sem doplní svou část.

## Přehled

```
┌─────────────────────────── proces vision-board (Rust, Tauri 2) ───────────────────────────┐
│  lib.rs            pluginy, setup (DB, úklid médií, tray, okna), běh v tray (ExitRequested) │
│  window_manager    okna board / settings / control: vytvoření, obnova, zaostření, zrušení   │
│  tray              ikona a nabídka (nástěnka, nastavení, ovládací prvek, ukončit)           │
│  preferences       uložení nastavení → tray, ovládací prvek, událost settings://changed     │
│  lifecycle         Ukončit: uložení z frontendu → dokončení importů (max 5 s) → úklid → exit │
│  state             sdílený stav: Db (SQLite), MediaDir                                     │
│  commands/         tenká IPC vrstva, tauri-specta → src/lib/bindings.ts                    │
│  domain/           doménová logika bez závislosti na Tauri (cargo test):                   │
│                    db, board, media, entitlements, app_state, locale, settings, placement, │
│                    window_placement, control_look                                          │
│  platform/         jediné místo pro FFI a unsafe (Win32: nativní ovládací prvek, téma OS)   │
└──────────────┬─────────────────────────────────────────────────────────────────────────────┘
               │ IPC (invoke, události) · asset protokol pro obrázky z media/
┌──────────────┴────────── WebView2 / WKWebView (msedgewebview2 procesy) ────────────────────┐
│  src/main.tsx      nastavení → téma + jazyk před prvním vykreslením → <Root> (podle okna)   │
│  src/app/board/    nástěnka: store, ukládání, plátno, položky, import, životní cyklus okna  │
│  src/app/settings/ okno nastavení (Obecné, Vzhled, Zobrazení)                               │
│  src/app/control/  ovládací prvek (3D obdélník v rohu obrazovky)                            │
│  src/lib/settings.ts  store nastavení, aplikace tématu a jazyka, poslech změn               │
│  src/lib/ipc.ts    jediný přístup k Rustu (typovaný, v E2E mockovaný)                       │
│  src/lib/entitlements.ts  dostupnost prémiových funkcí (useEntitlement)                     │
│  src/design/       tokeny, témata Galerie/Noc, fonty, komponenty                            │
│  src/i18n/         cs/en/de, detekce jazyka, formáty data a času                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Klíčová rozhodnutí

Podrobné zdůvodnění je v `design.md` jednotlivých změn v `openspec/changes/archive/` a `openspec/changes/settings-appearance/design.md`. Tady je jen shrnutí.

- **Jeden proces a okna na vyžádání.** Okno `board` je v `tauri.conf.json` deklarované s `create: false` a vytváří ho `window_manager::open_board`: při startu, z tray a při druhém spuštění aplikace (single-instance).
- **Běh v tray.** Zavření okna okno zruší včetně webview. `RunEvent::ExitRequested` bez kódu se zablokuje, takže aplikace běží dál jen s tray ikonou (~5 MB). Ukončit může jen `lifecycle::request_quit` (tray „Ukončit“ nebo command `app_quit`).
- **Obnova polohy okna.** Plugin window-state ukládá polohu a velikost (bez viditelnosti). `domain::window_placement` zkontroluje, že se titulek okna dá chytit na některém monitoru, jinak okno vycentruje.
- **Typované IPC.** Rust commandy mají `#[specta::specta]` a jsou registrované v `commands::builder()`. Test `export_bindings` generuje `src/lib/bindings.ts` a CI hlídá jeho aktuálnost. Specta typuje `f64` jako `number | null`, proto `ipc.ts` geometrii položek zužuje na `number` a kontroluje ji.
- **`domain` místo `core`.** Modul `core` by zastínil standardní crate `core` a rozbíjel makra.
- **Windows manifest.** `build.rs` vkládá `windows-app-manifest.xml` do všech binárek, jinak `cargo test` na Windows padá se `STATUS_ENTRYPOINT_NOT_FOUND`.
- **Rychlé vývojové buildy.** Závislosti se i ve vývojovém profilu kompilují s `opt-level = 2`, jinak dekódování fotky trvá přes minutu. Náš crate zůstává na 0.
- **Bezpečnost.** Přísná CSP. Capability `default` (okna `board`, `settings`, `control`) obsahuje jen `core:default` a `core:window:allow-destroy`. Pluginy (autostart) se volají jen z Rustu, jejich JS oprávnění nejsou povolená. Asset protokol obsluhuje jen `$APPDATA/media/*`. `unsafe_code = "deny"` mimo `platform`. Typ souboru se pozná podle obsahu a dekodér má limity rozměrů a paměti.

## Nástěnka

### Souřadnice

Položky leží na logickém plátně **1920×1080** (`x`, `y`, `w`, `h` v jeho jednotkách, `rotation` ve stupních ±15°, `z` pořadí vrstev). Plátno se škáluje do okna přes `transform: scale()` a mezery doplní letterbox (`geometry.fitCanvas`). Stejné rozložení tak půjde použít v pop-upu i na tapetě na libovolném monitoru.

Změna velikosti vždy zachová poměr stran. Text se škáluje s šířkou položky: velikost písma v CSS je `var(--item-w) * k`, takže se nepřeskládává a výška textové položky je určená obsahem. Změřenou výšku ukládá `store.amend` bez kroku zpět. Položka musí z 10 % plochy zůstat na plátně (`keepOnCanvas`).

### Datový model (SQLite, `board.db` v app data, WAL)

| Tabulka     | Obsah                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `boards`    | nástěnky; migrace vytvoří `default` (UI zatím ukazuje jednu)                                          |
| `items`     | položky: geometrie, `kind` (`image` / `quote` / `text`), `payload` (JSON obsahu), `style` (JSON: rám) |
| `media`     | uložené obrázky: `file_name`, `thumb_name`, rozměry, velikost                                         |
| `app_state` | příznaky aplikace (např. zda už bylo zobrazeno upozornění o tray)                                     |
| `settings`  | jeden řádek s nastavením jako JSON (migrace v2)                                                       |

Migrace: `rusqlite_migration` (verze ve `user_version`). Obsah položky je v Rustu tagovaný enum `ItemContent` a frontend dostává stejný tvar.

### Tok úprav

```
uživatel → BoardItemView (pointer, klávesnice) → store (zustand, příkazy before/after)
         → saver (300 ms nečinnosti, max 1 s, slučuje podle položky) → board_apply_ops (transakce)
```

- **Store** (`store.ts`) je synchronní a o backendu neví. Každá úprava je příkaz se stavem `before` a `after` každé dotčené položky. Zpět aplikuje stavy `before` a znovu stavy `after`, historie má 50 kroků.
- **Tažení** zapisuje přímo do stylu elementu (`transform` na vlastní vrstvě), bez renderu Reactu. Do storu jde jen výsledek po puštění.
- **Ukládání** (`saver.ts`) poskytuje `flush()` pro zavření okna a pro Ukončit. Nezdařená dávka se zopakuje a novější úprava stejné položky má přednost.
- **Backend** dávku validuje (rozměry, rotace, délka textu, existence média) a zapíše ji celou, nebo vůbec.

### Média

```
zdroj (přetažení z OS / schránka / dialog) → media_import_paths | media_import_bytes (base64)
  → spawn_blocking: limit 50 MB → typ podle magických bajtů → dekódování s limity → EXIF orientace
  → zmenšení na 2560 px (Lanczos3) → WebP q80 + náhled 480 px q75 → atomický zápis (tmp + rename)
  → řádek v media → frontend přidá položky obrázků (jeden krok zpět na dávku)
```

- Originály se neukládají a překódování odstraní všechna metadata (EXIF, GPS). Alfa kanál zůstane.
- Frontend sestaví URL přes `convertFileSrc(dir + fileName)`. Pokud je obrázek na obrazovce menší než 480 px, použije náhled.
- **Úklid** (`media::remove_unreferenced`) maže média bez položky a soubory bez záznamu. Běží jen při startu a po uložení při ukončení, protože jindy může historie zpět ještě odkazovat na smazaný obrázek.

### Životní cyklus okna

- **Zavření okna:** frontend uloží rozpracované změny. Při prvním zavření zobrazí dialog „Vision Board poběží dál“ (příznak `trayNoticeShown`) a potom okno zruší.
- **Ukončit:** Rust pošle oknu událost `app://quit-requested`, frontend uloží změny a zavolá `app_ready_to_quit`. Rust počká na doběhnutí importů (celkem max 5 s), uklidí média a ukončí aplikaci.

### Oprávnění (Entitlements)

Prémiové funkce (`premiumFrames`, `wallpaper`, `scheduledPopup`) se ověřují výhradně přes `useEntitlement(feature)` a `domain::entitlements`. Do fáze 6 je všechno odemčené. Funkce mimo seznam jsou vždy zdarma.

## Nastavení a vzhled

### Nastavení

```
okno nastavení → settingsStore.update (hned se projeví v okně) → settings_set
  → domain::settings::save (normalizace, např. šířka 30–90 %) → preferences::apply:
      tray (jazyk, zaškrtnutí ovládacího prvku) · ovládací prvek (vytvořit / zrušit)
      · událost settings://changed → každé okno přepne téma a jazyk
```

- **Jeden zdroj pravdy v Rustu.** Tabulka `settings` drží jeden JSON. Načítání je tolerantní: chybějící pole (starší verze) dostanou výchozí hodnotu, neznámá hodnota jednoho pole se nahradí výchozí a ostatní zůstanou.
- **Bez probliknutí.** `window_manager` vkládá do každého nového okna `initialization_script` s `window.__VB_SETTINGS__`, takže `main.tsx` zná téma a jazyk ještě před prvním vykreslením. Bez něj (prohlížeč, E2E) počká na `settings_get`.
- **Autostart** není v `Settings`. Zdrojem pravdy je registrace v OS (`tauri-plugin-autostart`, na Windows `HKCU\…\Run`), commands `autostart_get/set`. Při spuštění s `--autostart` se neotevře nástěnka. NSIS hook (`src-tauri/windows/hooks.nsh`) registraci při odinstalaci smaže, při aktualizaci ne. Windows se balí jen jako NSIS, MSI by hook neumělo.

### Okna

- Každé okno načte stejný `index.html`. `Root` vybere kořen podle štítku okna (v prohlížeči podle cesty `/settings`, `/control`, `/design`) a kořeny se načítají líně, takže ovládací prvek nestahuje kód nástěnky.
- **`settings`** se vytváří na vyžádání (tray, ovládací prvek, lišta nástěnky) a při zavření se zruší.
- **Ovládací prvek** (120×40 logických px) sedí v pravém horním rohu pracovní plochy primárního monitoru, vlevo od systémových tlačítek maximalizovaných oken (`window_placement::control_position`). Skrytí okno zruší a uloží `controlWidget = false`.
  - **Windows:** nativní vrstvené okno bez webview (`platform::windows::control`). Je vždy navrch, chybí v Alt+Tab i na hlavním panelu a nebere fokus. Ukazuje bitmapy z `src-tauri/assets/control/*.png`, které `pnpm control:render` vyrenderuje z CSS návrhu v `src/app/control`. `domain::control_look` je zmenší na měřítko monitoru. Kontextová nabídka je Win32 `TrackPopupMenu` a klik i volby jdou přes `window_manager::native_control`. Změna tématu, měřítka nebo monitorů (`WM_SETTINGCHANGE`, `WM_DPICHANGED`, `WM_DISPLAYCHANGE`) prvek překreslí. Důvod: webview prvek přidával ~80 MB.
  - **macOS, Linux:** webview okno `control` (`ControlApp`) s nativní kontextovou nabídkou (`control_context_menu`), jejíž události obsluhuje `window_manager::on_menu_event`.

### Rámy a režim jen obrázky

- `ItemStyle.frame` (`null` = podle nástěnky) a `Settings.frame` (výchozí rám nástěnky). Rámy platí jen pro obrázky. Komponenta `Frame` (`src/design/components`) je kreslí uvnitř rozměru položky, takže přepnutí rámu nemění geometrii. Obrázek se ořízne (`object-fit: cover`).
- Prémiové rámy (polaroid, sklo) bez oprávnění `premiumFrames` se vykreslí bez rámu, ale v datech zůstanou (`lib/frames.ts::effectiveFrame`). V nastavení jsou vidět se zámkem a jejich volba jen vysvětlí, jak je odemknout.
- `imagesOnly` filtruje citáty a texty v `Canvas` jen při vykreslení. Přidání citátu nebo textu režim vypne, jinak by nová položka hned zmizela.

### Umístění zobrazení

`domain::placement::rect_in` spočítá obdélník nástěnky na monitoru (celá pracovní plocha, nebo 30–90 % šířky v poměru 16:9 u jednoho z pěti ukotvení, 2 % od okraje). Použije ho pop-up (fáze 3) a tapeta (fáze 4). Náhled v nastavení počítá totéž v `src/app/settings/placement.ts`. Shodu hlídají stejné testovací případy v Rustu i ve Vitestu.

## Kde co najít

| Chci změnit…                   | Soubor                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| barvy, stíny, typografii       | `src/design/tokens.css`                                      |
| texty UI                       | `src/i18n/locales/{cs,en,de}.json`                           |
| texty tray a nativních nabídek | `src-tauri/src/domain/locale.rs`                             |
| vzhled položek nástěnky        | `src/app/board/ItemContentView.*`, `BoardItemView.*`         |
| geometrii (plátno, přichycení) | `src/app/board/geometry.ts`                                  |
| validaci a ukládání položek    | `src-tauri/src/domain/board.rs`                              |
| zpracování obrázků             | `src-tauri/src/domain/media.rs`                              |
| přidat Rust command            | `src-tauri/src/commands/`, pak `pnpm bindings`               |
| chování oken a tray            | `src-tauri/src/window_manager.rs`, `tray.rs`, `lifecycle.rs` |
| oprávnění webview, CSP, assety | `src-tauri/capabilities/default.json`, `tauri.conf.json`     |
| nastavení (model, výchozí)     | `src-tauri/src/domain/settings.rs`, `src/lib/settings.ts`    |
| okno nastavení                 | `src/app/settings/`                                          |
| ovládací prvek                 | `src/app/control/` + `pnpm control:render`, `platform/`      |
| styly rámů                     | `src/design/components/Frame.*`, tokeny `--frame-*`          |
