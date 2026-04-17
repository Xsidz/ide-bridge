# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.0] — 2026-04-17

### Added
- Local MCP daemon bound to `localhost:31415` speaking Streamable HTTP (2025-06-18)
- Six MCP tools: `save_checkpoint`, `load_checkpoint`, `append_decision`, `append_todo`, `list_projects`, `get_project_id`
- Portable Context Bundle (PCB) v0.1 — Zod-validated JSON format
- Five IDE adapters: Claude Code (L3), Cursor (L2), Kiro (L1), Antigravity (L1), Generic (L0)
- Three-tier project identity resolver (`.ide-bridge.yaml` > git remote+branch > path fingerprint)
- File-backed BundleStore with atomic writes (UUID-suffixed tmp) and append-only history
- 30-second per-project save debounce (bypassable with `force: true`)
- CLI commands: `start`, `stop`, `status`, `init`, `hook save`, `install-service`, `priming <ide>`
- launchd plist and systemd user unit templates for autostart
- Per-IDE priming file generator with `<!-- ide-bridge:priming -->` idempotency marker
- 104 tests (unit + integration + stress + security + e2e)

### Security
- Daemon binds `127.0.0.1` only (no remote listeners)
- Store permissions `0o700` / `0o600`
- `project_id` regex validation rejects path-traversal attempts
- Prototype pollution defense in metadata merges
- Explicit Fastify `bodyLimit` of 10 MB

[Unreleased]: https://github.com/Xsidz/ide-bridge/compare/v0.1.0-alpha.0...HEAD
[0.1.0-alpha.0]: https://github.com/Xsidz/ide-bridge/releases/tag/v0.1.0-alpha.0
