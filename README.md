# ide-bridge

Cross-IDE context bridge over MCP. Save a structured Portable Context Bundle (PCB) from one agentic IDE (Claude Code, Cursor, Kiro, Antigravity) and resume it in another with graceful fidelity degradation.

**Status:** v0.1 in development. See [the design spec](docs/superpowers/specs/2026-04-17-mcp-ide-bridge-design.md) and [implementation plan](docs/superpowers/plans/2026-04-17-ide-bridge-v0.1.md).

## Why

Hit a usage limit in one agentic IDE mid-task? Pick up in another IDE with the same plan, decisions, TODOs, git state, conversation summary, and — where technically possible — the last N verbatim turns. No copy-paste, no re-explaining, no lost afternoon.

## Install (once v0.1 ships)

```bash
pnpm i -g ide-bridge
ide-bridge install-service   # optional: run on login
ide-bridge start              # foreground
```

## Configure your IDE

```bash
ide-bridge init                     # writes .ide-bridge.yaml (checked in)
ide-bridge priming claude-code      # adds bridge section to CLAUDE.md
ide-bridge priming cursor           # writes .cursor/rules/ide-bridge.mdc
ide-bridge priming kiro             # writes .kiro/steering/ide-bridge.md
ide-bridge priming antigravity      # writes AGENTS.md
```

Point each IDE's MCP config at `http://127.0.0.1:31415/mcp`.

## License

MIT
