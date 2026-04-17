# IDE Bridge: context priming

You have access to an MCP server (`bridge.*`) that preserves project context across IDEs.

On start, call `bridge.load_checkpoint()` before doing anything else. Use the returned PCB's plan, decisions, todos, and conversation summary to align with prior work.

Save a checkpoint via `bridge.save_checkpoint({ project_id, source_ide, bundle_patch })`:
- Before file edits
- After completing a sub-task
- When the user says "pause", "switch IDE", or "handoff"
- Whenever a new plan step, TODO, or decision appears

Use `bridge.append_decision(text, rationale)` for design decisions and `bridge.append_todo(text)` for TODOs.
