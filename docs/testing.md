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
