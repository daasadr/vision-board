# Vývoj

## Požadavky

- Node.js 22+, pnpm 12 (verze je v `package.json` → `packageManager`, `corepack enable` ji nainstaluje)
- Rust stable 1.85+ (`rustup update`)
- Windows: Visual Studio Build Tools (MSVC) a WebView2 (součást Windows 11). macOS: Xcode Command Line Tools.
- Volitelně: [Claude Code CLI](https://claude.com/claude-code) pro agentické review před pushem, `bd` (Beads) pro úkoly, `openspec` pro specifikace

## Začátek

```sh
pnpm install          # nainstaluje závislosti i git hooky (skript prepare → lefthook install)
pnpm tauri dev        # aplikace s hot reloadem
pnpm dev              # jen frontend v prohlížeči (http://localhost:1420, /design = ukázka design systému)
```

## Příkazy

| Příkaz             | Co dělá                                                         |
| ------------------ | --------------------------------------------------------------- |
| `pnpm tauri dev`   | spustí aplikaci ve vývojovém režimu                             |
| `pnpm tauri build` | release build a instalátory (`src-tauri/target/release/bundle`) |
| `pnpm lint`        | ESLint + Stylelint (tokeny místo pevných hodnot)                |
| `pnpm typecheck`   | TypeScript: aplikace, testy, konfigurace                        |
| `pnpm format`      | Prettier (`format:check` jen kontroluje)                        |
| `pnpm test`        | Vitest (unit a komponenty)                                      |
| `pnpm e2e`         | Playwright proti produkčnímu buildu frontendu s mockovaným IPC  |
| `pnpm rust:fmt`    | kontrola formátu Rustu                                          |
| `pnpm rust:lint`   | clippy s `-D warnings`                                          |
| `pnpm rust:test`   | `cargo test` (vygeneruje i TS bindings)                         |
| `pnpm bindings`    | přegeneruje `src/lib/bindings.ts` z Rust commandů               |

Podrobnosti o testech: [testing.md](testing.md). Výkon a jak ho měřit: [performance.md](performance.md).

## Git hooky (Lefthook)

Konfigurace je v [`lefthook.yml`](../lefthook.yml) a instaluje se automaticky při `pnpm install`.

| Hook         | Co spouští                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | paralelně a jen nad změněnými soubory: ESLint, Prettier, Stylelint, typecheck, rustfmt, clippy                                          |
| `pre-push`   | postupně: `pnpm test`, `pnpm rust:test`, pak agentické code + security review ([`scripts/agent-review.sh`](../scripts/agent-review.sh)) |
| všechny      | `bd hooks run <hook>` (integrace Beads, pokud je `bd` nainstalovaný)                                                                    |

**Agentické review** pošle diff od upstreamu (nebo od `main`) do Claude Code CLI. Ten udělá code review a security review a push zastaví jen při nálezu vysoké závažnosti (`VERDICT: BLOCK`). Pokud CLI chybí, jste offline nebo review selže, jen varuje a push pustí.

**Nouzové přeskočení** (vždy jen výjimečně a s vysvětlením v commitu nebo PR):

```sh
AGENT_REVIEW=0 git push     # přeskočí jen agentické review
LEFTHOOK=0 git commit ...   # přeskočí všechny hooky
```

Beads původně nastavil `core.hooksPath` na `.beads/hooks`. Hooky teď spravuje Lefthook a Beads volá. Kdyby `bd init` nebo `bd hooks install` `core.hooksPath` znovu nastavil, vrátí se to příkazy `git config --unset core.hooksPath && pnpm exec lefthook install`.

## CI (GitHub Actions)

| Workflow                                            | Kdy                               | Co                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)             | push na `main`, PR                | Ubuntu: lint, typecheck, formát, Vitest, Playwright. Windows + macOS: rustfmt, clippy, cargo test, kontrola aktuálnosti `bindings.ts`, debug build aplikace |
| [`security.yml`](../.github/workflows/security.yml) | push na `main`, PR, každé pondělí | Gitleaks (celá historie), Trivy (zranitelnosti závislostí, tajemství, konfigurace), Semgrep (TS, React, Rust, secrets), libyear (jen informativně)          |

Lokální spuštění bezpečnostních nástrojů: Gitleaks (`gitleaks git .`) a Semgrep (`semgrep scan --config p/typescript --config p/react --config p/rust --config p/secrets`). Workflowy se dají zkontrolovat nástrojem [actionlint](https://github.com/rhysd/actionlint).

## Postup práce

Viz [CLAUDE.md](../CLAUDE.md) → Workflow: úkol z `bd ready`, implementace podle `openspec/changes/<změna>`, testy a dokumentace spolu s úkolem, `bd close`. Úkoly „Codex review“ provádí člověk v Codexu.

## Konvence

- Kód, identifikátory a komentáře anglicky. Specifikace a dokumentace česky. Texty UI přes i18n (cs/en/de).
- Konce řádků LF (`.gitattributes`).
- `unsafe` v Rustu je zakázaný mimo `src-tauri/src/platform/` (lint `unsafe_code = "deny"`).
- Styly jen přes design tokeny, viz [design-system.md](design-system.md).
