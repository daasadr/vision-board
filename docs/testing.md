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
| Jen tray               | 60 s bez okna, ovládací prvek skrytý  | < 40 MB, žádné procesy msedgewebview2                                                                          | Windows 11, 2026-10-03: 4,9 MB                   |
| Znovuotevření          | Spustit aplikaci znovu / klik na tray | Okno se otevře, druhá instance se ukončí                                                                       | Windows 11, 2026-10-03 (spuštěním)               |
| Ukončit hned po úpravě | Přidat citát a do 300 ms Ukončit      | Po restartu je citát na nástěnce                                                                               | Windows 11, 2026-10-03 (`app_quit`, 170 ms)      |
| Ukončit během importu  | Spustit import 40 MB a Ukončit        | Aplikace počká na dokončení (max 5 s), žádné .tmp soubory                                                      | Windows 11, 2026-10-03: ukončeno po 4,5 s        |

### Nastavení a ovládací prvek (settings-appearance)

| Scénář                            | Postup                                                                  | Očekávaný výsledek                                                              | Ověřeno                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Změna v nastavení všude           | V nastavení změnit téma a jazyk                                         | Nástěnka, nastavení i ovládací prvek se přepnou do 1 s                          | Windows 11, 2026-10-08 (CDP)                                            |
| Ovládací prvek                    | Spustit aplikaci                                                        | Obdélník 120×40 vpravo nahoře vlevo od tlačítek oken, vždy navrch               | Windows 11, 2026-10-08: 120×40, TopMost                                 |
| Prvek mimo Alt+Tab a hlavní panel | Alt+Tab, hlavní panel                                                   | Prvek v seznamu není                                                            | Windows 11, 2026-10-08: `WS_EX_TOOLWINDOW`, bez `APPWINDOW`             |
| Klik na prvek                     | Kliknout na obdélník                                                    | Otevře se nastavení, aktivní aplikace nepřijde o fokus                          | Windows 11, 2026-10-08 (zpráva oknu); fokus ručně neověřen              |
| Kontextová nabídka prvku          | Pravé tlačítko na obdélník                                              | Nabídka Otevřít nástěnku / Nastavení… / Skrýt v jazyce aplikace                 | Ručně neověřeno                                                         |
| Najetí myší                       | Najet na obdélník                                                       | Obdélník se nakloní a zvýrazní, po odjetí se vrátí                              | Ručně neověřeno                                                         |
| Skrytí a obnovení prvku           | Skrýt, restartovat, zapnout v nastavení nebo v tray                     | Po restartu zůstane skrytý; po zapnutí se objeví                                | Windows 11, 2026-10-08 (nastavení); tray ručně neověřen                 |
| Téma prvku podle systému          | Téma „podle systému“, přepnout světlý/tmavý režim Windows               | Prvek přejde z cihlové (Galerie) na mosaznou (Noc)                              | Ručně neověřeno                                                         |
| Spouštění po přihlášení           | Zapnout v nastavení, restartovat počítač                                | Po přihlášení běží tray a prvek bez okna; položka ve Správci úloh → Po spuštění | Windows 11, 2026-10-08: registr `Run` + `--autostart`; restart neověřen |
| Odinstalace odebere autostart     | Zapnout autostart, odinstalovat (NSIS)                                  | Položka „Vision Board“ v `HKCU\…\Run` zmizí; při aktualizaci zůstane            | Ručně neověřeno                                                         |
| Paměť s prvkem                    | 60 s bez okna, prvek zobrazený                                          | Nejvýše +30 MB proti stavu jen v tray, CPU v klidu                              | Windows 11, 2026-10-08: 4,6 MB, 0 s CPU                                 |
| Prvek za okny                     | Výchozí nastavení, otevřít jinou aplikaci přes prvek, kliknout na prvek | Aplikace prvek překryje; klik na prvek ho nevytáhne nad okna                    | Ručně neověřeno                                                         |
| Přesun tažením                    | Přetáhnout prvek jinam, restartovat                                     | Prvek zůstane na novém místě; krátký klik dál otevírá nastavení                 | Ručně neověřeno                                                         |
| Vrátit do rohu                    | Pravé tlačítko → Vrátit do rohu                                         | Prvek se vrátí do pravého horního rohu                                          | Ručně neověřeno                                                         |

### Naplánované zobrazení (scheduled-popup)

| Scénář                  | Postup                                                 | Očekávaný výsledek                                              | Ověřeno         |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------- | --------------- |
| Zobrazit teď            | Tray → Zobrazit nástěnku teď                           | Nástěnka na všech monitorech v nastaveném umístění, s prolnutím | Ručně neověřeno |
| Bez krádeže fokusu      | Psát v editoru, spustit pop-up                         | Text se dál píše do editoru; po zavření je fokus tam, kde byl   | Ručně neověřeno |
| Čekání na pauzu         | Plán za 1 min, souvisle psát                           | Nástěnka se ukáže až 5 s po posledním stisku                    | Ručně neověřeno |
| Prezentace / fullscreen | Plán za 1 min, spustit video přes celou obrazovku      | Nástěnka se neukáže, dokud video běží přes celou obrazovku      | Ručně neověřeno |
| Zamčená obrazovka       | Plán za 1 min, zamknout (Win+L), po 2 min odemknout    | Nástěnka se ukáže až po odemčení a pauze                        | Ručně neověřeno |
| Odložit                 | V pop-upu Odložit 5 min                                | Zmizí a ukáže se znovu za 5 min                                 | Ručně neověřeno |
| Vypnutý plán            | Plán vypnutý, 60 s v klidu                             | Žádné probouzení, CPU 0                                         | Ručně neověřeno |
| Spánek počítače         | Plán na čas, kdy počítač spí; probudit později týž den | Nástěnka se po probuzení ukáže jednou                           | Ručně neověřeno |
