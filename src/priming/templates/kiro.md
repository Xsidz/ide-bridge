# ide-bridge priming (Kiro steering)

On spec or session start, call `bridge.load_checkpoint` to retrieve prior-session plan, decisions, and todos. Write new decisions through `bridge.append_decision` and todos through `bridge.append_todo`. Save a checkpoint with `bridge.save_checkpoint` when pausing or handing off.
