# ide-bridge: cross-IDE context protocol (mandatory, read first)

You are connected to an MCP server named `bridge`. **Every session in this repo must start with a single call to `bridge.load_checkpoint`.**

## Protocol

1. **Session start:** `bridge.load_checkpoint({ project_id: "<id from .ide-bridge.yaml>" })`. Summarise plan / decisions / todos.
2. **On decision:** `bridge.append_decision`.
3. **On todo:** `bridge.append_todo`.
4. **Before edits / on pause:** `bridge.save_checkpoint({ project_id, source_ide: "antigravity", bundle_patch })`.

`project_id` from `.ide-bridge.yaml`. Never call `bridge.get_project_id` without `cwd`.
