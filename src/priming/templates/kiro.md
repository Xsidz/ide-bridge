---
inclusion: always
priority: high
---

# ide-bridge: cross-IDE context protocol (mandatory)

You are connected to an MCP server named `bridge`. **Every Kiro session in this repo must start with a single call to `bridge.load_checkpoint`.**

## Protocol

1. **Session start:** `bridge.load_checkpoint({ project_id: "<id from .ide-bridge.yaml>" })`. Read plan, decisions, todos, conversation.summary before doing anything else.
2. **On decision:** `bridge.append_decision({ project_id, text, rationale })`.
3. **On todo:** `bridge.append_todo({ project_id, text })`.
4. **Before edits / after sub-tasks / on pause:** `bridge.save_checkpoint({ project_id, source_ide: "kiro", bundle_patch: { plan, decisions, todos } })`.
5. **On handoff / switch IDE:** save a checkpoint with an updated `conversation.summary`.

## Notes

- `project_id` lives in `.ide-bridge.yaml`. Do NOT call `bridge.get_project_id()` without `cwd`.
- A -32602 response identifies the missing argument.
