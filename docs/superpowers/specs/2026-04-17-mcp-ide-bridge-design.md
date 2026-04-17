# IDE Bridge — Design Spec (v0.1)

**Date:** 2026-04-17
**Status:** Draft for review
**Scope:** v0.1 — "Context portability across agentic IDEs"
**Follow-on scope (v0.2+):** remote sync, self-host, disk-tailer rescue mode
**Future scope (v1.0+):** multi-IDE role orchestration ("team of IDEs")

---

## 1. Problem

A developer working with an agentic IDE (Antigravity, Cursor, Claude Code, Kiro, etc.) hits a per-tool usage limit mid-task. Their plan, decisions, context, and running conversation are trapped inside that IDE. Switching to another IDE means starting over: re-explaining what they wanted, what's already done, what constraints apply. The rest of the day is friction instead of progress.

Teams hit a parallel version: different members prefer different IDEs, but project context (what's been tried, what's been decided, what's half-done) is locked to whichever IDE was used last.

## 2. Goals (v0.1)

A developer working on a single machine, in a single project, under a single OS user, can:

1. **Save a structured "checkpoint"** of their working context from any of the four supported IDEs without manual copying.
2. **Resume** that checkpoint in any other supported IDE and have the next agent turn begin with full knowledge of the plan, decisions, TODOs, git state, rolling summary, and — where technically possible — the last N verbatim conversation turns.
3. **Do so with zero infrastructure setup** — no account, no server, no cloud dependency. `npx` run locally on `localhost`.
4. **Have a forward path** to (a) cross-machine handoff via remote sync (v0.2), (b) managed SaaS (v0.3+), and (c) multi-IDE team orchestration with role routing (v1.0+) *without redesigning the protocol or the data model.*

## 3. Non-Goals (v0.1)

Explicitly out of scope for this release:

- **Multi-IDE role orchestration / agent-to-agent routing.** The PCB schema accommodates it. No behavior ships. Scope B is a separate spec.
- **Remote/cloud sync implementation.** A `--remote <url>` flag exists, errors with "not yet implemented."
- **Background disk-tailer daemon.** (v0.2 "rescue mode.")
- **IDE-specific binary plugins / extensions.** Only config + priming files in v0.1.
- **Authentication, multi-user, team sharing.** Single OS user, single machine. `user_id` field present in schema, unused.
- **Secret redaction and compliance-grade privacy.** v0.1 warns on common secret patterns (API keys, tokens) but performs no redaction or encryption.
- **UI — dashboard, web panel, GUI.** CLI + MCP tools only.
- **Full-fidelity transcript resume for IDEs that don't natively support it.** Kiro and Antigravity get rolling-summary-level fidelity; Cursor gets last-N verbatim turns as a primer (not true resume); only Claude Code's native session resume is preserved end-to-end.

## 4. Architecture Overview

A single local daemon (`ide-bridge`) binds `localhost:31415` by default and speaks MCP over **Streamable HTTP (spec 2025-06-18)**. Every supported IDE connects as an MCP client, reaching the daemon's tool surface via the bridge's `/mcp` endpoint. All persistent state lives on disk under `~/.ide-bridge/`.

```
┌─ Claude Code ─┐   ┌─ Cursor ─┐   ┌─ Kiro ─┐   ┌─ Antigravity ─┐   ┌─ Any MCP IDE ─┐
│ CLAUDE.md     │   │.cursor/  │   │.kiro/   │   │ AGENTS.md     │   │ AGENTS.md     │
│ + Stop hook   │   │  rules/  │   │ steer/  │   │ priming       │   │ (generic)     │
└──────┬────────┘   └────┬─────┘   └───┬─────┘   └───────┬───────┘   └────────┬──────┘
       │ MCP Streamable HTTP           │                  │                    │
       └──────────────────┴────────────┴──────────────────┴────────────────────┘
                                           │
                                 http://localhost:31415/mcp
                                           │
                              ┌────────────▼─────────────┐
                              │  ide-bridge daemon    │
                              │                           │
                              │  Tool surface (6)         │
                              │  Per-IDE adapters         │
                              │  PCB store                │
                              │  Identity resolver        │
                              │  Remote-sync stub (v0.2)  │
                              └────────────┬──────────────┘
                                           │
                            ~/.ide-bridge/
                              projects/<project-id>/
                                bundle.json            PCB (authoritative)
                                history/              append-only checkpoint log
                                transcripts/<ide>/     raw per-IDE transcripts
                                attachments/           large files out-of-band
                              config.json              daemon config
                              daemon.log
```

**Key protocol choices:**

- **MCP Streamable HTTP**, not stdio: supports multi-client concurrency with shared state, SSE for server-initiated messages (foundation for Scope B), and a clean URL-swap upgrade to remote mode.
- **Per-IDE priming files** drive agent behavior: the daemon cannot inject context; the agent must choose to call `load_checkpoint`. Priming files ensure they do.
- **Claude Code uses real lifecycle hooks** (`Stop`, `PostToolUse`) for bulletproof save; other IDEs rely on agent-driven saves from the priming file.
- **File-backed storage** (JSON + append-only history) in v0.1. The data model is explicitly SQL-portable for v0.2 when multi-user arrives.

## 5. The Portable Context Bundle (PCB v0.1)

A single JSON document per project. The IDE-agnostic interchange format.

```json
{
  "pcb_version": "0.1",
  "bundle_id": "01HXYZ...",
  "updated_at": "2026-04-17T14:20:00Z",
  "last_source_ide": "claude-code",
  "user_id": null,
  "project": {
    "id": "acme-api",
    "resolved_from": "explicit",
    "root_path_fingerprint": "sha256:...",
    "git": {
      "remote": "git@github.com:acme/api.git",
      "branch": "feat/billing",
      "head": "a1b2c3d",
      "dirty_files": ["src/billing.ts"],
      "staged_diff": "...",
      "unstaged_diff": "..."
    }
  },
  "instructions": [
    { "id": "agents-md", "scope": "project", "format": "markdown",
      "source_path": "AGENTS.md", "content": "..." },
    { "id": "claude-md", "scope": "project", "format": "markdown",
      "source_path": "CLAUDE.md", "content": "..." }
  ],
  "memories": [
    { "id": "mem_01", "scope": "project", "source": "auto",
      "text": "User prefers Vitest over Jest.",
      "tags": ["testing"], "created_at": "..." }
  ],
  "plan": {
    "summary": "Implementing Stripe webhook handler for billing service.",
    "current_step": "Write signature verification",
    "steps": [
      { "id": "s1", "text": "Scaffold /webhook route", "status": "done" },
      { "id": "s2", "text": "Signature verification", "status": "in_progress" },
      { "id": "s3", "text": "Idempotency check", "status": "pending" }
    ]
  },
  "todos": [
    { "id": "t1", "text": "Add test for replay attack", "status": "pending" }
  ],
  "decisions": [
    { "id": "d1", "at": "...", "text": "Use raw body + HMAC-SHA256",
      "rationale": "Stripe docs require raw body before JSON parsing." }
  ],
  "specs": [
    { "id": "spec_billing", "title": "Billing v2",
      "requirements_md": "...", "design_md": "...", "tasks_md": "..." }
  ],
  "conversation": {
    "fidelity": "L2",
    "summary": "Added /webhook route, now working on HMAC verification. User wants tests first.",
    "summary_through_message": 47,
    "last_n_turns": [
      { "role": "user", "content": [{ "type": "text", "text": "..." }] },
      { "role": "assistant", "content": [{ "type": "text", "text": "..." }] }
    ],
    "source_transcript_uri": "pcb://transcripts/claude-code/session-xyz.jsonl"
  },
  "workspace": {
    "open_files": ["src/webhook.ts"],
    "active_file": "src/webhook.ts",
    "cursor": { "path": "src/webhook.ts", "line": 42, "col": 8 }
  },
  "attachments": [
    { "id": "att_1", "name": "stripe-spec.pdf",
      "uri": "pcb://attachments/att_1", "media_type": "application/pdf" }
  ],
  "capabilities_required": ["instructions", "plan", "conversation.L1"],
  "last_source_capabilities": ["conversation.L3"],
  "metadata": {}
}
```

**Versioning and negotiation.** `pcb_version` plus `capabilities_required` enable LSP-style negotiation: an importer that cannot provide `conversation.L2` degrades to `L1` and emits a warning. No silent data loss.

**Fidelity levels (as agreed):**

- **L0** — plan, decisions, TODOs, git state only. No conversation data.
- **L1** — L0 + rolling summary paragraph.
- **L2** — L1 + last-N verbatim turns (N defaults to 20, capped at 50KB).
- **L3** — full session resume. Only Claude Code in v0.1.

Each IDE declares the fidelity it can *produce* and the fidelity it can *consume*; the bridge picks `min(produce_source, consume_target)`.

## 6. MCP Tool Surface (6 tools)

Intentionally minimal to keep context-window overhead low.

| Tool | Purpose |
|---|---|
| `bridge.save_checkpoint(bundle_patch)` | Merge a PCB fragment into the active project bundle. Idempotent. Debounced to 30s. |
| `bridge.load_checkpoint()` | Returns the active bundle for the current project (identity auto-resolved). |
| `bridge.append_decision(text, rationale?)` | Append to `decisions[]`. Thin wrapper to make agent use natural. |
| `bridge.append_todo(text, status?)` | Append to `todos[]`. |
| `bridge.list_projects()` | Returns all known projects for this OS user (lets agent disambiguate when identity is ambiguous). |
| `bridge.get_project_id()` | Returns the resolved project identity for the current working directory, for diagnostics. |

Every tool accepts an optional `project_id` override. Otherwise the daemon resolves identity from the calling IDE's working-directory hint (sent as a resource URI or tool arg per adapter).

## 7. Project Identity Resolution

On every tool call, the daemon resolves the project key in this order:

1. **Explicit override.** `project_id` tool arg > `.ide-bridge.yaml` committed to repo root (`project_id: my-billing-service`). `.ide-bridge.yaml` is **checked in by default** so the same project ID travels with the repo across machines and teammates; the init command prints a note so users can gitignore it if they'd rather not share.
2. **Git remote + branch.** `(normalize(remote), branch)` if the working dir is a git repo with a remote. `normalize()` strips `.git`, lowercases host, and ignores auth components.
3. **Path fingerprint.** `sha256(realpath(cwd))` as last resort.

First successful resolve is cached to `.ide-bridge/project-id` (local, machine-specific, gitignored) so subsequent calls are instant. The checked-in `.ide-bridge.yaml` always wins over the cache.

## 8. Save / Checkpoint Triggers

- **Claude Code** — `Stop` hook saves the full checkpoint at turn end; `PostToolUse` hook triggers debounced save after any file-modifying tool call. Debounce window: 30 seconds. The hook script shells out to `ide-bridge hook save` (CLI subcommand of the same daemon binary).
- **Cursor, Kiro, Antigravity** — priming file (`.cursor/rules/ide-bridge.mdc` / `.kiro/steering/ide-bridge.md` / `AGENTS.md`) instructs the agent to call `bridge.save_checkpoint` (a) before making file edits, (b) after completing a logical sub-task, (c) when the user says "pause" / "switch IDE" / "handoff", (d) whenever a new plan or decision is written.
- **Generic fallback** — the user drops a generic `AGENTS.md` from `npx @ide-bridge/priming generic`; any MCP-capable IDE whose agent reads it will participate.

The daemon itself enforces a 30s server-side debounce (`saves_per_project_per_30s = 1`) to absorb over-eager agents.

## 9. Per-IDE Adapter Design

Each adapter is a module in the daemon (`/adapters/<ide>.ts`). It implements three methods:

```ts
interface IdeAdapter {
  produce_fidelity: Fidelity;      // max we can extract FROM this IDE
  consume_fidelity: Fidelity;      // max we can deliver TO this IDE
  extract(project_root): Promise<Partial<Pcb>>;
  import_into(project_root, pcb): Promise<ImportReport>;
}
```

Per-IDE capability matrix:

| IDE | Produce max | Consume max | Extract source | Import sink |
|---|---|---|---|---|
| Claude Code | L3 | L3 | `~/.claude/projects/<encoded-cwd>/*.jsonl` | Write bundle JSONL + `claude --resume` |
| Cursor | L2 | L2 | `state.vscdb` under Cursor's workspaceStorage (macOS/Linux/Windows paths resolved per-OS) | Write `.cursor/rules/_imported.mdc` primer + open-file hint |
| Kiro | L1 | L1 | `.kiro/steering/*`, `.kiro/specs/*` | Write into `.kiro/steering/_imported.md` |
| Antigravity | L0-L1 | L0-L1 | `AGENTS.md` + bridge-captured plan/decisions only | Drop `AGENTS.md` with "Prior context" block |
| Generic | L0 | L0 | None (agent-driven saves only) | `AGENTS.md` with "Prior context" block |

Extractors run on demand (when `save_checkpoint` is called) and on daemon startup (detects which IDE's storage exists and pre-warms).

## 10. Daemon Lifecycle

- **Install:** `npm i -g @ide-bridge/cli`. Optional: `brew install ide-bridge`.
- **Start:** `ide-bridge start` (foreground) or auto-started on first `npx @ide-bridge/shim` call.
- **Run as service:** `ide-bridge install-service` writes a `launchd` plist on macOS or a `systemd --user` unit on Linux.
- **Port conflict:** if `:31415` is in use, probe `:31416..31425`; write the chosen port to `~/.ide-bridge/config.json`. Each IDE's MCP config uses a helper URL that reads the file.
- **Stop:** `ide-bridge stop`. Idle auto-shutdown after 30 minutes of zero client activity (opt-in).

The shim is a thin stdio→HTTP proxy so that stdio-only MCP hosts (older Claude Code, some others) still work: they spawn the shim, which talks HTTP to the daemon.

## 11. Forward-Compatibility with v0.2+ and Scope B

The following are *designed for* but *not built in* v0.1:

- **Remote sync (v0.2):** daemon accepts `--remote <url>` and syncs bundles to a remote bridge over the same MCP HTTP protocol. Storage layer is abstracted behind a `BundleStore` interface; file-backed impl ships, Postgres-backed impl comes with v0.2. The PCB's `user_id` field is reserved.
- **Disk-tailer rescue mode (v0.2):** a `ide-bridge watch` subcommand polls `~/.claude/projects/` and Cursor's SQLite for updates and auto-checkpoints. Isolated from the core daemon.
- **Scope B role routing (v1.0+):** PCB carries an optional `roles: { planner: "claude-code@session-xyz", implementer: "kiro@session-abc" }` field and a `handoffs: []` queue, both ignored in v0.1. When Scope B ships, A2A-style task messages ride the same HTTP transport.
- **Managed SaaS (v0.3+):** same protocol, hosted daemon, auth layer. The `Mcp-Session-Id` header in the spec is already the foundation.

## 12. Security Considerations (v0.1)

- **Local only.** Daemon binds `127.0.0.1` exclusively. No remote listeners.
- **Process isolation.** Storage under `~/.ide-bridge/` with `0700` permissions.
- **Secret warnings.** On save, scan `instructions`/`conversation`/`workspace` blobs for common secret patterns (OpenAI `sk-`, AWS `AKIA`, `PRIVATE KEY`, `.env` blobs). Emit a warning to daemon log and annotate the bundle with `metadata.warnings[]`. **Do not redact.**
- **No telemetry** in v0.1. Opt-in crash reporting is v0.2.

Redaction, encryption at rest, and compliance features are explicit v0.2+ work.

## 13. Milestones and Cuts

**v0.1 MVP (target: ~4-5 weeks):**
- Daemon with Streamable HTTP MCP, 6 tools, file-backed PCB store
- Claude Code adapter (L3 produce/consume) + hook scripts
- Cursor adapter (L2 produce/consume)
- Kiro adapter (L1 produce/consume)
- Antigravity adapter (L0-L1 produce/consume)
- Generic AGENTS.md fallback
- Identity resolver with the three-tier priority
- 30s save debounce
- Install script, launchd/systemd unit, CLI
- Docs for each IDE's priming file

**v0.2 (target: ~6-8 weeks after v0.1):**
- Remote sync (Postgres-backed bundle store, HTTP auth tokens)
- Disk-tailer rescue mode
- Secret redaction MVP
- Self-host Docker image

**v0.3+:** managed SaaS, UI, telemetry opt-in, Windsurf / JetBrains / Zed adapters.

**v1.0 (Scope B):** role config YAML, A2A handoff protocol, presence channel, file leases, HITL states.

## 14. Success Criteria (v0.1)

1. User hits their usage limit in Antigravity, opens Cursor, runs one prompt, and the Cursor agent's first reply shows it already knows the plan, the last decision, and the current TODO.
2. Same flow with Claude Code as target IDE preserves not just the summary but the *verbatim last session* (`claude --resume` works).
3. Install to first successful checkpoint save: **≤ 5 minutes for a new user**, **≤ 30 seconds for a repeat user** on a new project.
4. Daemon resident memory ≤ 50MB at idle. Each `save_checkpoint` ≤ 200ms for bundles < 1MB.
5. Adapter code per IDE is ≤ 400 lines — anything longer is a smell.
6. Zero auth, zero cloud, zero network egress (other than opt-in `--remote`).

## 15. Decisions Resolved

1. **Default port: `31415`.** Configurable via `--port` or `~/.ide-bridge/config.json`. Probes `:31416..31425` on conflict.
2. **Daemon / CLI binary name: `ide-bridge`.** npm scope (e.g. `@ide-bridge/cli`) is a publishing-time decision pending scope availability; the binary name is fixed.
3. **`.ide-bridge.yaml` is checked in by default.** The init command tells the user explicitly and offers an `--gitignore` flag for private overrides. Per-user local cache (`.ide-bridge/project-id`) remains gitignored.
4. **Claude Code L3 resume forges a resumable session.** On import, the adapter writes a synthesized JSONL into `~/.claude/projects/<encoded-cwd>/` with a new session ID derived from the bundle, then advertises it via `claude --resume <session-id>` in the post-import message to the user. The adapter annotates forged sessions with a `source_bundle_id` field so CC's own session tracking can treat them as first-class, and ships a regression test that fails if Claude Code's session format changes.
5. **Rolling-summary generation is extractive.** The daemon builds the summary by sampling plan steps, decisions, and last-N turn headers — no LLM dependency. Agents that want a higher-quality summary may override it by passing a `conversation.summary` string in their `save_checkpoint(bundle_patch)` call; the bridge respects the most recent agent-supplied value for 24h before re-extracting.

## 16. Appendix A — Example Priming File (CLAUDE.md snippet)

```markdown
## IDE Bridge

You have access to an MCP server at `bridge.*` that preserves project context across IDEs.

**On session start, call `bridge.load_checkpoint` before doing anything else.** The returned
PCB contains the plan, decisions, TODOs, and recent conversation summary for this project.

**Save a checkpoint:**
- Before making any file edit
- After completing a logical sub-task
- When the user says "pause", "switch IDE", "handoff", or hits a usage limit
- Whenever you append a plan step, TODO, or decision

Use `bridge.append_decision(text, rationale)` for design decisions and
`bridge.append_todo(text)` for TODOs — do not stuff them into the plan.
```

## 17. Appendix B — Example `.ide-bridge.yaml`

```yaml
project_id: acme-billing-service
# Optional overrides:
# identity: { prefer: explicit }
# fidelity: { produce_max: L3, consume_max: L3 }
# exclude_paths: ["node_modules", ".venv", "build"]
```
