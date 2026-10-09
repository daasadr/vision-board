# Design

## Context

Staví na kostře z `bootstrap-project` (struktura `core`/`commands`/`platform`, typované IPC přes tauri-specta, design tokeny, i18n). Požadavky viz specs/board, media-import, tray, entitlements.

## Goals / Non-Goals

**Goals:**
- Datový model a souřadnice, které beze změny použije pop-up (fáze 3), tapeta (fáze 4) i split-screen (fáze 5).
- Plynulé tažení (60 fps) i se 100 položkami.

**Non-Goals:**
- Více nástěnek v UI (model je ale připravený – `board_id`).
- Rámování a styly položek (fáze 2) – položka má jen pole `style` s výchozí hodnotou.

## Decisions

### Souřadnice: logické plátno 1920×1080
Položky ukládají `x, y, w, h` v logických jednotkách plátna 1920×1080 (16:9), `rotation` ve stupních, `z` celé číslo. Renderer plátno škáluje `transform: scale()` do dostupného prostoru (letterbox). Proč: tapeta a pop-up běží na monitorech s různým rozlišením; relativní rozložení se tím zachová zdarma. Alternativa (procenta) zamítnuta – horší práce s poměrem stran obrázků. Poměr stran plátna se ve fázi 2 může stát nastavením (split-screen, ultrawide); model to unese přidáním `aspect` na board.

### Úložiště: SQLite přes rusqlite
`board.db` v `app_data_dir`, WAL režim, migrace přes `rusqlite_migration`. Tabulky:
- `boards(id, name, created_at, updated_at)`
- `items(id, board_id, kind['image'|'quote'|'text'], x, y, w, h, rotation, z, payload_json, style_json, created_at, updated_at)`
- `media(id, path, width, height, bytes, created_at)`; `payload_json` obrázku odkazuje na `media.id`.
Transakční zápisy chrání data při pádu (WAL). Alternativa `tauri-plugin-sql` zamítnuta – SQL by žilo ve frontendu; chceme doménovou logiku v Rustu testovatelnou `cargo test`. Dopad: rusqlite bundled ≈ +1,5 MB binárky.

### Ukládání z frontendu
Store (Zustand) drží stav nástěnky a historii úprav jako seznam *příkazů* (add/move/resize/rotate/edit/delete/reorder) s inverzí – zpět/znovu je čistě frontendová logika testovatelná Vitestem. Změny se do Rustu posílají debounced (300 ms, max. 1 s) jako dávka `apply_board_ops`. Tažení během pohybu nic neukládá; ukládá se po puštění.

### Interakce na plátně
Vlastní pointer handling (pointer events + `setPointerCapture`), pozice během tažení přes CSS `transform` bez re-renderu Reactu (ref + requestAnimationFrame), commit do storu po puštění. Klávesnice: šipky posun o 1/10 jednotek, Delete, Ctrl+Z/Shift+Z, Tab mezi položkami (přístupnost). Zamítnuto: react-konva/fabric (canvas – horší přístupnost, text a typografie tématu, +150 kB), dnd-kit (určený pro seznamy, ne volné plátno).

### Import a komprese médií (Rust)
- Vstupy: drag-drop událost Tauri (cesty k souborům), schránka (`arboard` nebo frontend `paste` event → bytes přes IPC), dialog (`tauri-plugin-dialog`).
- Pipeline v `domain/media` na `tauri::async_runtime::spawn_blocking`: kontrola velikosti a magických bajtů (ne přípony) → dekódování `image` → aplikace EXIF orientace (`kamadak-exif`) → resize `Lanczos3` na max 2560 px → encode WebP q80 (`webp` crate, libwebp) → zápis `media/<uuid>.webp` přes dočasný soubor + rename → náhled 480 px `media/<uuid>_t.webp`.
- Re-encoding zahazuje metadata automaticky (EXIF/GPS se nekopírují).
- Frontend zobrazuje přes `convertFileSrc` (asset protokol s scope omezeným na `media/`).
- Dopad: `image` (jen features jpeg, png, webp, gif) + libwebp ≈ +2 MB binárky, paměť jen během importu.

### Úklid médií
Při startu a při ukončení: `DELETE` médií bez odkazu z `items`. Smazané položky v historii zpět/znovu drží odkaz jen v paměti relace – úklid při ukončení je proto bezpečný.

### Tray a životní cyklus
Tauri tray API (feature `tray-icon`). `CloseRequested` hlavního okna → `window.destroy()` (ne hide) → uvolní webview; aplikace drží běh přes `RunEvent::ExitRequested` → `api.prevent_exit()`, pokud nejde o volbu „Ukončit“. Flag „upozornění o tray zobrazeno“ v tabulce `app_state(key, value)`. „Ukončit“ čeká na frontu ukládání/importu (max 5 s).

### Entitlements
`domain/entitlements`: `enum Feature { PremiumFrames, Wallpaper, ScheduledPopup }`, `fn is_enabled(Feature) -> bool` (zatím `true`), command `entitlements_get` → frontendový hook `useEntitlement(feature)`. Fáze 6 nahradí implementaci ověřením licence.

## Risks / Trade-offs

- [libwebp vyžaduje C toolchain v CI] → MSVC je na windows-latest i Xcode na macos-latest; ověřit v CI úkolu. Fallback: `image` WebP lossless (větší soubory).
- [Webview po `destroy()` na Windows nemusí uvolnit všechnu paměť] → měření v úkolu na klidovou zátěž; fallback – restart „lehkého“ režimu není potřeba řešit předem.
- [Velké množství položek zpomalí DOM] → cíl 100 položek; náhledy místo plných obrázků při zoomu < 50 %.
- [Schránka na macOS/Windows vrací různé formáty] → frontend `paste` event (stejné API ve WebView2 i WKWebView), Rust přijme bytes.

## Odchylky při implementaci

- **EXIF orientace:** místo `kamadak-exif` stačí `image` 0.25 (`ImageDecoder::orientation` + `apply_orientation`), takže je o jednu závislost méně.
- **Výběr souborů:** místo `tauri-plugin-dialog` stačí skrytý `<input type="file">`. WebView otevře nativní dialog a soubory jdou do Rustu jako base64 přes `media_import_bytes`, stejně jako vložení ze schránky. Přetažení z OS posílá cesty (`media_import_paths`). Velké soubory z dialogu tak putují přes IPC jako base64, což je při limitu 50 MB přijatelné.
- **Tažení:** během pohybu se položka posouvá přes `transform` na vlastní kompoziční vrstvě (`will-change`), `left/top` se zapíší až po puštění. Obrázky menší než 480 px na obrazovce se vykreslují z náhledu.
- **Ukončení:** kromě tray nabídky existuje command `app_quit` se stejným průběhem (využije ho nastavení ve fázi 2 a automatické testy).
- **První zavření okna:** upozornění „poběží dál v tray“ je dialog v okně (okno se zavře až po potvrzení), takže není potřeba plugin pro systémové notifikace.
- **Vývojový profil:** závislosti se kompilují s `opt-level = 2`, protože dekódování fotek v neoptimalizovaném buildu trvalo přes minutu.

## Review bezpečnosti (úkol 3.5, 2026-10-08)

Review místo Codexu udělal Claude (rozhodnutí uživatelky: malá osobní aplikace). Prošlo parsování souborů (`domain/media.rs`, `commands/media.rs`), asset protokol, CSP, capabilities a cesta souborů z frontendu.

V pořádku:
- Formát se pozná podle magických bajtů, dekodéry mají limity rozměrů (16 384 px) a alokace (768 MB) proti dekompresním bombám, výstup je vždy znovu zakódovaný WebP bez metadat.
- Jména uložených souborů jsou UUID, vstup od uživatele se do cest nedostane. Úklid médií maže jen běžné soubory (symlinky přeskočí).
- Asset protokol vidí jen `$APPDATA/media/*` (stejná složka jako `MediaDir`), CSP nepovoluje cizí skripty ani síť, okno má jen `core:default` a `allow-destroy`. Texty se vykreslují přes React (escapované), `dangerouslySetInnerHTML` se nikde nepoužívá.
- SQL je všude parametrizované.

Opraveno:
- `import_file` četl soubor podle velikosti zjištěné předem. Zařízení nebo roura (velikost 0) by se četly donekonečna a soubor, který mezitím narostl, by se načetl celý. Teď se přijímají jen běžné soubory a čte se nejvýš limit + 1 bajt.
- Obrázek s obří plochou (až 16 384 px) by při Lanczos zmenšení alokoval ~0,7 GB. Nejdřív se proto rychle zmenší na dvojnásobek cíle.
- Soubory z dialogu se četly a posílaly všechny najednou a i soubory nad 50 MB se celé načetly do paměti, než je Rust odmítl. Teď jdou po jednom a velikost se kontroluje před čtením (`importFilesInTurn`).

Vědomě přijato:
- `media_import_paths` přijme libovolnou cestu z webview. Webview načítá jen vlastní kód (CSP) a obrázek se jen překóduje do vlastní složky, takže hrozba je zanedbatelná.
- Release profil má `panic = "abort"`. Případná chyba dekodéru na poškozeném souboru proto ukončí aplikaci (ztratí se nejvýš poslední sekunda úprav). Zachytávání přes `unwind` by zvětšilo binárku o 4,3 MB (7,4 → 11,8 MB, změřeno). Dekodéry jsou v Rustu a upstream se fuzzují.
