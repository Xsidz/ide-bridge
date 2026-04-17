# ide-bridge: cross-IDE context protocol (mandatory, read first)

You are connected to an MCP server named `bridge`. **Every session must start with a single call to `bridge.load_checkpoint`.** This takes priority over all other startup behaviour in this repo.

## Protocol

1. **First action of every session:** call `bridge.load_checkpoint({ project_id: "<id from .ide-bridge.yaml>" })`. Summarise the plan, decisions, and todos before doing anything else.
2. **On significant decision:** `bridge.append_decision({ project_id, text, rationale })`.
3. **On new TODO:** `bridge.append_todo({ project_id, text })`.
4. **Before file edits / after sub-task completion / on pause:** `bridge.save_checkpoint({ project_id, source_ide: "claude-code", bundle_patch: { plan, todos, decisions } })`.
5. **On handoff or "switch IDE":** save a checkpoint including an updated `conversation.summary`.

Native Stop/PostToolUse hooks also auto-save — redundancy is expected and fine.

## Arguments

- `project_id`: read `.ide-bridge.yaml` at repo root; the value after `project_id:` is literal. Do NOT call `bridge.get_project_id()` without `cwd`.
- `source_ide`: `"claude-code"`.
- A -32602 response tells you which argument is missing — fix and retry.
