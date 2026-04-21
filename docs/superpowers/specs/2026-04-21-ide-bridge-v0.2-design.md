# IDE Bridge — Design Spec (v0.2)

**Date:** 2026-04-21
**Status:** Draft for review
**Scope:** v0.2 — "Remote sync, autosave rescue, secret redaction, Docker self-host"
**Follow-on scope (v0.3):** managed SaaS, multi-user, teams, orgs, per-project ACLs, Web UI, billing, audit log
**Future scope (v1.0+):** multi-IDE role orchestration ("team of IDEs"), A2A handoff, real-time SSE push

---

## 1. Problem

v0.1 solved context portability on a single machine. The natural next friction is: the context leaves when the machine does.

Four user stories that v0.1 cannot address:

1. **"I work on two machines."** Developer's gaming rig is their primary dev box at home; their ThinkPad travels with them. Every laptop session starts with re-narrating what the home machine's Claude Code session already knows. The PCB lives under `~/.ide-bridge/` and won't move itself.

2. **"I hit a context limit on my laptop and I need to finish on the desktop."** The user has a v0.1 PCB saved locally. They sit down at another machine. `ide-bridge load_checkpoint` finds nothing — the bundle is on the laptop. They lose thirty minutes reconstructing intent.

3. **"I want to self-host inside my company network."** A team of one (or two) developers at a company with strict data-residency requirements cannot use a public SaaS relay. They need to run the server themselves, pointed at their own Postgres, behind their own firewall. v0.1 has no server mode.

4. **"An agent crashed without calling `save_checkpoint` and I lost two hours of decisions."** The Claude Code daemon was `kill -9`'d. No `Stop` hook fired. The priming file says "call `save_checkpoint` often" but the agent forgot. The PCB on disk is two hours stale. A background autosave loop that periodically harvests the IDE's own storage would have caught this.

## 2. Goals (v0.2)

1. **Remote sync.** A user can push their PCB to a self-hosted `ide-bridge serve` instance over HTTPS. Pull is manual; push is automatic on every save.
2. **Multi-machine.** A user can run `ide-bridge pull [project_id]` on a second machine and resume where the first left off.
3. **2-minute local autosave.** A background loop extracts context from all projects touched in the last 24 hours and saves — even if the agent never called `save_checkpoint`. Always on in `start`, opt-out via `--no-autosave`.
4. **Secret redaction.** Six credential patterns are detected and replaced with `[REDACTED:<pattern>]` before any write to local store or remote. Configurable. No secret ever leaves the machine in cleartext.
5. **Docker self-host.** A single-command `docker compose up` spins up the remote server with Postgres 16. CI publishes `xsidz/ide-bridge:0.2.0-alpha.0` on every tag push.
6. **Backward compatibility.** All v0.1 tests pass. v0.1 PCBs auto-upgrade to v0.2 schema on first daemon start. v0.1 clients talking to a v0.2 local daemon see no behavioral difference.

## 3. Non-Goals (v0.2)

Explicitly deferred:

- **Multi-user and teams.** `users` and `org_members` tables exist in the schema; only single-user semantics are enforced. Per-project ACLs, team sharing, invite flows: v0.3.
- **Organizations and org-level config.** `orgs` table is reserved; no API endpoints touch it in v0.2.
- **Web UI or dashboard.** CLI + MCP tools only.
- **OAuth / social login.** API token only. OAuth as an alternative grant: v0.3.
- **SSE / real-time server-to-client push.** Cross-device push is a pull model in v0.2. SSE streaming: deferred to v1.0.
- **Billing and quotas.** No concept of paid tiers, rate limiting by account, or usage metering.
- **Audit log API.** The server logs writes to its own stdout/file; no queryable audit endpoint.
- **Bundle version history on the remote.** Server stores exactly one bundle per project (latest). Retention/history: v0.3.
- **Windsurf / JetBrains / Zed adapters.** The adapter matrix from v0.1 is unchanged in v0.2.

## 4. Architecture Overview

The same binary, new modes. `ide-bridge start` now optionally enables a **RemoteSyncer** worker and an **AutoSaveLoop** worker. `ide-bridge serve` runs the same Fastify app with a `PostgresBundleStore` instead of the file-backed store.

```
  MACHINE A (laptop)                           MACHINE B (desktop)
  ─────────────────────────────                ─────────────────────────────
  ┌─ Claude Code ─┐  ┌─ Cursor ─┐             ┌─ Claude Code ─┐
  └──────┬────────┘  └────┬─────┘             └──────┬────────┘
         │  MCP Streamable HTTP                       │  MCP Streamable HTTP
         └──────────┬──────────┘                      │
                    │                                  │
       ┌────────────▼──────────────┐     ┌────────────▼──────────────┐
       │  ide-bridge start         │     │  ide-bridge start         │
       │  (daemon + workers)       │     │  (daemon + workers)       │
       │                           │     │                           │
       │  FileBundleStore          │     │  FileBundleStore          │
       │  AutoSaveLoop (2 min)     │     │  AutoSaveLoop (2 min)     │
       │  RemoteSyncer ────────────┼──PUSH─▶                         │
       │  Debouncer (30s)          │     │  RemoteSyncer             │
       └───────────────────────────┘     └────────────┬──────────────┘
                    │                                  │ PULL (manual)
                    │  PUSH (async, HTTPS)             │
                    │                                  │
                    └──────────────┬───────────────────┘
                                   │
                      ┌────────────▼──────────────────┐
                      │  ide-bridge serve             │
                      │  (remote mode)                │
                      │                               │
                      │  Fastify app (shared)         │
                      │  PostgresBundleStore           │
                      │  Token auth middleware         │
                      │  /healthz                     │
                      └────────────┬──────────────────┘
                                   │
                              Postgres 16
                         (bundles, users, tokens)
```

**Components:**

- **FileBundleStore** — unchanged from v0.1. Authoritative local store under `~/.ide-bridge/projects/<project-id>/bundle.json`.
- **PostgresBundleStore** — implements the same `BundleStore` interface. Reads/writes to `bundles` table via `pg` client. Used only by `ide-bridge serve`.
- **RemoteSyncer** — background worker started by `ide-bridge start --remote <url>`. Subscribes to the store's `afterSave` event; debounce triggers a push via the sync wire protocol (§8). Queues pushes in memory when offline; drains on reconnect with exponential backoff (base 5s, max 5min).
- **AutoSaveLoop** — background worker in the local daemon. Runs every 120 seconds. Iterates projects touched in the last 24 hours, runs each project's IDE adapter's `extract()`, merges the result into the existing bundle via `mergePatch`, and calls `store.save()`. If RemoteSyncer is active, the save event propagates automatically.
- **Debouncer** — unchanged 30s server-side debounce from v0.1. AutoSaveLoop calls skip the Debouncer (they are already cadenced); agent-driven `save_checkpoint` calls go through it as before.
- **Token auth middleware** — validates the `Authorization: Bearer <token>` header on every `serve` route by comparing `sha256(token)` against `tokens.token_hash` in Postgres.

## 5. PCB v0.2 Schema Changes

v0.2 adds four fields to the top-level PCB document. All new fields are optional with defaults, so v0.1 bundles are valid v0.2 bundles. On first `ide-bridge start` after upgrading, the daemon reads each existing bundle and writes back a v0.2-upgraded copy with the new fields populated.

**New fields (TypeScript / zod shape):**

```ts
// Added to the top-level PCB object (all new, all optional with defaults)

pcb_version: z.literal("0.2"),               // was "0.1"

device_id: z.string().uuid(),
// Stable UUID for this machine, generated on first `ide-bridge start`
// and persisted in ~/.ide-bridge/config.json. Never changes after creation.

version_vector: z.record(z.string().uuid(), z.number().int().nonnegative()),
// { "<device_id>": <monotonic counter> }
// Each device increments its own counter on every successful save.
// Example: { "a1b2...": 14, "c3d4...": 7 }
// Used for conflict detection. Remote stores the vector it last accepted.

server_updated_at: z.string().datetime().nullable().default(null),
// ISO-8601 timestamp set by the remote server on every successful push.
// null on bundles that have never been pushed.
// Used as the ETag cursor in If-Match / 409 concurrency checks.

user_id: z.string().uuid().nullable().default(null),
// Populated by the remote server on first push from the authenticated token's
// owning user row. null on purely local bundles.
// Reserved for v0.3 multi-user; no local-mode semantics depend on it.
```

**Backward-compat note.** A v0.2 daemon reading a v0.1 bundle finds `pcb_version: "0.1"` and promotes it: generates a `device_id` (or reads it from `config.json`), sets `version_vector: { "<device_id>": 0 }`, sets `server_updated_at: null`, sets `user_id: null`, and rewrites `pcb_version` to `"0.2"`. The upgrade is idempotent and logged at `info` level.

**Full PCB shape reference.** All v0.1 fields are unchanged. The fields above are inserted between `user_id` and `project` in the JSON document for readability, but field order is never load-bearing.

## 6. Postgres Schema

Migration files live at `src/server/migrations/`. The server runs them on startup via a lightweight sequential migrator (no ORM dependency — raw SQL + a `schema_migrations` table).

```sql
-- 001_initial.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Single-user semantics in v0.2: every push creates at most one user row
-- (identified by token). Multi-user join logic ships in v0.3.
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tokens ──────────────────────────────────────────────────────────────────
CREATE TABLE tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    CHAR(64) NOT NULL UNIQUE,   -- sha256(raw_token) hex-encoded
  label         TEXT NOT NULL DEFAULT '',    -- human label set at creation
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ                 -- NULL = active
);

CREATE INDEX tokens_user_id_idx ON tokens(user_id);
CREATE INDEX tokens_hash_idx    ON tokens(token_hash) WHERE revoked_at IS NULL;

-- ─── Bundles ─────────────────────────────────────────────────────────────────
-- One row per project per user. server_updated_at is the ETag cursor.
CREATE TABLE bundles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL,         -- matches PCB project.id
  bundle              JSONB NOT NULL,        -- full PCB document
  version_vector      JSONB NOT NULL DEFAULT '{}',
  server_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bundles_user_project_idx ON bundles(user_id, project_id);
CREATE INDEX        bundles_user_id_idx      ON bundles(user_id);
CREATE INDEX        bundles_updated_idx      ON bundles(server_updated_at DESC);

-- ─── Reserved for v0.3 ───────────────────────────────────────────────────────
-- These tables are created now so v0.3 can add FKs against them without
-- needing a destructive migration. No v0.2 code reads or writes them.

CREATE TABLE orgs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id      UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
```

## 7. Sync Wire Protocol

All sync endpoints are under `/v2/` on the remote server. v0.1 local-only paths (`/mcp`, etc.) are untouched.

**Auth header (all endpoints):**
```
Authorization: Bearer <raw_token>
```

The server middleware validates `sha256(raw_token)` against `tokens.token_hash` and rejects with `401` if no active token matches.

---

### 7.1 Push a bundle

```
PUT /v2/bundles/:project_id
```

**Request headers:**
```
Authorization: Bearer <raw_token>
Content-Type: application/json
If-Match: "<server_updated_at_cursor>"
```

`If-Match` value is the `server_updated_at` from the last successful push (ISO-8601 in quotes, as an ETag). Omit on first push.

**Request body:**
```json
{
  "bundle": { /* full PCB document, pcb_version: "0.2" */ },
  "version_vector": { "a1b2c3d4-...": 14 }
}
```

**Responses:**

`200 OK` — push accepted. Body:
```json
{
  "server_updated_at": "2026-04-21T10:31:00.000Z",
  "version_vector": { "a1b2c3d4-...": 14 }
}
```
Client writes the returned `server_updated_at` back into its local bundle.

`409 Conflict` — the remote's `server_updated_at` does not match the `If-Match` cursor, meaning another device pushed since the client last pulled. Body:
```json
{
  "error": "conflict",
  "remote_updated_at": "2026-04-21T10:29:45.123Z",
  "remote_version_vector": { "a1b2c3d4-...": 13, "c3d4e5f6-...": 2 }
}
```
The client logs a structured warning and surfaces it to the user via `ide-bridge status`:
```
[ide-bridge] CONFLICT: project "acme-billing-service" was updated remotely at 10:29:45.
Run `ide-bridge pull acme-billing-service` to review and merge.
```
The client does NOT auto-overwrite. It queues no further pushes for this project until the user resolves via pull.

`401 Unauthorized` — invalid or revoked token.
`413 Payload Too Large` — bundle exceeds 5MB compressed. (Server rejects; client should strip `conversation.last_n_turns` and retry with `fidelity: L1`.)

---

### 7.2 Pull a bundle

```
GET /v2/bundles/:project_id
```

**Response `200 OK`:**
```json
{
  "bundle": { /* full PCB document */ },
  "server_updated_at": "2026-04-21T10:31:00.000Z",
  "version_vector": { "a1b2c3d4-...": 14 }
}
```

`404 Not Found` — project has never been pushed from this account.

---

### 7.3 List projects

```
GET /v2/bundles
```

**Response `200 OK`:**
```json
{
  "projects": [
    {
      "project_id": "acme-billing-service",
      "server_updated_at": "2026-04-21T10:31:00.000Z",
      "version_vector": { "a1b2c3d4-...": 14 }
    },
    {
      "project_id": "personal-site",
      "server_updated_at": "2026-04-20T08:15:00.000Z",
      "version_vector": { "c3d4e5f6-...": 3 }
    }
  ]
}
```

---

### 7.4 Concurrency semantics summary

| Scenario | Client action | Server response |
|---|---|---|
| First push | No `If-Match` | `200`, sets `server_updated_at` |
| Normal push, cursor matches | `If-Match: "2026-04-21T..."` | `200`, advances cursor |
| Stale push, cursor mismatch | `If-Match: "2026-04-21T..."` | `409 Conflict` |
| No remote entry for project | No `If-Match` | `200`, creates row |

## 8. Authentication

### 8.1 CLI login flow

```
ide-bridge login https://bridge.example.com
```

1. Daemon generates a one-time `state` UUID and a `redirect_uri` of `http://127.0.0.1:0/callback` (OS picks the ephemeral port).
2. Daemon spins up a local HTTP server on that port, waiting for the callback.
3. Daemon opens the browser to `https://bridge.example.com/tokens/new?state=<uuid>&redirect_uri=<encoded>`.
4. User approves token creation in the browser (no OAuth flow — this is the server's own `/tokens/new` UI page). Server generates a raw token, stores `sha256(raw_token)` in `tokens.token_hash`, and redirects to `redirect_uri?token=<raw_token>&state=<uuid>`.
5. Local server receives the redirect, validates the `state` UUID, writes credentials:

```json
// ~/.ide-bridge/credentials.json  (mode 0o600)
{
  "remote_url": "https://bridge.example.com",
  "token": "<raw_token>",
  "created_at": "2026-04-21T10:00:00.000Z"
}
```

6. Local server shuts down. CLI prints: `Logged in to https://bridge.example.com`.

The daemon reads `credentials.json` on startup and on `SIGHUP`. No keychain integration in v0.2; `credentials.json` at mode `0o600` is the security boundary.

### 8.2 Token storage — server side

- Raw token is never stored. Only `sha256(raw_token)` hex (64 chars) in `tokens.token_hash`.
- Token revocation: `DELETE /v2/tokens/:id` (or `ide-bridge logout`). Sets `tokens.revoked_at = now()`. The partial index `WHERE revoked_at IS NULL` keeps auth lookups fast.
- Token labels: set at creation via the `/tokens/new` UI (`label` column). Shown in `ide-bridge tokens list`.

### 8.3 Token revocation CLI

```
ide-bridge logout              # revokes the current token, deletes credentials.json
ide-bridge tokens list         # lists tokens from the remote (id, label, last_used_at)
ide-bridge tokens revoke <id>  # revokes a specific token by ID
```

## 9. Local Autosave Loop

### 9.1 Algorithm

The **AutoSaveLoop** starts as a worker inside the local daemon when `ide-bridge start` runs (unless `--no-autosave` is passed). It fires on a fixed 120-second cadence using `setInterval`.

Each tick:

1. Read `~/.ide-bridge/projects/` to enumerate all known project directories.
2. Filter to projects where `bundle.json` has `updated_at` within the last 24 hours. Projects idle for more than 24 hours are skipped — the loop is rescue-oriented, not archival.
3. For each qualifying project, determine the active IDE by inspecting `bundle.last_source_ide`.
4. Call `adapter.extract(project.root_path)` for that IDE's adapter. This is the same `extract()` already used by `save_checkpoint` — no new code path.
5. Merge the extracted partial PCB into the existing bundle using `mergePatch` (RFC 7396 semantics). Fields explicitly set to `null` by the extractor clear the corresponding bundle field; fields absent from the extraction result are left unchanged.
6. Call `store.save(bundle)`. This bypasses the Debouncer — the loop is already cadenced. The save increments the bundle's `version_vector` counter for this device.
7. If RemoteSyncer is active, the `afterSave` event fires and enqueues a push automatically.

### 9.2 When the loop skips a project

The loop does NOT save a project if:

- The extractor returns an empty object (`{}`). Interpreting silence as "nothing changed" avoids writing spurious timestamps.
- The extractor throws. The error is logged at `warn` level; the loop continues to the next project. A project that fails three consecutive ticks is suppressed for 10 minutes and emits a `warn` log.
- The project is locked because a conflict is pending resolution (the RemoteSyncer set a `conflict_pending` flag). The loop skips it entirely until the user runs `ide-bridge pull`.

### 9.3 Interaction with the Debouncer

Agent-driven `save_checkpoint` calls still go through the 30-second Debouncer. AutoSaveLoop calls bypass it. This means the loop can write at most once every 120 seconds per project regardless of agent activity. The two writers share the same `store.save()` codepath and the same file lock (a `.lock` suffix file, held for the duration of the JSON write).

### 9.4 Opt-out semantics

```
ide-bridge start --no-autosave       # disable loop, all else normal
```

The `config.json` key `autosave.enabled` defaults to `true`. The `--no-autosave` flag writes `autosave.enabled: false` to `config.json` for future starts. Reset with `ide-bridge config set autosave.enabled true`.

## 10. Secret Redaction

### 10.1 Patterns

Six patterns, matched by regular expression against string values in the PCB document:

| Pattern name | Regex | Replacement |
|---|---|---|
| `openai-key` | `/sk-[A-Za-z0-9]{20,}/g` | `[REDACTED:openai-key]` |
| `anthropic-key` | `/sk-ant-[A-Za-z0-9\-]{20,}/g` | `[REDACTED:anthropic-key]` |
| `aws-access-key` | `/AKIA[A-Z0-9]{16}/g` | `[REDACTED:aws-access-key]` |
| `github-pat` | `/ghp_[A-Za-z0-9]{36}/g` | `[REDACTED:github-pat]` |
| `stripe-live-key` | `/sk_live_[A-Za-z0-9]{24,}/g` | `[REDACTED:stripe-live-key]` |
| `private-key-header` | `/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g` | `[REDACTED:private-key-header]` |

### 10.2 Match algorithm

Redaction is applied in the `save_checkpoint` MCP tool handler, BEFORE `store.save()` is called. The same redaction pass runs in AutoSaveLoop before its `store.save()`. There is no post-hoc scan.

The walk:

1. Serialize the incoming PCB patch (or merged bundle) to a JSON string.
2. Apply all six regex replacements sequentially. The regexes are pre-compiled at daemon startup.
3. Parse back to object.
4. Pass the cleaned object to `store.save()`.

This approach is deliberately simple — it operates on the JSON string, not on typed fields — so it catches secrets embedded in nested strings, conversation turns, instruction blobs, and decision rationales alike.

### 10.3 Auditability

For each regex match found, before replacing, the daemon logs a structured entry at `warn` level:

```json
{
  "level": "warn",
  "event": "secret_redacted",
  "pattern": "openai-key",
  "value_sha256": "e3b0c44298fc1c149afb...",
  "project_id": "acme-billing-service",
  "timestamp": "2026-04-21T10:31:00.000Z"
}
```

`value_sha256` is `sha256(matched_value)`. This lets an operator verify which secret was present without re-exposing it. The plaintext match is never written to any log or file.

### 10.4 Configuration

Redaction is on by default.

```
ide-bridge start --no-redact        # disable globally (not recommended)
```

Per-project opt-out in `.ide-bridge.yaml`:

```yaml
redaction:
  enabled: false
```

When disabled, v0.1 behavior applies: secrets trigger a `warn` log entry (`event: secret_detected`) but are not replaced. The `[REDACTED:...]` marker never appears.

## 11. CLI Changes

### 11.1 New subcommands

| Subcommand | Description |
|---|---|
| `ide-bridge login <url>` | Authenticate to a remote serve instance. Spins local callback server, opens browser to `<url>/tokens/new`, writes `~/.ide-bridge/credentials.json`. |
| `ide-bridge logout` | Revoke the current token on the remote, delete `~/.ide-bridge/credentials.json`. |
| `ide-bridge pull [project_id]` | Pull the named project's bundle from the remote and merge it into the local store. If no `project_id` given, resolves identity from cwd. Refuses to auto-merge on conflict; prints a diff summary and requires `--force` to overwrite. |
| `ide-bridge status` | Show sync status: last push time, any pending conflicts, remote URL, token label. |
| `ide-bridge tokens list` | List all active tokens for this account on the configured remote. |
| `ide-bridge tokens revoke <id>` | Revoke a token by ID. |
| `ide-bridge serve` | Run the remote server. See §11.2. |
| `ide-bridge config set <key> <value>` | Set a config key (e.g. `autosave.enabled true`). |
| `ide-bridge config get <key>` | Read a config key. |

### 11.2 `ide-bridge serve` flags

```
ide-bridge serve \
  --postgres <url>       # required: PostgreSQL DSN (postgres://user:pass@host/db)
  --auth-secret <hex>    # required: 32-byte hex seed for token generation entropy
  --port <n>             # default: 8080
  --log-level <level>    # default: info (trace|debug|info|warn|error)
```

Environment variable equivalents (all take precedence over flags):

| Flag | Env var |
|---|---|
| `--postgres` | `DATABASE_URL` |
| `--auth-secret` | `IDE_BRIDGE_AUTH_SECRET` |
| `--port` | `PORT` |
| `--log-level` | `IDE_BRIDGE_LOG_LEVEL` |

### 11.3 `ide-bridge start` new flags

```
ide-bridge start \
  [--remote <url>]       # enable RemoteSyncer, push bundles to this URL
  [--no-autosave]        # disable AutoSaveLoop
  [--no-redact]          # disable secret redaction (writes warning to log)
  [--port <n>]           # unchanged from v0.1
```

### 11.4 `credentials.json` format

```json
// ~/.ide-bridge/credentials.json
// File permissions: 0o600 (owner read/write only)
{
  "remote_url": "https://bridge.example.com",
  "token": "ibr_a1b2c3d4e5f6...",
  "token_id": "550e8400-e29b-41d4-a716-446655440000",
  "label": "MacBook Pro — work",
  "created_at": "2026-04-21T10:00:00.000Z"
}
```

Raw tokens are prefixed `ibr_` to aid secret scanning tools in repositories where the file is accidentally committed.

## 12. Docker Self-Host

### 12.1 Image

Published image: `xsidz/ide-bridge:0.2.0-alpha.0`

The Dockerfile is a two-stage build:

- **Stage 1 (`build`):** `node:22-alpine`, installs dependencies, runs `tsc`, prunes `devDependencies`.
- **Stage 2 (`runtime`):** `node:22-alpine`, copies only `dist/` and `node_modules/`, runs as non-root user `idebridge` (UID 1001). No shell by default.

The image exposes port `8080`. The entrypoint is:

```sh
node dist/server/index.js
```

which is equivalent to `ide-bridge serve` but reads config exclusively from environment variables.

### 12.2 `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: idebridge
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: idebridge
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U idebridge"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    image: xsidz/ide-bridge:0.2.0-alpha.0
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://idebridge:changeme@db:5432/idebridge
      IDE_BRIDGE_AUTH_SECRET: "change_me_to_64_hex_chars_before_production"
      PORT: "8080"
      IDE_BRIDGE_LOG_LEVEL: info

volumes:
  pgdata:
```

### 12.3 `/healthz` endpoint

```
GET /healthz
```

Response `200 OK`:
```json
{
  "status": "ok",
  "version": "0.2.0-alpha.0",
  "db": "ok"
}
```

`db` is `"ok"` if the server can execute `SELECT 1` against Postgres; `"degraded"` otherwise (server still returns `200` — the orchestrator decides whether to restart). Used by Docker's `healthcheck` and any upstream load balancer.

### 12.4 CI publishing

`.github/workflows/publish.yml` triggers on `push` to tags matching `v0.*`. It builds the multi-platform image (`linux/amd64`, `linux/arm64`) and pushes to Docker Hub with both the exact version tag and `latest`.

## 13. Dependency Injection

v0.1 established the DI pattern via `startMcpServer({ store, debouncer, adapters })`. v0.2 extends it without breaking the existing signature — new components are optional injected deps.

```ts
interface StartMcpServerOptions {
  // v0.1 — unchanged
  store: BundleStore;
  debouncer: Debouncer;
  adapters: Map<IdeId, IdeAdapter>;

  // v0.2 — optional, undefined = feature disabled
  remoteSyncer?: RemoteSyncer;
  autoSaveLoop?: AutoSaveLoop;
  redactor?: Redactor;
}

function startMcpServer(opts: StartMcpServerOptions): FastifyInstance;
```

**`BundleStore` interface** (unchanged structure, new implementations):

```ts
interface BundleStore {
  load(projectId: string): Promise<Pcb | null>;
  save(projectId: string, bundle: Pcb): Promise<void>;
  list(): Promise<ProjectMeta[]>;
  on(event: "afterSave", listener: (projectId: string, bundle: Pcb) => void): void;
}
```

`FileBundleStore` implements this unchanged. `PostgresBundleStore` implements the same interface and accepts an injected `pg.Pool`:

```ts
new PostgresBundleStore({ pool: pg.Pool })
```

**`RemoteSyncer`** accepts:

```ts
new RemoteSyncer({
  remoteUrl: string,
  credentials: CredentialsStore,   // reads ~/.ide-bridge/credentials.json
  store: BundleStore,              // subscribes to afterSave
})
```

**`AutoSaveLoop`** accepts:

```ts
new AutoSaveLoop({
  store: BundleStore,
  adapters: Map<IdeId, IdeAdapter>,
  intervalMs: number,              // defaults to 120_000
})
```

All three new components can be replaced with test doubles in unit tests. No static singletons.

## 14. Testing Strategy

v0.2 ships approximately 70 tests across five categories. All use the same DI pattern — no global state, no live network calls in unit tests.

| Category | Approx. count | What it covers |
|---|---|---|
| **Unit** | 30 | `PostgresBundleStore` (via `pg-mem`), `RemoteSyncer` (mock HTTP), `AutoSaveLoop` (mock store + mock clock), `Redactor` (all 6 patterns, edge cases: no match, multi-match, nested JSON strings), PCB v0.1→v0.2 upgrade logic, `If-Match` / version vector logic, `mergePatch` correctness |
| **Integration** | 15 | Full `ide-bridge serve` stack against a real Postgres (testcontainers — spawns a Docker container only in CI; pg-mem for local `npm test`). Tests: push/pull round-trip, 409 on stale cursor, token auth (valid / revoked / missing), `/healthz` under degraded DB, migration idempotency |
| **Security** | 10 | Redaction: secret survives no path to disk even with `--no-redact` off; `credentials.json` written at `0o600`; token is `sha256`-hashed before DB write; `Authorization` header not logged; `value_sha256` in log is not reversible to original value |
| **Stress** | 5 | AutoSaveLoop with 50 projects: completes full tick in < 10s; RemoteSyncer offline queue: 100 queued pushes drain in < 30s on reconnect; concurrent `save_checkpoint` from two MCP clients: no data race, last-write wins per RFC 7396 |
| **E2E** | 10 | `ide-bridge login` → local callback → credentials written; `ide-bridge start --remote` → save → push observed on server; `ide-bridge pull` → local bundle updated; 409 conflict surfaced in `ide-bridge status`; Docker compose up → `GET /healthz` returns 200; all v0.1 E2E tests still pass |

**Mocking approach:** `pg-mem` is used for all local test runs (fast, no Docker dependency). `testcontainers` is available for CI integration runs where a real Postgres engine is needed for e.g. index behavior verification. The `BundleStore` interface allows all upper-layer tests to use `FileBundleStore` or an in-memory stub without touching Postgres at all.

## 15. Milestones and Cuts

**Target:** ~6-8 weeks from v0.1 ship date.

**v0.2.0-alpha.0 — in scope:**

- `PostgresBundleStore` + migration runner
- `RemoteSyncer` with offline queue and exponential backoff
- `AutoSaveLoop` (120s cadence, 24h project window)
- Conflict detection via `If-Match` + version vectors
- Secret redaction (6 patterns, `[REDACTED:<pattern>]` format)
- `ide-bridge login` / `logout` / `pull` / `status` / `tokens` subcommands
- `ide-bridge serve` with Postgres + auth middleware
- `/healthz` endpoint
- Docker image + `docker-compose.yml`
- CI publish workflow (tag push → Docker Hub)
- PCB v0.1→v0.2 auto-upgrade on daemon start
- All v0.1 tests passing

**Explicitly cut from v0.2.0-alpha.0:**

- Rate limiting (deferred to v0.2.1 if abuse appears in practice)
- Server-side SSE / push notifications to other devices
- Bundle version history (remote stores only latest)
- Web UI for token management (CLI only)
- `org` / `org_members` table logic (tables reserved, not used)
- Windsurf / JetBrains / Zed adapters

**v0.3 is the next milestone:** managed SaaS, multi-user auth, team sharing, per-project ACLs, web dashboard, bundle retention policy, org management.

## 16. Success Criteria

1. **Login works.** `ide-bridge login https://bridge.example.com` completes, writes `~/.ide-bridge/credentials.json` at mode `0o600`, and `ide-bridge status` shows the remote URL and token label.
2. **Cross-machine round-trip.** User saves a checkpoint on Machine A. On Machine B, `ide-bridge pull acme-billing-service` succeeds and `bridge.load_checkpoint()` returns the saved state, including plan, decisions, and conversation summary.
3. **Offline resilience.** With `--remote` configured, pushing while offline queues the push and retries with backoff. On reconnect, the push drains within 30 seconds.
4. **Secret redaction is enforced.** A bundle containing an OpenAI key (`sk-...`) written via `save_checkpoint` or AutoSaveLoop stores `[REDACTED:openai-key]` on disk and never transmits the plaintext to the remote. The daemon log contains `event: secret_redacted` with `value_sha256`.
5. **Docker self-host.** `docker compose up` starts the server and Postgres. `curl https://bridge.example.com/healthz` returns `{"status":"ok","db":"ok"}`. The login flow works against the containerized server.
6. **v0.1 compatibility.** All v0.1 tests pass against the v0.2 codebase. v0.1 PCBs on disk are auto-upgraded to v0.2 schema on first daemon start without data loss.
7. **Postgres migration is clean.** Starting `ide-bridge serve` against an empty Postgres database applies all migrations and produces the expected schema. Running migrations again is idempotent (no errors, no duplicate data).

## 17. Open Questions / Deferred Decisions

- **Rate limiting.** No per-token push rate limit ships in v0.2. If a runaway client (or a bug in AutoSaveLoop) hammers the server, the operator's only relief is token revocation. A configurable `X-RateLimit-*` middleware is noted for v0.2.1.

- **Server-to-device push (SSE).** Right now, Machine B can only get updates by running `ide-bridge pull`. Real-time cross-device push would require an SSE or WebSocket channel from the server to each connected daemon. This is deferred to v1.0 — it is architecturally compatible (Fastify supports SSE), but the client-side reconnection logic and the fanout semantics need a separate design.

- **Bundle size limit.** The server rejects bundles over 5MB compressed. This is chosen conservatively. If users with large `conversation.last_n_turns` blobs hit this frequently, v0.2.1 will add automatic fidelity downgrade on the client side before retry.

- **Versioning of bundles on the remote.** The `bundles` table stores only the latest PCB. Point-in-time recovery, diff viewing, and rollback are deferred to v0.3, which will add a `bundle_history` table with a configurable retention policy.

- **`pg-mem` vs. testcontainers parity.** `pg-mem` does not implement all Postgres features (e.g., some index types, `pg_isready` behavior). Any test that diverges between pg-mem and real Postgres should be marked `// @requires-postgres` and run only in CI. The distinction is tracked in a comment block at the top of `src/server/__tests__/postgres.integration.test.ts`.

## 18. Appendix A — Full Sync Flow Walkthrough

**Scenario:** User saves a checkpoint on Machine A and resumes on Machine B.

1. Agent on Machine A calls `bridge.save_checkpoint(patch)`.
2. Daemon merges patch → runs redactor → stores to `FileBundleStore` → fires `afterSave`.
3. `RemoteSyncer` receives `afterSave`. Checks `credentials.json` for token. Reads `server_updated_at` from local bundle.
4. `RemoteSyncer` sends `PUT /v2/bundles/acme-billing-service` with `If-Match: "<server_updated_at>"` and the full bundle body.
5. Server validates token, compares `If-Match` against `bundles.server_updated_at`. They match (first device to push). Server writes to `bundles`, advances `server_updated_at`, responds `200`.
6. `RemoteSyncer` writes the returned `server_updated_at` back into the local bundle (no Debouncer, direct store write).
7. On Machine B, user runs `ide-bridge pull acme-billing-service`.
8. CLI sends `GET /v2/bundles/acme-billing-service` with the Machine B token.
9. Server returns the bundle. CLI writes it to Machine B's `FileBundleStore`, sets `server_updated_at` from response.
10. Agent on Machine B calls `bridge.load_checkpoint()`. Daemon reads local store, returns the pulled bundle. Agent resumes with full context.

**Conflict scenario (both devices push without pulling):**

Steps 1-4 as above for Machine A. Machine B also pushes before pulling. Machine B's `If-Match` cursor is stale. Server returns `409`. Machine B's RemoteSyncer logs the conflict, sets `conflict_pending: true`, stops pushing for this project. `ide-bridge status` on Machine B shows the conflict. User runs `ide-bridge pull --force` to accept the remote version, which resets `conflict_pending`.
