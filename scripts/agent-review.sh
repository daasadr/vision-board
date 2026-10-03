#!/usr/bin/env sh
# Pre-push agentic code + security review of the commits being pushed, via Claude Code CLI.
#
# Blocks the push only when the reviewer reports a high-severity problem (VERDICT: BLOCK).
# Never blocks because the review could not run (no CLI, offline, no base to diff against):
# it warns and lets the push through, so offline work is not held up.
#
# Skip once: AGENT_REVIEW=0 git push   (or LEFTHOOK=0 to skip all hooks)

set -u

if [ "${AGENT_REVIEW:-1}" = "0" ]; then
  echo "agent-review: skipped (AGENT_REVIEW=0)"
  exit 0
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "agent-review: WARNING – Claude Code CLI not found, review skipped." >&2
  echo "agent-review: install it (https://claude.com/claude-code) to enable pre-push review." >&2
  exit 0
fi

# What is being pushed: commits since the upstream, else since main.
if base=$(git rev-parse --verify --quiet '@{upstream}'); then
  :
elif base=$(git rev-parse --verify --quiet origin/main); then
  :
elif [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ] && base=$(git rev-parse --verify --quiet main); then
  :
else
  echo "agent-review: no upstream or main branch to compare against, review skipped." >&2
  exit 0
fi

diff=$(git diff "$base...HEAD" -- . ':(exclude)pnpm-lock.yaml' ':(exclude)src-tauri/Cargo.lock' ':(exclude)src/lib/bindings.ts')
if [ -z "$diff" ]; then
  echo "agent-review: nothing to review."
  exit 0
fi

prompt='You are reviewing a git diff that is about to be pushed to the Vision Board repository
(Tauri 2: Rust + React/TypeScript desktop app; read CLAUDE.md for conventions).

Do two reviews of the diff on stdin, reading surrounding code only when needed:
1. Code review: correctness bugs, broken edge cases, violations of CLAUDE.md conventions.
2. Security review: unsafe Rust / FFI misuse, path traversal, unvalidated input crossing IPC,
   secrets or tokens in code, overly broad Tauri capabilities or CSP, privacy violations
   (activity detection must never read input content).

List findings as "- [HIGH|MEDIUM|LOW] file:line – problem – suggested fix". Report only real,
concrete problems, not style preferences. HIGH means it must not be pushed: a likely bug,
data loss, or a security/privacy issue.

End with exactly one line: "VERDICT: BLOCK" if there is any HIGH finding, else "VERDICT: PASS".'

echo "agent-review: reviewing $(printf '%s\n' "$diff" | grep -c '^diff --git') file(s) since ${base%"${base#???????}"}…"
if ! output=$(printf '%s\n' "$diff" | claude -p "$prompt" --allowedTools "Read,Grep,Glob" 2>&1); then
  echo "agent-review: WARNING – review failed to run, push allowed:" >&2
  printf '%s\n' "$output" | tail -5 >&2
  exit 0
fi

printf '%s\n' "$output"
verdict=$(printf '%s\n' "$output" | grep -E '^VERDICT: (PASS|BLOCK)$' | tail -1)
case "$verdict" in
  "VERDICT: BLOCK")
    echo "agent-review: push blocked by high-severity findings. Fix them, or override with AGENT_REVIEW=0." >&2
    exit 1
    ;;
  "VERDICT: PASS")
    exit 0
    ;;
  *)
    echo "agent-review: WARNING – reviewer gave no verdict, push allowed." >&2
    exit 0
    ;;
esac
