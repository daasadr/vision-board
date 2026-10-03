# Testování

## Automatické testy

| Vrstva                                    | Nástroj                                | Příkaz                                                                                |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Frontend – unit a komponenty              | Vitest + Testing Library               | `pnpm test`                                                                           |
| Frontend – E2E (bez Tauri, mockované IPC) | Playwright                             | `pnpm e2e`                                                                            |
| Doménová logika (Rust)                    | `cargo test`                           | `pnpm rust:test`                                                                      |
| Lint a typy                               | ESLint, tsc, Prettier, clippy, rustfmt | `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm rust:lint`, `pnpm rust:fmt` |

### E2E a mock IPC

Playwright spouští produkční build frontendu (`vite preview`) v Chromiu bez Tauri. Rust backend nahrazuje `e2e/support/ipc.ts`: před načtením stránky podvrhne `window.__TAURI_INTERNALS__` a odpovídá na příkazy z mapy `ipc`. Test si odpovědi nastaví přes `test.use({ ipc: { command_name: value } })`. Nenamockovaný příkaz selže stejně jako neregistrovaný příkaz v Tauri. Volání jsou pro kontrolu v `window.__E2E_IPC_CALLS__`.

Typy příkazů generuje tauri-specta do `src/lib/bindings.ts` (`pnpm bindings`).

## Ruční checklist nativního chování

Nativní chování, které Playwright s mockovaným IPC nepokryje. Před vydáním projít na Windows a macOS.

### Aplikace (app-shell)

| Scénář             | Postup                                                                       | Očekávaný výsledek                                               | Ověřeno                                                   |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| Jediná instance    | Spustit aplikaci, pak ji spustit znovu                                       | Druhý proces se ukončí, existující okno se zobrazí a získá fokus | Windows 11, 2026-09-26                                    |
| Obnova polohy okna | Přesunout a zmenšit okno, zavřít, spustit znovu                              | Okno má stejnou polohu a velikost                                | Windows 11, 2026-09-26                                    |
| Okno mimo monitory | Přesunout okno mimo všechny monitory (nebo odpojit monitor), zavřít, spustit | Okno se otevře vycentrované na primárním monitoru                | Windows 11, 2026-09-26 (simulováno přesunem na 9000,9000) |

Poloha okna se ukládá při zavření. Násilné ukončení procesu (Správce úloh) polohu neuloží, a to je v pořádku.

### Nástěnka a média (board-core)

| Scénář                            | Postup                             | Očekávaný výsledek                                            | Ověřeno                                                                       |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Přetažení z Průzkumníka / Finderu | Přetáhnout 3 fotky JPG na nástěnku | 3 obrázky kolem místa puštění, mírně vějířovitě               | E2E (simulovaná událost Tauri); skutečné přetažení z OS zatím ručně neověřeno |
| PNG + PDF v jedné dávce           | Přetáhnout PNG a PDF               | PNG přidán, oznámení „… není podporovaný obrázek“             | Windows 11, 2026-10-03 (command přes CDP)                                     |
| Import 40 MB obrázku              | Vložit 40 MB PNG                   | UI reaguje, zástupný obdélník, obrázek uložen ~1 MB–3 MB WebP | Windows 11, 2026-10-03: 5 s, nejdelší mezera mezi snímky 17 ms                |
| Asset protokol                    | Zobrazit uložený obrázek           | Načte se; soubor mimo `media/` se nenačte                     | Windows 11, 2026-10-03                                                        |

### Tray a životní cyklus

| Scénář                 | Postup                                | Očekávaný výsledek                                                                                             | Ověřeno                                          |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Tray ikona             | Spustit aplikaci                      | Ikona v oznamovací oblasti, nabídka „Otevřít nástěnku“ / „Ukončit“ v jazyce systému, levý klik otevře nástěnku | Ručně neověřeno (automatizace na tray nedosáhne) |
| První zavření okna     | Zavřít okno                           | Dialog „Vision Board poběží dál“, po „Rozumím“ se okno zavře, aplikace běží                                    | Windows 11, 2026-10-03                           |
| Další zavření          | Zavřít okno znovu                     | Bez dialogu, aplikace běží v tray                                                                              | Windows 11, 2026-10-03                           |
| Jen tray               | 60 s bez okna                         | < 40 MB, žádné procesy msedgewebview2                                                                          | Windows 11, 2026-10-03: 4,9 MB                   |
| Znovuotevření          | Spustit aplikaci znovu / klik na tray | Okno se otevře, druhá instance se ukončí                                                                       | Windows 11, 2026-10-03 (spuštěním)               |
| Ukončit hned po úpravě | Přidat citát a do 300 ms Ukončit      | Po restartu je citát na nástěnce                                                                               | Windows 11, 2026-10-03 (`app_quit`, 170 ms)      |
| Ukončit během importu  | Spustit import 40 MB a Ukončit        | Aplikace počká na dokončení (max 5 s), žádné .tmp soubory                                                      | Windows 11, 2026-10-03: ukončeno po 4,5 s        |
