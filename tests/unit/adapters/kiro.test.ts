import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { kiroAdapter } from "../../../src/adapters/kiro.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let projectRoot: string;
beforeEach(() => {
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-kiro-"));
  mkdirSync(path.join(projectRoot, ".kiro", "steering"), { recursive: true });
  mkdirSync(path.join(projectRoot, ".kiro", "specs", "billing"), { recursive: true });
  writeFileSync(path.join(projectRoot, ".kiro", "steering", "style.md"), "# Style\nprefer vitest");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "requirements.md"), "# Reqs");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "design.md"), "# Design");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "tasks.md"), "# Tasks");
});

describe("kiroAdapter", () => {
  it("produce_fidelity=L1, consume_fidelity=L1", () => {
    expect(kiroAdapter.produce_fidelity).toBe("L1");
    expect(kiroAdapter.consume_fidelity).toBe("L1");
  });
  it("extract reads steering + specs", async () => {
    const p = await kiroAdapter.extract(projectRoot);
    expect(p.instructions?.some(i => i.content.includes("prefer vitest"))).toBe(true);
    expect(p.specs?.[0]?.title).toBe("billing");
  });
  it("import_into writes .kiro/steering/_imported.md", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal Z";
    await kiroAdapter.import_into(projectRoot, pcb);
    const imp = readFileSync(path.join(projectRoot, ".kiro", "steering", "_imported.md"), "utf8");
    expect(imp).toContain("Goal Z");
  });
});
