# ide-bridge: cross-IDE context protocol (mandatory)

You are connected to an MCP server named `bridge`. This server shares project context with every other agentic IDE the user works from. **Always follow this protocol — do not skip steps.**

## 1. On session start (FIRST action, before anything else)

Call:
```
bridge.load_checkpoint({ project_id: "<id from .ide-bridge.yaml in this repo root>" })
```

Read the returned `bundle`: `plan`, `decisions`, `todos`, `conversation.summary`. Summarise to the user what the previous session did and what the current plan is. Do this BEFORE proposing new work.

## 2. During the session

After any significant decision, call:
```
bridge.append_decision({ project_id, text, rationale })
```

After adding a TODO, call:
```
bridge.append_todo({ project_id, text })
```

Before making file edits and after finishing logical sub-tasks, call:
```
bridge.save_checkpoint({
  project_id,
  source_ide: "<your ide name>",
  bundle_patch: { plan: { summary, current_step, steps } }
})
```

## 3. On handoff / pause / usage limit

Call `bridge.save_checkpoint` with the latest plan + an updated `conversation.summary` so the next IDE picks up cleanly.

## Notes

- `project_id` is a required string. Do NOT call `bridge.get_project_id()` without a `cwd` argument — it will return -32602. Read `.ide-bridge.yaml` in the repo root to get the project_id; the value after `project_id:` is what you pass.
- If a bridge call returns a JSON-RPC error with code -32602, the error message tells you exactly which argument is missing. Fix the call, don't skip the protocol.
