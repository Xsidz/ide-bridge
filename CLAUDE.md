<!-- ide-bridge:priming -->
## IDE Bridge (context portability)

Call `bridge.load_checkpoint` at the start of each session. Save via `bridge.save_checkpoint` on sub-task completion, before file edits, and when asked to pause or handoff. Use `bridge.append_decision` and `bridge.append_todo` for those record types. The daemon also auto-saves on Stop/PostToolUse hooks — redundancy is fine.
