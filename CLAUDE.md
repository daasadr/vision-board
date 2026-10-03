# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**

- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.

<!-- END BEADS INTEGRATION -->

## Project

Vision Board: a desktop vision/dream board app (Tauri 2: Rust + React/TypeScript), a gift for Almost-there.eu subscribers.

- Brief: `zadani.txt`. Agreed decisions: `docs/rozhodnuti.md` (take precedence over the brief).
- Specs: `openspec/changes/<change>/` (one change per phase, 0–6). Phases 2–6 have proposal+specs only; design+tasks are written just-in-time (a Beads task exists for that).
- Work items: Beads epics per phase (`bd ready`). Every task references its OpenSpec change.

## Workflow

1. `bd ready` → pick a task → `bd update <id> --claim`.
2. Implement per `openspec/changes/<change>/{specs,design,tasks}.md` (`/opsx:apply <change>`), tick the checkbox in tasks.md.
3. Tests and docs land with the task, not at the end of the phase.
4. `bd close <id>`. When a phase ends, archive the change (`/opsx:archive`) and record learnings for the next phase (`bd remember`).
5. Tasks named "Codex review" are done by the user in Codex. Don't close them yourself.

## Build & Test

```bash
pnpm install          # also installs git hooks (lefthook)
pnpm tauri dev        # run the app
pnpm dev              # frontend only in a browser; /design shows the design system
pnpm lint             # ESLint + Stylelint
pnpm typecheck        # app, tests, configs
pnpm format:check     # Prettier
pnpm test             # Vitest
pnpm e2e              # Playwright against the built frontend with mocked IPC
pnpm rust:fmt && pnpm rust:lint && pnpm rust:test   # rustfmt, clippy -D warnings, cargo test
pnpm bindings         # regenerate src/lib/bindings.ts after changing Rust commands
```

Before finishing a task, run lint, typecheck, test, e2e and the rust:* scripts. Measure memory and CPU in a **release** build, the way `docs/performance.md` describes.

Details: `docs/development.md` (hooks, CI), `docs/testing.md` (test layers, IPC mock, manual checklist), `docs/design-system.md`, `docs/architecture.md`.

## Architecture Overview

- Single Tauri process. Windows (`board`, `control`, `popup`, `wallpaper`, `settings`, `detail`) are created on demand in `src-tauri/src/window_manager.rs` and **destroyed** when closed. No background polling unless a feature that needs it is enabled.
- `src-tauri/src/domain/`: domain logic without Tauri dependencies (tested by `cargo test`). `commands/` is a thin IPC layer; every command is registered in `commands::builder()`. `platform/{windows,macos,linux}.rs` is the only place for OS-specific FFI, and the only place `unsafe` is allowed.
- Frontend calls Rust only through `src/lib/ipc.ts`. It is typed by tauri-specta (`src/lib/bindings.ts`, generated) and mocked in Playwright (`e2e/support/ipc.ts`).
- Frontend: `src/app/<window>/` for window roots, `src/design/` for tokens, themes, fonts and components, `src/i18n/` for locales and formatting.
- Board coordinates are a logical 1920×1080 canvas, scaled to the viewport.
- Premium features go through `Entitlements` (all unlocked until phase 6).

## Conventions & Patterns

- Code, identifiers and comments in English. Specs and project docs in Czech. UI strings in cs/en/de via i18n (never hard-coded).
- Styling: CSS Modules + design tokens only (themes Galerie / Noc). No hard-coded colors, fonts or shadows, and no Tailwind or pre-styled component libraries.
- Privacy: activity detection reads only time since last input and OS "do not disturb / fullscreen" state. Never keystrokes, window titles or screen content. No telemetry, and no network except license activation and updates.
- Lightweight: every new dependency needs a justified size/memory impact (see design.md).
