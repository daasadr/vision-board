# Výkon a paměť

Cíle ze specifikací: klid s otevřeným oknem < 1 % CPU a < 150 MB (app-shell), jen tray < 40 MB bez procesů webview (tray, fáze 1).

## Jak měřit

- **Paměť** = součet _privátních pracovních sad_ (Working Set – Private) procesu `vision-board` a všech jeho podřízených procesů `msedgewebview2`. Odpovídá sloupci „Paměť“ ve Správci úloh.
  Nepoužívat součet Working Set (sdílené stránky DLL se započítají víckrát) ani Private Bytes (u GPU procesu obsahuje sdílené GPU buffery, které fyzickou RAM nezabírají).
- **CPU** = přírůstek procesorového času celého stromu procesů za 60 s děleno počtem jader.
- Vždy měřit **release build** (`pnpm tauri build --no-bundle`), 10 s po startu, bez interakce.

## Měření

### 2026-09-26 – bootstrap (prázdné okno, fonty a témata)

Windows 11, 8 jader, release build, `vision-board.exe` 4,3 MB.

| Metrika                               | Hodnota                                                                 | Cíl      |
| ------------------------------------- | ----------------------------------------------------------------------- | -------- |
| CPU v klidu (60 s)                    | 0,085 %                                                                 | < 1 %    |
| Paměť – privátní pracovní sady celkem | 102 MB                                                                  | < 150 MB |
| – z toho vlastní proces aplikace      | 4 MB                                                                    |          |
| Počet procesů                         | 1 + 6× msedgewebview2 (browser, GPU, renderer, síť, úložiště, crashpad) |          |

Pro srovnání: Working Set celkem 355 MB, Private Bytes 193 MB (z toho GPU proces 124 MB). Ani jedna metrika neodpovídá skutečné spotřebě RAM, viz výše.

Vyzkoušené a nezavedené: `--renderer-process-limit=1` a vypnutí funkcí Edge (SmartScreen, Translate) přes `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` ušetřily jen ~4 MB.

### 2026-10-03 – fáze 1, jen tray (bez okna)

Debug build, Windows 11, 60 s po zavření okna: **4,9 MB** (vlastní proces), žádné procesy msedgewebview2. Cíl < 40 MB. Okno se po zavření ruší (`destroy`), WebView2 se ukončí spolu s ním.

### 2026-10-03 – fáze 1, tažení se 100 položkami

Měřeno ve skutečné aplikaci (WebView2) přes CDP: nástěnka naplněná 40 obrázky, 40 citáty a 20 texty, okno v popředí. Tažení jedné položky bylo simulované přes `Input.dispatchMouseEvent` a pro kontrolu i čistě animací bez vstupu. Zaznamenávaly se mezery mezi snímky `requestAnimationFrame` a dlouhé úlohy.

| Nástěnka    | Klid (max) | Tažení medián | Tažení p95 | Dlouhé úlohy |
| ----------- | ---------- | ------------- | ---------- | ------------ |
| 3 položky   | 17 ms      | 16,7 ms       | 50 ms      | 0            |
| 30 položek  | 17 ms      | 16,7 ms       | 50 ms      | 0            |
| 100 položek | 17 ms      | 16,7 ms       | 50 ms      | 0            |

Závěry:

- **Počet položek výkon neovlivňuje.** 100 položek je stejně plynulých jako 3 a hlavní vlákno není nikdy blokované (žádné dlouhé úlohy).
- Občasné vynechané snímky (p95 ~50 ms) se objevují při jakékoli animaci i na téměř prázdné nástěnce. Vypnutí stínů, skrytí obrázků ani CSS containment na tom nic nezměnily. Jde o vlastnost prostředí: integrovaná grafika AMD Radeon Vega 11 a dva monitory (2560×1440 + 1280×720), GPU kompozice WebView2 je zapnutá. **Přeměřit na jiném počítači** (`scratchpad` skript `cdp-perf.mjs` je popsaný níže).
- Optimalizace, které zůstaly: tažení posouvá položku přes `transform` na vlastní kompoziční vrstvě (`will-change`) a do stylu se zapisuje přímo, bez renderu Reactu. Obrázky menší než 480 px na obrazovce se vykreslují z náhledu místo plné verze.

Postup měření: spustit aplikaci s `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`, okno dát do popředí (zakrytá okna Chromium zpomaluje), přes CDP vložit položky `board_apply_ops`, znovu načíst stránku a měřit `requestAnimationFrame` během tažení.

### 2026-10-08 – fáze 2, ovládací prvek na ploše

Release build, Windows 11, hlavní okno a nastavení zavřené, měřeno po ukončení procesů WebView2 (ty po zavření posledního webview okna doběhnou do ~1 min).

| Stav                                  | Paměť (privátní pracovní sady) | CPU za 60 s | Procesy               |
| ------------------------------------- | ------------------------------ | ----------- | --------------------- |
| jen tray (prvek skrytý)               | 4,5 MB                         | 0 s         | 1                     |
| prvek jako webview (první verze)      | 86,7 MB                        | 0 s         | 1 + 6× msedgewebview2 |
| prvek nativní (`UpdateLayeredWindow`) | 4,6 MB                         | 0 s         | 1                     |

Webview varianta překročila limit specifikace (+30 MB), protože jako jediné okno drží celý WebView2 (prohlížeč, GPU, renderer). Na Windows je proto prvek nativní okno s předem vyrenderovanými bitmapami (`pnpm control:render`). Binárka: 7,4 MB po fázi 1 → 8,2 MB (nastavení, autostart, obrázky prvku). Na macOS a Linuxu zůstává webview prvek, změřit před vydáním.

Postup: `scratchpad` skript `measure.ps1` sčítá `WorkingSetPrivate` z `Win32_PerfFormattedData_PerfProc_Process` pro proces aplikace a jeho potomky (WebView2) a CPU čas z `Get-Process` na začátku a na konci okna.
