# Tasks

## 1. Obrázek tapety

- [x] 1.1 `domain::wallpaper::compose` (celá obrazovka s okraji, částečně na původní tapetě se zaoblením a stínem) a ověřit `cargo test`
- [x] 1.2 Vykreslovací okno `wallpaper-render` (`BoardView flat`, signál po načtení obrázků a písem) a snímek WebView2 `CapturePreview` a ověřit ručně v release buildu (snímek z okna mimo obrazovku)

## 2. Systémová tapeta (Windows)

- [x] 2.1 `IDesktopWallpaper` pro každý monitor, uložení a vrácení originálů (vypnutí, Ukončit, pád, `--restore-wallpaper`, NSIS hook) a ověřit ručně (dva monitory, vypnutí, ukončení)
- [x] 2.2 Obnova po změně nástěnky (debounce 2 s), nastavení (podpis vzhledu), tématu OS a monitorů a ověřit ručně (přidat obrázek → do 5 s na tapetě)

## 3. Nastavení

- [x] 3.1 Přepínač „Nástěnka jako tapeta plochy“ (zámek, mimo Windows neaktivní) cs/en/de a ověřit E2E

## 4. Dokončení

- [x] 4.1 Měření: čas vykreslení, špička paměti, klid 60 s (CPU, paměť), zapsat do `docs/performance.md`
- [x] 4.2 Review FFI (COM, CapturePreview, IDesktopWallpaper) a obnovy plochy a zapracovat nálezy
- [x] 4.3 Dokumentace: `docs/architecture.md`, `docs/user/wallpaper.md` (cs), ruční checklist, body do úkolu vb-8my
