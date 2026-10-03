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
