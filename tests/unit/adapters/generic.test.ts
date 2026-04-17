import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { genericAdapter } from "../../../src/adapters/generic.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "ib-gen-")); });

describe("genericAdapter", () => {
  it("produces and consumes L0", () => {
    expect(genericAdapter.produce_fidelity).toBe("L0");
    expect(genericAdapter.consume_fidelity).toBe("L0");
  });
  it("extract returns empty (agent-driven only)", async () => {
    expect(await genericAdapter.extract(tmp)).toEqual({});
  });
  it("import_into writes AGENTS.md with prior-context block", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal X";
    const report = await genericAdapter.import_into(tmp, pcb);
    expect(report.fidelity_applied).toBe("L0");
    const content = readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
    expect(content).toContain("Prior context");
    expect(content).toContain("Goal X");
  });
});
