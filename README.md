# ide-bridge

Cross-IDE context bridge over MCP. Save a structured Portable Context Bundle (PCB) from one agentic IDE (Claude Code, Cursor, Kiro, Antigravity) and resume it in another.

When you hit a usage limit mid-task, switch IDEs and keep your plan, decisions, TODOs, git state, conversation summary, and — where technically possible — the last N verbatim turns. No copy-paste, no re-explaining.

## Install

```bash
pnpm i -g ide-bridge
ide-bridge install-service   # optional: run on login (launchd on macOS, systemd --user on Linux)
ide-bridge start              # foreground
```

## Configure your IDE

In any project root:

```bash
ide-bridge init                     # writes .ide-bridge.yaml (checked in by default)
ide-bridge priming claude-code      # appends bridge section to CLAUDE.md
ide-bridge priming cursor           # writes .cursor/rules/ide-bridge.mdc
ide-bridge priming kiro             # writes .kiro/steering/ide-bridge.md
ide-bridge priming antigravity      # appends to AGENTS.md
```

Point each IDE's MCP config at `http://127.0.0.1:31415/mcp`.

## How it works

| Component | Role |
|---|---|
| Daemon (`src/mcp/server.ts`) | Fastify-backed Streamable HTTP MCP server on `localhost:31415` |
| PCB (`src/pcb/schema.ts`) | Zod-validated Portable Context Bundle format (v0.1) |
| Store (`src/store/`) | File-backed bundle persistence with append-only history |
| Adapters (`src/adapters/`) | Per-IDE extract + import (Claude Code L3, Cursor L2, Kiro L1, Antigravity L1, Generic L0) |
| Identity (`src/identity/`) | 3-tier project resolution: explicit yaml > git remote+branch > path fingerprint |

## Tools exposed

Six MCP tools:
- `save_checkpoint(project_id, source_ide, bundle_patch)` — merge a PCB fragment, 30s debounce
- `load_checkpoint(project_id)` — returns the full PCB
- `append_decision(project_id, text, rationale?)` — append to decisions[]
- `append_todo(project_id, text, status?)` — append to todos[]
- `list_projects()` — list all known projects
- `get_project_id(cwd)` — resolve project identity from a directory

## Scope (v0.1)

Single user, single machine, zero cloud dependency. Storage under `~/.ide-bridge/`.

## Not in v0.1

- Remote sync (`--remote` flag errors)
- Multi-IDE role orchestration (spec schema accommodates it, no behavior)
- Secret redaction
- UI dashboard

See [the design spec](docs/superpowers/specs/2026-04-17-mcp-ide-bridge-design.md) for full details, and [the implementation plan](docs/superpowers/plans/2026-04-17-ide-bridge-v0.1.md) for the task breakdown.

## Testing

```bash
pnpm test        # 60+ tests, unit + integration
pnpm typecheck   # strict TypeScript
pnpm build       # compile to dist/
```

## License

MIT
