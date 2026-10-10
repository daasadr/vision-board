# Design

## Context

Staví na fázích 1–3: nástěnka v SQLite, nastavení v Rustu (`preferences`, `Settings.startup.wallpaper` z fáze 2), umístění `domain::placement::rect_in`, `BoardView` jen ke čtení (pop-up, fáze 3), `Entitlements` a nativní vrstva `platform/` (Win32 přes `windows` 0.61 se stejnými features jako tao). Požadavky viz specs/wallpaper.

Poznatky z dřívějších fází: WebView2 jako jediné okno stojí ~80 MB (fáze 2, ovládací prvek). Okno s `focused(false)` nebere fokus a tool window chybí v Alt+Tab.

## Goals / Non-Goals

**Goals:**
- Nástěnka za ikonami na všech monitorech, v nastaveném umístění a tématu.
- V klidu 0 % CPU a žádná paměť navíc. Spec povoluje nejvýš +60 MB.
- Plocha po vypnutí, ukončení i odinstalaci jako dřív.

**Non-Goals:**
- Interaktivní tapeta (rozhodnutí bod 1), animace, video.
- macOS a Linux v této iteraci (viz níže).

## Decisions

### Statický snímek místo živého webview (rozhodnuto pro uživatele)
Tapeta je jen na dívání, takže živé webview nepřináší nic, co by uživatel viděl, a stálo by trvale ~80 MB (víc, než spec povoluje). Zvoleno:

1. Nástěnku vykreslí **stejný kód jako okno nástěnky** (`BoardView flat`: rámy, písma, téma) v neviditelném okně `wallpaper-render`. Okno leží vlevo za všemi monitory, nemá fokus, chybí v Alt+Tab a má velikost největšího monitoru v 16:9 (nejvýš 3840 px na šířku).
2. Stránka po načtení obrázků a písem (`document.fonts.ready`, `img.decode()`, dva snímky) zavolá `wallpaper_rendered`. Rust pořídí snímek přes WebView2 `CapturePreview` (PNG) a okno zruší.
3. `domain::wallpaper::compose` složí obrázek pro každý monitor. Celá obrazovka: nástěnka přes celý monitor, okraje u jiného poměru stran v barvě okraje nástěnky. Částečně: nástěnka se zaoblenými rohy a jemným stínem na **původní tapetě uživatele** (cover), nebo na barvě okraje, když původní obrázek není.
4. Obrázky (JPEG) se uloží do `app data/wallpaper/` a nastaví jako **skutečná systémová tapeta** pro každý monitor přes `IDesktopWallpaper` (dokumentované API Windows 8+).

Proč systémová tapeta, a ne okno ve WorkerW: ikony jsou nad ní samy od sebe, restart Průzkumníka, spánek i zamykací obrazovka jsou bez práce, nic nevykresluje a nehrozí zbytková okna. Cena je, že se mění skutečné nastavení tapety, proto se pečlivě ukládá a vrací původní (níže). Dopad: `webview2-com` je už ve stromu (wry), features `windows` zapíná tao, takže nic nového se nekompiluje.

### Kdy se obrázek obnoví
- **Změna nástěnky:** `board_apply_ops` → `wallpaper::refresh(force)` s debounce 2 s (spec ≤ 5 s).
- **Změna nastavení:** `preferences::apply` → `refresh`. Vykreslí se jen tehdy, když se změnilo něco, co tapeta ukazuje (téma, rám, jen obrázky, umístění, téma OS, monitory; „podpis“ v paměti).
- **Téma OS a monitory:** `WM_SETTINGCHANGE` a `WM_DISPLAYCHANGE` z okna nativního ovládacího prvku → `refresh`. Když je prvek skrytý, tyto podněty chybí. Obrázek se pak obnoví při příští změně nebo startu (zapsáno jako omezení).
- **Start aplikace:** `refresh(force)`, takže autostart s tapetou ukáže aktuální nástěnku bez okna.

### Původní tapeta
- Před první změnou se uloží `IDesktopWallpaper::GetWallpaper` pro každý monitor a režim přizpůsobení (`GetPosition`) do `app_state` (`wallpaper_originals`, JSON). Vlastní obrázky aplikace se za původní nikdy nepovažují. Monitor připojený později se doplní.
- **Vrácení:** při vypnutí režimu, při Ukončit (`lifecycle::request_quit`), po pádu (start s vypnutým režimem a uloženými originály) a při odinstalaci. NSIS hook spustí `vision-board.exe --restore-wallpaper`. Když aplikace běží, single-instance předá požadavek běžící instanci a ta tapetu vrátí a skončí. Při aktualizaci (`/UPDATE`) se nevrací nic.
- COM: funkce tapety inicializují COM na volajícím vlákně (`CoInitializeEx` MTA, na hlavním vlákně STA už je), takže vrácení funguje i z vlákna při ukončení.

### Nastavení
Sekce Zobrazení: přepínač „Nástěnka jako tapeta plochy“ (`Settings.startup.wallpaper`, zámek bez oprávnění `Wallpaper`, mimo Windows neaktivní s vysvětlením). Velikost a ukotvení platí z téže sekce.

### macOS a Linux
Zatím nevyvíjeno, přepínač je tam neaktivní. Stejný postup jde přenést: snímek přes `WKWebView.takeSnapshot`, tapeta přes `NSWorkspace.setDesktopImageURL` pro každý `NSScreen`, na Linuxu `gsettings org.gnome.desktop.background`. Úkol vb-p53 (Mac) se rozšíří.

## Risks / Trade-offs

- [WebView2 nevykreslí okno mimo obrazovku (occlusion)] → ověřit v release buildu jako první krok. Záloha: okno na obrazovce pod všemi okny (`HWND_BOTTOM`), nebo `--disable-features=CalculateNativeWinOcclusion`.
- [Prezentace / prezentace tapet (slideshow) ve Windows] → `GetWallpaper` vrátí aktuální obrázek, vrátí se tedy statický obrázek místo prezentace. Zapsat do dokumentace.
- [Krátká špička paměti a CPU při vykreslení (webview na 1–3 s)] → jen po změně, s debounce.
- [Pád aplikace nechá nástěnku jako tapetu] → neškodné, při dalším startu se buď obnoví, nebo vrátí původní.

## Ověření a odchylky (2026-10-10)

- **Snímek okna mimo obrazovku funguje:** WebView2 vykreslí i okno vlevo za všemi monitory a `CapturePreview` vrátí věrnou podobu nástěnky (téma Noc, rám Sklo s rozmazáním, citát). Záloha z rizik nebyla potřeba.
- Release build, dva monitory: obrázky 3840×2160 a 1920×1080 se nastaví jako tapeta každého monitoru. Částečné umístění leží na původní tapetě se zaoblením a stínem. Vypnutí vrátí původní tapetu na oba monitory a smaže vygenerované soubory (ověřeno přes `IDesktopWallpaper::GetWallpaper`).
- Klid s tapetou bez okna: 5,3 MB, 0 s CPU za 60 s.
- **Nalezené chyby a opravy:**
  - Obnova přes běžící instanci (odinstalace za běhu) selhávala. Single-instance callback běží uvnitř synchronní zprávy `WM_COPYDATA`, kde Windows nedovolí volat COM jiného procesu. Obnova teď běží na vlastním vlákně.
  - Nové vykreslení rušilo rozběhnuté vykreslení (debounce přes `abort`), takže vykreslovací okno zůstalo viset a další vykreslení selhávala (okno se stejným štítkem). Teď se ruší jen čekání, vykreslení běží vždy do konce (jedno po druhém) a případné staré okno se před vykreslením zavře.
- Čekání před vykreslením: 2 s po úpravě nástěnky (úpravy chodí v dávkách), 300 ms po změně nastavení, aby zapnutí bylo co nejrychlejší.

## Review (úkol 4.2)

- **COM:** funkce tapety inicializují COM na volajícím vlákně. Řetězce z API se uvolní přes `CoTaskMemFree` právě jednou. Vstupní řetězce jsou `HSTRING` platné po dobu volání. Snímek: stream žije v obsluze do dokončení a obsluha se zavolá právě jednou (`Mutex<Option<…>>`). `GlobalLock` se kontroluje na null a odemyká se.
- **Soubory:** obrázky se zapisují jen do `app data/wallpaper/` s vlastními jmény a mažou se jen soubory v této složce. Původní tapeta uživatele se nikdy nemaže ani nepřepisuje, jen čte. Vlastní obrázky se nikdy neuloží jako „původní“.
- **IPC:** jediný nový příkaz `wallpaper_rendered` nic nepřijímá a jen probudí čekající vykreslení.
- **Obnova plochy:** vypnutí, Ukončit, start po pádu a odinstalace (NSIS jen mimo aktualizaci). Při chybě jednoho monitoru se ostatní obnoví.
