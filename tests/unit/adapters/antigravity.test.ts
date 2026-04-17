import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { antigravityAdapter } from "../../../src/adapters/antigravity.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let projectRoot: string;
beforeEach(() => {
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-ag-"));
  writeFileSync(path.join(projectRoot, "AGENTS.md"), "# Project\nUse TypeScript.");
});

describe("antigravityAdapter", () => {
  it("produce/consume L1", () => {
    expect(antigravityAdapter.produce_fidelity).toBe("L1");
    expect(antigravityAdapter.consume_fidelity).toBe("L1");
  });
  it("extract reads AGENTS.md into instructions", async () => {
    const p = await antigravityAdapter.extract(projectRoot);
    expect(p.instructions?.some(i => i.content.includes("Use TypeScript"))).toBe(true);
  });
  it("import_into merges a Prior-context block, preserving existing AGENTS.md content", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal AG";
    await antigravityAdapter.import_into(projectRoot, pcb);
    const content = readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    expect(content).toContain("Goal AG");
    expect(content).toContain("Use TypeScript");
  });
});
