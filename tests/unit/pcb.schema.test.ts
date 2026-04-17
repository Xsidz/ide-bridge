import { describe, it, expect } from "vitest";
import { PcbSchema, type Pcb } from "../../src/pcb/schema.js";

describe("PcbSchema", () => {
  it("accepts a minimal valid PCB", () => {
    const pcb: Pcb = {
      pcb_version: "0.1",
      bundle_id: "01HXYZ",
      updated_at: "2026-04-17T00:00:00Z",
      last_source_ide: "claude-code",
      user_id: null,
      project: { id: "p", resolved_from: "explicit", root_path_fingerprint: "sha256:abc" },
      instructions: [], memories: [],
      plan: { summary: "", current_step: null, steps: [] },
      todos: [], decisions: [], specs: [],
      conversation: { fidelity: "L0", summary: "", summary_through_message: 0, last_n_turns: [] },
      workspace: { open_files: [], active_file: null, cursor: null },
      attachments: [], capabilities_required: [], last_source_capabilities: [], metadata: {},
    };
    expect(PcbSchema.parse(pcb)).toEqual(pcb);
  });

  it("rejects invalid fidelity", () => {
    expect(() => PcbSchema.parse({ conversation: { fidelity: "L9" } })).toThrow();
  });
});
