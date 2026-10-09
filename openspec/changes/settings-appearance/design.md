# Design

## Context

Staví na fázi 1 (`board-core`): SQLite s migracemi, typované IPC (tauri-specta), okna vytvářená na vyžádání a ničená při zavření (`window_manager`), tray, `Entitlements`, design tokeny a i18n. Požadavky viz specs/settings, item-framing, display-placement, autostart, control-widget.

Poznatky z fáze 1, které design ovlivňují:
- Každé další okno je další webview. Okna se proto dál vytvářejí na vyžádání a ničí, ovládací prvek je jediné okno, které běží trvale, a musí být co nejlehčí.
- Na vývojovém PC WebView2 vynechává snímky při jakékoli animaci (vb-de7). Ovládací prvek proto nemá žádnou nekonečnou animaci a hover reakce je jen CSS transform.
- Ukládání a doménová logika patří do Rustu (`cargo test`), frontend je tenký.

## Goals / Non-Goals

**Goals:**
- Jeden zdroj pravdy pro nastavení v Rustu. Změna se projeví ve všech oknech i v tray do 1 s.
- Téma a jazyk platí od prvního vykreslení okna, bez probliknutí.
- Ovládací prvek: v klidu 0 % CPU, nejvýše +30 MB paměti.

**Non-Goals:**
- Pop-up a tapeta samotné (fáze 3, 4). Model umístění a přepínače „při spuštění“ se ale ukládají už teď.
- Vlastní styly rámů.

## Decisions

### Úložiště nastavení
Migrace v2 přidá tabulku `settings(id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)` s jedním řádkem JSON. Rust struktura `domain::settings::Settings` má u všech polí `#[serde(default)]`: starší uložený JSON bez nových polí (fáze 3–6 je přidají) se načte s výchozími hodnotami a neznámé hodnoty výčtů se nahradí výchozími místo chyby. Proč jeden JSON a ne klíč/hodnota: nastavení se vždy čte celé a validuje jako celek. `app_state` zůstává pro interní příznaky.

```
Settings {
  theme: system | galerie | noc                      (system)
  language: system | cs | en | de                    (system)
  frame: none | passepartout | polaroid | line | glass   (none)
  imagesOnly: bool                                   (false)
  placement: { mode: full | partial, size: 30–90, anchor: center | topLeft | topRight | bottomLeft | bottomRight }
                                                     (full, 60, center)
  controlWidget: bool                                (true)
  startup: { wallpaper: bool, scheduledPopup: bool } (false, false)
}
```

Autostart **není** v `Settings`: zdrojem pravdy je OS (registrace přes plugin), jinak by se mohl rozejít s tím, co uživatel změní ve Správci úloh.

### Commands a šíření změn
- `settings_get`, `settings_set(settings)` (celé nastavení; Rust ho validuje, např. ořízne `size` do 30–90), `settings_reset`.
- Po uložení Rust provede vedlejší efekty (jazyk tray nabídky, zobrazení/zničení ovládacího prvku) a pošle událost `settings://changed` s novým nastavením všem oknům. Každé okno přepne téma (`data-theme`) a jazyk (`i18next.changeLanguage`).
- Frontend drží nastavení v malém Zustand storu `src/lib/settings.ts`. Změna z UI se aplikuje optimisticky a po odpovědi Rustu se nahradí uloženou (validovanou) hodnotou.

### Téma a jazyk bez probliknutí
`window_manager` při vytváření okna vloží `initialization_script` s `window.__VB_SETTINGS__ = {…}`. `main.tsx` je přečte synchronně před prvním vykreslením. Když chybí (prohlížeč při `pnpm dev`, E2E bez nich), počká se na `settings_get` a renderuje se až pak. Alternativa „vykreslit s výchozím a pak přepnout“ zamítnuta kvůli probliknutí u uživatelů s tématem proti systému.

Systémový jazyk: frontend dál `navigator.languages`, tray `sys_locale`. Obojí čte jazyk OS, takže se shodují.

### Okna a směrování
- Nová okna `settings` (běžné okno 760×560, min. 640×480, uprostřed) a `control`. Obě tvoří `window_manager` přes `WebviewWindowBuilder`, `settings` se při zavření ničí jako nástěnka.
- Frontend vybírá kořen podle štítku okna (`getCurrentWindow().label`), v prohlížeči podle cesty (`/settings`, `/control`, `/design`). Kořeny se načítají přes `React.lazy`, takže okno ovládacího prvku nenačte kód nástěnky ani nastavení.
- `capabilities/default.json` platí i pro `settings` a `control` (`core:default` kvůli událostem). Vlastní commands jsou dostupné všem oknům aplikace.
- Nastavení se otevírá z ovládacího prvku (klik), z tray nabídky („Nastavení…“) a z lišty nástěnky (tlačítko). Command `window_open_settings` okno vytvoří, nebo existující zaměří.

### Ovládací prvek
- Okno 120×40 logických px: bez dekorací, průhledné, vždy navrch, bez stínu OS, neměnné velikosti, `skip_taskbar`, při vytvoření nezískává fokus (`focused(false)`).
- Pozice: primární monitor, pravý horní roh pracovní plochy, posunuté doleva o šířku systémových tlačítek okna (~150 px), aby maximalizovaná aplikace měla zavírací tlačítko vždy dostupné. Výpočet je čistá funkce `domain::window_placement::control_position` (testovaná). Přepočítá se při každém zobrazení.
- Mimo Alt+Tab: na Windows `platform::windows::hide_from_task_switcher` nastaví `WS_EX_TOOLWINDOW` (bez `WS_EX_APPWINDOW`). `skip_taskbar` sám okno z Alt+Tab neodstraní. Na macOS stačí okno bez Docku (aplikace nemá ovládací prvek v Docku zvlášť), na Linuxu `skip_taskbar`. Je to jediné nové `unsafe` a je v `platform/windows.rs`. Dopad: `windows-sys` už je ve stromu závislostí (tao), přidává jen features.
- Vzhled: podlouhlý „3D“ obdélník čistě v CSS. Tělo s gradientem akcentu tématu (`--gradient-accent`), horní hrana světlejší, spodní hrana jako tloušťka, stín. Hover: náklon `perspective` + `rotateX/Y` podle polohy kurzoru a posun odlesku. Jen `transition` při pohybu myši, žádná nekonečná animace. Při `prefers-reduced-motion` se náklon vypne. Nové tokeny `--control-*` v obou tématech.
- Interakce: klik otevře nastavení. Pravé tlačítko otevře nativní kontextovou nabídku (`control_context_menu` → `Window::popup_menu`): Otevřít nástěnku, Nastavení…, Skrýt. Nativní nabídka, protože vlastní HTML menu se do okna 120×40 nevejde.
- Skrytí okno **zničí** (ne `hide`) a uloží `controlWidget = false`. Obnovení: přepínač v nastavení nebo zaškrtávací položka „Ovládací prvek“ v tray.
- macOS: průhledné okno vyžaduje `macOSPrivateApi` (feature `macos-private-api`). Aplikace se nedistribuuje přes App Store, takže je to přijatelné. Ověří se až na Macu.

### Tray
Nabídka: Otevřít nástěnku, Nastavení…, Ovládací prvek (zaškrtávací), oddělovač, Ukončit. Při změně jazyka nebo `controlWidget` se nabídka sestaví znovu (`TrayIcon::set_menu`). Texty zůstávají v `domain::locale`.

### Rámování
- `ItemStyle` dostane `frame: Option<FrameStyle>`, kde `None` = podle nástěnky. JSON sloupec `style` už existuje, migrace dat není potřeba (`{}` = bez přepisu).
- Rámy platí pro obrázky. Citáty a texty mají vlastní kartu tématu a rám nemají (spec mluví o rámech obrázků).
- Vykreslení: rám je CSS kolem obrázku uvnitř rozměru položky (`w × h` zahrnuje rám), obrázek má `object-fit: cover`. U polaroidu a paspart tak dojde k mírnému oříznutí okrajů fotky místo změny geometrie položky. Zamítnuto: zvětšovat položku o rám. Měnilo by to uložené souřadnice při přepnutí stylu nástěnky.
- Styly (tokeny pro obě témata): **bez rámu**, **tenká linka** (1 px linka + malý okraj), **paspartá** (široký světlý okraj, jemná vnitřní hrana), **polaroid** (bílý rám s vyšším spodním okrajem, prémiový), **sklo** (rozmazaný průsvitný okraj s odleskem, prémiový).
- Prémiové styly hlídá `useEntitlement("premiumFrames")`. Bez oprávnění je volba vidět se zámkem, klik nic nezmění a ukáže vysvětlení „odemkněte dárkovým kódem“. Rust navíc při `settings_set` a u položek nic neblokuje: oprávnění se může změnit (vypršení), proto se i uložený prémiový rám bez oprávnění **vykreslí jako bez rámu**, ale nesmaže.
- Výchozí rám nástěnky je v `Settings` (jedna nástěnka). Přepis u položky je v toolbaru vybraného obrázku (nabídka „Rám“). Změna je běžná úprava položky se zpět/znovu.

### Jen obrázky
`imagesOnly` filtruje citáty a texty při vykreslení (`Canvas`), položky zůstávají ve storu i v DB. Skrytá položka se odznačí. Přepínač je v nastavení (Vzhled) a v liště nástěnky, aby šel přepnout bez otevírání nastavení.

### Umístění zobrazení
`domain::placement::rect_in(work_area, placement) -> Rect` (čistá funkce, testy pro všechna ukotvení a ořez velikosti). Výška se dopočítá z poměru plátna 16:9 a omezí výškou pracovní plochy. Použije ji pop-up (fáze 3) i tapeta (fáze 4). Náhled v nastavení je schéma obrazovky 16:9 se stejným výpočtem v TS (`placementPreview`). Jde o pár řádků, sdílení přes IPC by zbytečně zpomalilo posuvník. Shodu hlídá test se stejnými vstupy na obou stranách.

### Autostart
- `tauri-plugin-autostart` (Windows: `HKCU\…\Run`, viditelné ve Správci úloh → Po spuštění; macOS: LaunchAgent; Linux: `~/.config/autostart`). Argument `--autostart`: při něm `setup` neotevře nástěnku, jen tray a ovládací prvek. Dopad: plugin + `auto-launch` ≈ desítky kB, nic neběží.
- Plugin se používá jen z Rustu (commands `autostart_get` / `autostart_set`), JS API pluginu ani jeho oprávnění se nepřidávají.
- Odinstalace: NSIS hook (`src-tauri/windows/hooks.nsh`, `NSIS_HOOK_PREUNINSTALL`) smaže hodnotu z `Run`. MSI by potřebovalo vlastní custom action, proto se pro Windows bude balit jen NSIS (`bundle.targets` bez `msi`). macOS: přetažení do koše LaunchAgent neodstraní; akceptováno a uvedeno v uživatelské dokumentaci.
- Obnovení výchozích hodnot autostart vypne.

### Přepínače „při spuštění“
`startup.wallpaper` a `startup.scheduledPopup` se ukládají nezávisle (spec autostart „Kombinace spouštěcích režimů“). UI se k nim přidá ve fázi 3 a 4 spolu s funkcí, aby uživatel neviděl přepínače, které nic nedělají.

### Okno nastavení
Boční navigace se sekcemi Obecné (jazyk, spuštění se systémem, ovládací prvek, obnovit výchozí), Vzhled (téma, výchozí rám s náhledy, jen obrázky), Zobrazení (umístění, velikost, ukotvení, náhled). Bez tlačítka Uložit, každá změna se uloží hned. „Obnovit výchozí“ s potvrzovacím dialogem. Komponenty z `src/design/components` (`SegmentedControl`, `Switch`, `Dialog`, `Field`) a nové `Slider` a `RadioCards` (náhledy rámů).

## Risks / Trade-offs

- [Okno ovládacího prvku = další WebView2 renderer] → měřit v release buildu podle `docs/performance.md`. Pokud přidá > 30 MB, fallback: vykreslit prvek nativně (tray-like okno s obrázkem bez webview). Rozhodne měření.
- [Průhledné okno WebView2 a klikání do průhledné části] → okno je jen 120×40 a tvar ho skoro vyplňuje; klik do rohu mimo tvar spustí akci také, což je přijatelné.
- [Ovládací prvek zakryje kus titulku maximalizovaných oken] → spec to připouští (max. jeho velikost). Pozice nechává volná systémová tlačítka.
- [Uložený prémiový rám po ztrátě oprávnění] → vykreslí se bez rámu, data zůstanou, po obnovení oprávnění se vrátí.
- [HKCU Run zůstane po odinstalaci přes MSI] → balí se jen NSIS.

## Odchylky při implementaci

- **Autostart plugin připnutý na 2.5.1.** Novější verze vyžadují Tauri 2.12 a `cargo add` by povýšil celý Tauri stack. Upgrade Tauri se udělá samostatně.
- **Typy nastavení bez `#[serde(default)]`.** Se `serde(default)` by tauri-specta generoval všechna pole jako volitelná. Výchozí hodnoty proto doplňuje jen `Settings::from_json_lenient`, které slučuje uložený JSON s výchozím i ve vnořených objektech.
- **Rám položky bez vlastní deserializace.** Neznámý rám u položky nečte zvláštní deserializer (ten rozdělil generované TS typy na `_Serialize`/`_Deserialize`). Stačí stávající pravidlo, že nečitelný `style` položky se při načtení nahradí výchozím.
- **Rám jednoho obrázku** se volí v nativním `<select>` v liště položky. Zamčené prémiové rámy jsou v něm neaktivní s popiskem „Prémiový“ a vysvětlení je v nastavení.
- **Přidání citátu nebo textu vypne „jen obrázky“**, jinak by nová položka hned zmizela.
- **Spec tray upravená** (delta `specs/tray`): klidová zátěž bez okna počítá se zobrazeným ovládacím prvkem, který má vlastní webview.
- **Ovládací prvek je na Windows nativní (rozhodnuto měřením, riziko z této kapitoly).** Webview prvek přidal v release buildu po ustálení +82 MB (86,7 MB oproti 4,5 MB jen s tray), protože když je jediným oknem, musí kvůli němu běžet celý WebView2 (prohlížeč, GPU, renderer). Spec povoluje 30 MB. Na Windows je proto prvek vrstvené Win32 okno (`platform::windows::control`, `UpdateLayeredWindow` s per-pixel alfou, `WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE`) s nativní kontextovou nabídkou (`TrackPopupMenu`). Vzhled se dál navrhuje v CSS (`src/app/control`). `pnpm control:render` ho přes Playwright vyrenderuje do PNG ve 3× (Galerie/Noc × klid/najetí) a Rust je při zobrazení zmenší na měřítko monitoru (`domain::control_look`). Najetí myší ukáže pevný náklon s odleskem místo náklonu sledujícího kurzor. Téma „podle systému“ čte `AppsUseLightTheme` z registru a na `WM_SETTINGCHANGE` se prvek překreslí. Na macOS a Linuxu zůstává webview prvek (`ControlApp`), tam je změření úkolem před vydáním.
- **Webview prvek (macOS, Linux)** potřebuje `min_inner_size`: bez ní Windows při testu rozšířil okno na minimální šířku 132 px.
- **Titulek okna nastavení** se při změně jazyka přeloží (`window_manager::retitle`).

## Review (úkol 7.1, 2026-10-08)

- **IPC vstupy:** `settings_set` přijímá jen `Settings` s výčty, čísly a booleany. Serde odmítne neznámé hodnoty a velikost se ořízne. Inicializační skript s nastavením proto nemůže obsahovat vložený řetězec. `autostart_set` bere jen bool. Plugin autostart nemá povolená JS oprávnění.
- **FFI (`platform/windows.rs`):** vypůjčení `RefCell` se nedrží přes volání Win32, která rozesílají zprávy (`UpdateLayeredWindow`, `TrackPopupMenu`, `ShowWindow`). Obsluha událostí se volá mimo vypůjčení (`Rc`) a okna vytváří až z async runtime. Všechny GDI objekty se uvolní i při chybě. Kopírování do DIB hlídá shodu velikosti. Okno se vytváří i ruší jen na hlavním vlákně.
- **Souběh:** `preferences::store` pustí zámek databáze dřív, než vytváří okna (`settings_script` čte nastavení znovu).
- **Odinstalace:** NSIS hook maže autostart jen mimo aktualizaci (`$UpdateMode`).
- Nalezené a opravené při ověřování v release buildu: webview prvek překročil paměťový limit (→ nativní prvek), titulek okna nastavení se nepřekládal (→ `retitle`).

## Úprava po zpětné vazbě (2026-10-09)

Prvek vždy navrchu v rohu při práci překážel a nešel posunout. Změna:

- `Settings.controlLayer`: **za okny** (nový výchozí stav) nebo **před okny**. Na Windows drží vrstvu „za okny“ `WM_WINDOWPOSCHANGING`, které každou změnu z-pořadí přepíše na `HWND_BOTTOM`. Prvek se tak chová jako widget na ploše a klik na něj ho nevytáhne nad okna.
- **Přesun tažením** v obou vrstvách. Stisk levého tlačítka se po překročení systémového prahu tažení (`SM_CXDRAG`/`SM_CYDRAG`) změní na tažení s `SetCapture`, jinak je to klik. Konec tažení uloží `Settings.controlPosition` (fyzické px). `window_placement::control_origin` ji použije, jen když prvek z alespoň poloviny leží na některé pracovní ploše (pak ho dotáhne dovnitř), jinak vrátí výchozí roh.
- **Vrátit do rohu** v kontextové nabídce prvku a v nastavení (`controlPosition = null`).
- macOS/Linux (webview): vrstva přes `always_on_top`/`always_on_bottom`, tažení zatím chybí (úkol vb-p53).
