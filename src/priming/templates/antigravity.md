# IDE Bridge priming

On start, call `bridge.load_checkpoint` for prior context. Save via `bridge.save_checkpoint` before edits and when handing off. Use `bridge.append_decision` and `bridge.append_todo` for those record types.
