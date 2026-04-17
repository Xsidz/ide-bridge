# ide-bridge

Cross-IDE context portability over MCP. Save a structured checkpoint from one agentic IDE, resume it in another without re-explaining anything.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0--alpha.0-orange.svg)](https://github.com/Xsidz/ide-bridge/releases/tag/v0.1.0-alpha.0)
[![Node](https://img.shields.io/badge/node-%3E%3D20.10.0-brightgreen.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-61%20passing-brightgreen.svg)](tests/)

> **ide-bridge** runs a local MCP daemon that stores a Portable Context Bundle (PCB) per project — your plan, decisions, TODOs, git state, and conversation summary — and exposes six MCP tools. Any supported IDE can save to or load from the bundle. When you switch IDEs, the next agent turn starts already knowing what you were doing and why.

---

## The problem

Agentic IDEs impose per-tool or per-session usage limits. When you hit one mid-task — branch half-refactored, plan half-executed — you have two options: wait, or switch. Switching means opening a different IDE and spending the first several turns re-explaining the plan, the constraints, the decisions already made, and the work already done. None of that information has anywhere to live except inside a single IDE's conversation history.

The context loss compounds. The rolling summary in your head is lossy. You forget to mention the decision you made three hours ago that rules out the obvious approach. The new agent re-proposes it. You spend another exchange saying no, and explaining why, again.

This is a single-user problem today. It is also a team problem in its near-future form: different engineers on the same project prefer different IDEs, and project context — what has been tried, what has been decided, what is in progress — accumulates only in whichever IDE was used last. Sharing it means copy-paste and luck.

## The solution

ide-bridge is a local daemon that speaks [MCP Streamable HTTP](https://spec.modelcontextprotocol.io) and binds exclusively to `localhost:31415`. Every connected IDE addresses the same six-tool surface. When an agent calls `save_checkpoint`, the daemon merges the incoming bundle fragment into a Portable Context Bundle (PCB) stored under `~/.ide-bridge/projects/<project-id>/`. When another agent calls `load_checkpoint`, it gets that bundle back — fidelity matched to what the target IDE can consume.

The PCB is a single versioned JSON document: plan steps, decisions with rationale, TODOs, git state (remote, branch, HEAD, staged and unstaged diffs), a rolling conversation summary, and — where the source IDE supports it — the last N verbatim turns. Five per-IDE adapters handle the structural differences between IDEs; a generic fallback covers any MCP-capable IDE not explicitly listed.

```
┌─ Claude Code ─┐  ┌─ Cursor ─┐  ┌─ Kiro ─┐  ┌─ Antigravity ─┐  ┌─ Any MCP IDE ─┐
│  CLAUDE.md    │  │ .cursor/ │  │ .kiro/ │  │   AGENTS.md   │  │   AGENTS.md   │
│  Stop hook    │  │  rules/  │  │ steer/ │  │   priming     │  │  (generic)    │
└──────┬────────┘  └────┬─────┘  └───┬────┘  └───────┬───────┘  └───────┬───────┘
       │          MCP Streamable HTTP │               │                  │
       └──────────────────────────────┴───────────────┴──────────────────┘
                                      │
                           http://localhost:31415/mcp
                                      │
                         ┌────────────▼────────────┐
                         │     ide-bridge daemon    │
                         │                          │
                         │  6-tool MCP surface      │
                         │  Per-IDE adapters        │
                         │  PCB store               │
                         │  Identity resolver       │
                         └────────────┬─────────────┘
                                      │
                         ~/.ide-bridge/
                           projects/<project-id>/
                             bundle.json        ← PCB (authoritative)
                             history/           ← append-only log
                             transcripts/<ide>/ ← raw per-IDE transcripts
                           config.json
                           daemon.log
```

Project identity is resolved in order: explicit `project_id` in `.ide-bridge.yaml` → git remote + branch → path fingerprint. The resolved ID is cached locally; the checked-in `.ide-bridge.yaml` always wins.

## Features

- Zero cloud, zero auth, zero network egress — daemon binds `127.0.0.1` only
- 5 native IDE adapters with per-adapter fidelity levels (L0–L3); graceful degradation when source and target differ
- 6-tool MCP surface — intentionally minimal to keep context-window overhead low
- Atomic file-backed PCB store with append-only history log
- Hook-driven autosave for Claude Code (`Stop` + `PostToolUse` hooks); priming-file autosave for all other IDEs
- 3-tier project identity resolver: explicit yaml > git remote+branch > path fingerprint
- `launchd` (macOS) and `systemd --user` (Linux) service installers
- Port conflict resolution: probes `:31416`–`:31425` automatically if `:31415` is taken
- TypeScript strict mode throughout (`noUncheckedIndexedAccess` enabled)
- 61 passing tests, typecheck clean, no dead code

## Supported IDEs

| IDE | Fidelity | Extract source | Import sink |
|---|---|---|---|
| Claude Code | L3 (full session resume) | `~/.claude/projects/<encoded-cwd>/*.jsonl` | Synthesized JSONL + `claude --resume` |
| Cursor | L2 (last-N verbatim turns) | `state.vscdb` in Cursor's workspaceStorage | `.cursor/rules/_imported.mdc` primer |
| Kiro | L1 (rolling summary) | `.kiro/steering/*`, `.kiro/specs/*` | `.kiro/steering/_imported.md` |
| Antigravity | L0–L1 | `AGENTS.md` + bridge-captured plan/decisions | `AGENTS.md` with "Prior context" block |
| Generic | L0 (plan + decisions + TODOs + git) | Agent-driven saves only | `AGENTS.md` with "Prior context" block |

Any MCP-capable IDE not listed above gets the generic L0 adapter for free via a priming `AGENTS.md`.

**Fidelity levels:** L0 = plan, decisions, TODOs, git state. L1 = L0 + rolling summary. L2 = L1 + last-N verbatim turns. L3 = full session resume. The daemon picks `min(produce_source, consume_target)` automatically.

## Installation

```bash
# Install globally
pnpm i -g ide-bridge
# or
npm i -g ide-bridge

# Start the daemon (foreground)
ide-bridge start

# Optional: install as a login service (launchd on macOS, systemd --user on Linux)
ide-bridge install-service
```

## Quickstart

**1. Start the daemon** (or rely on the service if you ran `install-service`):

```bash
ide-bridge start
```

**2. In your project root**, initialize and generate priming files:

```bash
ide-bridge init                      # writes .ide-bridge.yaml
ide-bridge priming claude-code       # appends bridge section to CLAUDE.md
ide-bridge priming cursor            # writes .cursor/rules/ide-bridge.mdc
ide-bridge priming kiro              # writes .kiro/steering/ide-bridge.md
ide-bridge priming antigravity       # appends to AGENTS.md
```

**3. Point each IDE's MCP config** at the daemon:

```json
{
  "mcpServers": {
    "ide-bridge": {
      "url": "http://127.0.0.1:31415/mcp"
    }
  }
}
```

**4. Confirm everything is connected:**

```bash
ide-bridge status
```

From this point, the priming files instruct each IDE's agent to call `bridge.load_checkpoint` at session start and `bridge.save_checkpoint` before edits, after sub-tasks, and on handoff.

## MCP tool reference

| Tool | Arguments | Returns | Description |
|---|---|---|---|
| `save_checkpoint` | `project_id?`, `source_ide`, `bundle_patch` | `{ ok, bundle_id }` | Merge a PCB fragment into the active bundle. Idempotent; 30s server-side debounce. |
| `load_checkpoint` | `project_id?` | Full PCB JSON | Return the current bundle for the resolved project. |
| `append_decision` | `project_id?`, `text`, `rationale?` | `{ ok, decision_id }` | Append an entry to `decisions[]`. |
| `append_todo` | `project_id?`, `text`, `status?` | `{ ok, todo_id }` | Append an entry to `todos[]`. |
| `list_projects` | — | Array of project summaries | List all projects known to this daemon instance. |
| `get_project_id` | `cwd` | `{ project_id, resolved_from }` | Resolve project identity for a directory — useful for diagnostics. |

All tools accept an optional `project_id` override. Without it, identity is auto-resolved from the calling IDE's working-directory hint.

## Configuration

`.ide-bridge.yaml` (checked in by default — it carries the stable `project_id` across machines):

```yaml
project_id: acme-billing-service
# Optional overrides:
# identity:
#   prefer: explicit          # explicit | git | path
# fidelity:
#   produce_max: L3
#   consume_max: L3
# exclude_paths:
#   - node_modules
#   - .venv
#   - build
```

**Environment overrides:**

| Variable | Default | Purpose |
|---|---|---|
| `IDE_BRIDGE_HOME` | `~/.ide-bridge` | Storage root |
| `IDE_BRIDGE_CURSOR_STORAGE` | OS-default workspaceStorage path | Cursor SQLite location |

**Default port:** `31415`. On conflict, the daemon probes `31416`–`31425` and writes the chosen port to `~/.ide-bridge/config.json`.

## How it works

On `save_checkpoint`, the daemon:

1. Resolves `project_id` from the tool arg → `.ide-bridge.yaml` → git remote+branch → path fingerprint
2. Loads or creates the bundle at `~/.ide-bridge/projects/<project-id>/bundle.json`
3. Merges the incoming PCB fragment (deep merge, arrays appended, decisions/todos deduplicated by ID)
4. Extracts a rolling summary from plan steps, decisions, and last-N turn headers (no LLM dependency)
5. Persists atomically via a write-then-rename to avoid partial reads
6. Appends a timestamped entry to `history/`

On `load_checkpoint`, the daemon reads the authoritative bundle and returns it. The calling adapter's `consume_fidelity` determines which fields are included.

On `extract` (adapter-specific), the adapter reads the IDE's native storage (JSONL files, SQLite, steering files) and populates the PCB fields it has access to. On `import_into`, it writes the IDE-specific priming artifact from the PCB.

## Project statistics

| Metric | Value |
|---|---|
| Language | TypeScript — strict mode, `noUncheckedIndexedAccess` |
| Source | 946 LOC across 30 files (`src/`) |
| Tests | 749 LOC across 22 files — 61 cases, all passing |
| Merged PRs | 23 |
| Commits on main | 24 |
| Supported IDEs | 5 native adapters + generic fallback |
| MCP tools | 6 |
| Runtime dependencies | 6: fastify, zod, commander, simple-git, better-sqlite3, pino |
| Build | pnpm + tsc + vitest; typecheck clean; dead-code audit passes |
| First release | v0.1.0-alpha.0 — 2026-04-17 |

## Roadmap

**v0.1 (shipped)**
Context portability across Claude Code, Cursor, Kiro, Antigravity, and the generic fallback. Local-only, zero auth. CLI, priming files, and launchd/systemd installers.

**v0.1.x**
Cursor per-database resilience (multiple workspaceStorage DBs). `initialize` tool coverage. L3 forged-resume verification test. `negotiateFidelity` wiring between adapters.

**v0.2**
Remote sync (`--remote <url>` flag, Postgres-backed bundle store). Disk-tailer rescue mode (`ide-bridge watch` polls `~/.claude/projects/` and Cursor SQLite). Secret redaction MVP. Self-host Docker image.

**v0.3+**
Managed SaaS with hosted daemon and auth layer. UI dashboard. Windsurf, JetBrains, Zed, and VS Code adapters. Opt-in telemetry.

**v1.0**
Multi-IDE role orchestration over A2A. CrewAI-style YAML role config (`planner: claude-code`, `implementer: kiro`). Presence channel, file leases, HITL states.

## Development

```bash
git clone https://github.com/Xsidz/ide-bridge
cd ide-bridge
pnpm install
pnpm test         # 61 tests (unit + integration)
pnpm typecheck    # strict TypeScript
pnpm build        # compiles to dist/
pnpm dev          # runs src/index.ts via tsx
```

### Project layout

```
src/
  index.ts                  entry point — CLI arg dispatch
  daemon.ts                 daemon start/stop/lifecycle
  debounce.ts               30s save debounce
  adapters/
    claude_code.ts          L3 extract + import (JSONL, session forge)
    cursor.ts               L2 extract + import (SQLite, mdc primer)
    kiro.ts                 L1 extract + import (steering files)
    antigravity.ts          L0-L1 extract + import (AGENTS.md)
    generic.ts              L0 fallback (AGENTS.md)
    types.ts                IdeAdapter interface + Fidelity enum
  cli/
    hook.ts                 `ide-bridge hook save` (called from CC hooks)
    init.ts                 writes .ide-bridge.yaml
    install_service.ts      launchd / systemd unit generation
    priming.ts              priming file generation dispatch
    start.ts                foreground daemon start
    status.ts               connectivity check
    stop.ts                 daemon shutdown
  identity/
    resolver.ts             3-tier project ID resolution
    git.ts                  git remote + branch helpers
  mcp/
    server.ts               Fastify + MCP Streamable HTTP server
    tools.ts                6 tool registrations
  pcb/
    schema.ts               Zod PCB schema (v0.1)
    merge.ts                deep merge + deduplication
    summary.ts              extractive rolling-summary generator
  priming/
    generator.ts            per-IDE priming file content
    templates/              per-IDE markdown templates
  store/
    file_store.ts           atomic JSON read/write + rename
    history.ts              append-only history log
    types.ts                BundleStore interface
  util/
    log.ts                  pino logger
    paths.ts                XDG / OS path helpers
    port.ts                 port probe logic

tests/
  unit/
    adapters/               per-adapter unit tests (6 files)
    debounce.test.ts
    hook.test.ts
    identity.git.test.ts
    identity.resolver.test.ts
    install_service.test.ts
    mcp.tools.test.ts
    paths.test.ts
    pcb.merge.test.ts
    pcb.schema.test.ts
    pcb.summary.test.ts
    priming.test.ts
    smoke.test.ts
    store.file.test.ts
  integration/
    cli.test.ts
    e2e_handoff.test.ts     end-to-end save → load across two IDE adapters
    mcp_server.test.ts
  fixtures/
    claude_code_session.jsonl

docs/
  superpowers/
    specs/                  design spec (v0.1)
    plans/                  22-task implementation plan
```

## Design docs

- [Full design spec](docs/superpowers/specs/2026-04-17-mcp-ide-bridge-design.md)
- [22-task implementation plan](docs/superpowers/plans/2026-04-17-ide-bridge-v0.1.md)

## Contributing

Fork the repo, create a branch, make your change with tests, open a PR against `main`. All PRs are reviewed against the design spec and general code quality — if you are adding behavior not covered by the spec, open an issue first.

v0.1 is alpha software. The PCB schema, tool signatures, and storage layout are not yet stable; breaking changes before v1.0 are expected and will be documented in release notes.

Bug reports and feature requests: [https://github.com/Xsidz/ide-bridge/issues](https://github.com/Xsidz/ide-bridge/issues)

## License

MIT. See [LICENSE](LICENSE).
