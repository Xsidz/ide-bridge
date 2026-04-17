# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x (alpha) | Yes — best-effort |
| < 0.1.0 | No |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email **siddhesh.kabraa@gmail.com** with the subject line `[ide-bridge security] <short summary>`. Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You should receive an acknowledgement within 3 business days. Coordinated disclosure: please give us 90 days to ship a fix before public disclosure, unless the issue is being actively exploited.

## Scope

In scope:
- The `ide-bridge` daemon and its MCP tool surface
- The `ide-bridge` CLI
- Dependency vulnerabilities that impact a default install

Out of scope:
- Issues in upstream agentic IDEs (Claude Code, Cursor, Kiro, Antigravity)
- Social-engineering against maintainers
- Denial-of-service requiring local admin privileges (the daemon runs as an unprivileged local user by design)

## Security posture (v0.1)

- Daemon binds `127.0.0.1` only — no remote network surface
- Storage under `~/.ide-bridge/` with permissions `0o700` (dirs) / `0o600` (files)
- Request bodies capped at 10 MB
- `project_id` inputs validated against `^[A-Za-z0-9._\-]{1,128}$`
- `metadata` merges filter `__proto__` / `constructor` / `prototype` keys to prevent prototype pollution

Known gaps (tracked for v0.1.x):
- No redaction of secrets that agents may paste into prompts (warnings planned — spec §12)
- `get_project_id(cwd)` trusts caller-supplied cwd — a local hostile process can probe filesystem layout
- No per-project LRU on the debouncer Map

Thank you for helping keep the project safe.
