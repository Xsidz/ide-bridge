# ide-bridge

Cross-IDE context portability over MCP. Save a structured checkpoint from one agentic IDE, resume it in another without re-explaining anything.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0--alpha.0-orange.svg)](https://github.com/Xsidz/ide-bridge/releases/tag/v0.1.0-alpha.0)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
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

## Using ide-bridge end to end

This section walks through one full cycle: start the daemon, wire up two IDEs, save a checkpoint in one, resume it in the other. It takes roughly 10 minutes end to end on a fresh install.

### Prerequisites

- Node 22+
- pnpm 10+ (via Corepack: `corepack enable && corepack prepare pnpm@latest --activate`)
- One or more of: Claude Code, Cursor, Kiro, or Antigravity installed
- About 5–10 minutes

### 1. Install and start the daemon

ide-bridge is not yet published to the npm registry. Install from the packed tarball:

```bash
# From the repo root — pack first if you haven't already
pnpm build
pnpm pack
# Installs the binary globally
npm install -g ./ide-bridge-0.1.0-alpha.0.tgz
```

Alternatively, link from the repo checkout so changes take effect immediately:

```bash
pnpm build
pnpm link --global   # run pnpm setup && source ~/.zshrc first if pnpm bin -g isn't on PATH
```

Once installed, start the daemon in the foreground:

```bash
ide-bridge start
```

Expected output:

```
ide-bridge listening on http://127.0.0.1:31415/mcp
```

The daemon stays in the foreground. Press `Ctrl+C` to stop, or run `ide-bridge stop` from another terminal. To have it start automatically with your machine, skip to [Running as a service](#running-as-a-service-optional).

### 2. Initialize the project

Navigate to your project directory, then run:

```bash
cd /path/to/your-project
ide-bridge init
```

This writes `.ide-bridge.yaml` in the project root:

```yaml
project_id: your-project
# checked in by default — share across machines/teammates.
# Pass --gitignore on init or add to .gitignore to keep private.
```

This file is the source of truth for project identity. Every IDE agent that opens a terminal in this directory will resolve to the same `project_id`, which means their checkpoints share the same bundle. Check this file in to your repo so teammates and other machines get the same ID automatically.

If you want to keep the file private (single-user local workflow), use:

```bash
ide-bridge init --gitignore
```

### 3. Prime and wire your source IDE (example: Cursor)

Priming writes a markdown instruction file into a directory the IDE's agent reads on every session start. It tells the agent *how* to use the bridge tools. Without priming the agent doesn't know the tools exist; without MCP config the agent can't reach the daemon even if it knows.

**Step A — generate the priming file:**

```bash
ide-bridge priming cursor
# writes .cursor/rules/ide-bridge.mdc (alwaysApply: true frontmatter)
```

**Step B — configure the MCP server in Cursor:**

Open Cursor's MCP settings. On macOS, edit (or create):

```
~/Library/Application Support/Cursor/User/mcp.json
```

On Linux: `~/.config/Cursor/User/mcp.json`  
On Windows: `%APPDATA%\Cursor\User\mcp.json`

Add the ide-bridge server entry:

```json
{
  "mcpServers": {
    "ide-bridge": {
      "url": "http://127.0.0.1:31415/mcp"
    }
  }
}
```

**Step C — restart Cursor:**

Fully quit and reopen Cursor. In Cursor's MCP panel (Settings → MCP), the `ide-bridge` server should appear with a green connected indicator. If it shows red, verify the daemon is running (`ide-bridge status`) and recheck the JSON path and syntax.

### 4. Save your first checkpoint from Cursor

Priming instructs the agent to save checkpoints automatically, but agents don't always act on priming instructions on their very first turn. To trigger a save explicitly, send this prompt in Cursor chat:

```
Save the current context to the bridge now.
Call bridge.save_checkpoint with source_ide "cursor" and include the current plan,
open decisions, and any todos you know about.
```

The agent should call `bridge.save_checkpoint` and you'll see a tool response similar to:

```json
{
  "saved": true,
  "bundle_id": "bnd_1",
  "updated_at": "2026-04-17T10:23:45.000Z"
}
```

### 5. Verify the checkpoint landed

From any terminal:

```bash
# List all known projects
curl -s -X POST http://127.0.0.1:31415/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}' \
  | jq

# Load the checkpoint for your project
curl -s -X POST http://127.0.0.1:31415/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"load_checkpoint","arguments":{"project_id":"your-project"}}}' \
  | jq
```

You can also inspect the raw bundle file directly:

```bash
cat ~/.ide-bridge/projects/your-project/bundle.json | jq
```

The bundle will contain `plan_steps`, `decisions`, `todos`, `git`, and `conversation.summary` fields populated with whatever the Cursor agent saved.

### 6. Switch to a second IDE (example: Claude Code)

**Step A — generate the priming file:**

```bash
ide-bridge priming claude-code
# appends a bridge section to CLAUDE.md in the project root
```

**Step B — configure the MCP server in Claude Code:**

```bash
claude mcp add ide-bridge http://127.0.0.1:31415/mcp --transport http
```

Or manually add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "ide-bridge": {
      "url": "http://127.0.0.1:31415/mcp",
      "type": "http"
    }
  }
}
```

**Step C — open the project in Claude Code and load the checkpoint:**

Start a new Claude Code session in the same project directory. To trigger the load explicitly:

```
Before we start, call bridge.load_checkpoint to get the project context.
The project_id is in .ide-bridge.yaml — or you can pass it directly: "your-project".
```

Claude Code will call `bridge.load_checkpoint` and return the bundle. It should summarize back:

```
Loaded checkpoint for "your-project" (saved from cursor).
Plan: [steps from the bundle]
Open decisions: [decision list]
Todos: [todo list]
Git: branch main, 3 unstaged changes
```

From this point Claude Code knows everything Cursor knew when it last saved.

### 7. Verify the round-trip

After Claude Code has run at least one `save_checkpoint`, load again and check the `last_source_ide` field:

```bash
curl -s -X POST http://127.0.0.1:31415/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"load_checkpoint","arguments":{"project_id":"your-project"}}}' \
  | jq '.result.bundle.last_source_ide'
# "claude-code"
```

The field should now reflect Claude Code as the most recent saver — confirming the round-trip completed.

---

## Per-IDE setup reference

### Claude Code

- **Priming:** `ide-bridge priming claude-code` — appends an `<!-- ide-bridge:priming -->` block to `CLAUDE.md`. Safe to run multiple times; re-runs are no-ops if the marker is already present.
- **MCP config:** `~/.claude.json` → `mcpServers`, or via:
  ```bash
  claude mcp add ide-bridge http://127.0.0.1:31415/mcp --transport http
  ```
- **Auto-save hooks:** Add to `~/.claude/settings.json` (see [Hooks section](#hooks-claude-code-auto-save)) to trigger `ide-bridge hook save` on every turn boundary.

### Cursor

- **Priming:** `ide-bridge priming cursor` — writes `.cursor/rules/ide-bridge.mdc` with `alwaysApply: true` frontmatter so Cursor injects the instructions into every agent call automatically.
- **MCP config file locations:**
  - macOS: `~/Library/Application Support/Cursor/User/mcp.json`
  - Linux: `~/.config/Cursor/User/mcp.json`
  - Windows: `%APPDATA%\Cursor\User\mcp.json`
- **JSON structure:**
  ```json
  {
    "mcpServers": {
      "ide-bridge": {
        "url": "http://127.0.0.1:31415/mcp"
      }
    }
  }
  ```

### Kiro

- **Priming:** `ide-bridge priming kiro` — writes `.kiro/steering/ide-bridge.md`. Kiro reads all files in `.kiro/steering/` as persistent steering context.
- **MCP config:** Add via the Kiro settings panel (Settings → MCP Servers), or create/edit `.kiro/mcp.json` in the project root:
  ```json
  {
    "mcpServers": {
      "ide-bridge": {
        "url": "http://127.0.0.1:31415/mcp"
      }
    }
  }
  ```

### Antigravity

- **Priming:** `ide-bridge priming antigravity` — prepends a bridge instructions block to `AGENTS.md` (the file Antigravity's agent reads on startup).
- **MCP config:** Check your Antigravity version's settings UI for "MCP Servers" or "Tool servers". Point it at `http://127.0.0.1:31415/mcp`.

### Any other MCP-capable IDE (generic fallback)

- **Priming:** `ide-bridge priming generic` — prepends a bridge instructions block to `AGENTS.md`.
- **MCP config:** Configure the IDE's MCP client to point at `http://127.0.0.1:31415/mcp`. The exact setting name varies by IDE; look for "MCP servers", "tool servers", or "external tools" in its settings.

---

## Claude Code auto-hooks (now automatic on priming)

Running `ide-bridge priming claude-code` also writes `.claude/settings.json` with two hooks:

- **SessionStart** (matcher `startup|resume`) → runs `ide-bridge hook load` which injects the current project's plan, decisions, and todos as context. Every new or resumed Claude Code session starts with the prior state already loaded.
- **PreCompact** → runs `ide-bridge hook save` just before Claude Code compacts the conversation, so the mid-conversation state is persisted before it's lost to compaction summary.

If the daemon isn't running, both hooks exit silently — they never block a session.

To opt out (priming-only, no auto-hooks):

```
ide-bridge priming claude-code --no-hooks
```

The hook commands are keyed so repeat priming never duplicates them; existing unrelated hooks in your `.claude/settings.json` are preserved.

---

## Running as a service (optional)

So the daemon restarts automatically when your machine boots:

```bash
ide-bridge install-service
```

- **macOS:** writes `~/Library/LaunchAgents/com.ide-bridge.daemon.plist`  
  Load immediately with: `launchctl load ~/Library/LaunchAgents/com.ide-bridge.daemon.plist`
- **Linux:** writes `~/.config/systemd/user/ide-bridge.service`  
  Enable and start with: `systemctl --user enable --now ide-bridge.service`

Once the service is running, `ide-bridge start` in a new terminal will print an error saying the daemon is already running — that's expected.

---

## Verifying everything is wired

From any terminal:

```bash
ide-bridge status
# running pid=12345 port=31415

curl -s -X POST http://127.0.0.1:31415/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
# Should list 6 tools:
#   save_checkpoint, load_checkpoint, append_decision,
#   append_todo, list_projects, get_project_id
```

Each IDE's MCP panel should show `ide-bridge` as connected. If it shows disconnected or the tools panel is empty, the IDE cannot reach the daemon — fix the MCP config before worrying about priming.

---

## Troubleshooting

### "command not found: ide-bridge"

The global install didn't reach your PATH.

- If you used `pnpm link --global`: run `pnpm setup && source ~/.zshrc` first to ensure pnpm's global bin directory is on PATH.
- If you used `npm install -g ./<tarball>`: confirm `npm bin -g` prints a path that's on your PATH, e.g. `/usr/local/bin`.

### "Error: kill ESRCH" when running `ide-bridge stop`

Stale config. The daemon's pid file (`~/.ide-bridge/config.json`) points at a process that's already gone. Safe to ignore — the next `ide-bridge start` will overwrite it. To clear it manually:

```bash
rm ~/.ide-bridge/config.json
```

### MCP tool errors with `-32602`

The agent called a tool with a missing required argument. Read the error message — it names the missing argument. Common cases:

- `missing or empty required string arg: project_id` — the agent didn't read `.ide-bridge.yaml`. Tell it explicitly: *"The project_id is `your-project`."*
- `missing or empty required string arg: cwd` — the agent called `bridge.get_project_id()` without the `cwd` argument. Have it skip that tool and use the explicit `project_id` from `.ide-bridge.yaml` instead.

### Checkpoint saved in IDE A but IDE B can't see it

Both IDEs must resolve to the same `project_id`. Verify by running `ide-bridge init` in the project root and checking `.ide-bridge.yaml`. Both IDEs must be opened with their working directory set to that same project root.

### IDE doesn't show the `bridge.*` tools

Priming alone is not enough. Priming tells the agent *how* to use the bridge; the MCP server config in the IDE lets the agent *reach* the bridge. These are independent steps. Verify via the IDE's MCP settings panel — `ide-bridge` must show as connected before any tool call can succeed.

### Fidelity mismatch on handoff

Adapters have different fidelity caps: Claude Code L3, Cursor L2, Kiro L1, Antigravity L1, Generic L0. The daemon picks `min(source_fidelity, target_fidelity)` automatically. Verbatim conversation turns only transfer between IDEs whose caps overlap at L2 or above. See the Supported IDEs matrix above.

---

## Workflow patterns

### "I hit my usage limit mid-task"

1. Open a new agentic IDE session in the same project directory.
2. If priming is already set up, the agent will load the checkpoint on startup (you may need to nudge it: *"Call `bridge.load_checkpoint` first."*).
3. The bundle summary tells the new IDE what the previous IDE was mid-way through — plan steps, open decisions, todos, git state.

### "Multiple teammates on the same repo"

v0.1 is single-user local. The daemon binds to `127.0.0.1` only and there is no sync between machines. For multi-user workflows, wait for v0.2 (remote sync via `--remote <url>`).

### "I want to reset everything"

```bash
ide-bridge stop
rm -rf ~/.ide-bridge
```

All checkpoints, history entries, and daemon config live under `~/.ide-bridge`. Deleting it is a clean slate.

---

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
