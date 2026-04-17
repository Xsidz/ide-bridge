import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeCodeAdapter } from "../../../src/adapters/claude_code.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let home: string;
let projectRoot: string;
beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-cc-"));
  process.env.HOME = home;
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-cc-proj-"));
  const encoded = projectRoot.replace(/[/._]/g, "-");
  const sessionDir = path.join(home, ".claude", "projects", encoded);
  mkdirSync(sessionDir, { recursive: true });
  copyFileSync("tests/fixtures/claude_code_session.jsonl", path.join(sessionDir, "abc.jsonl"));
});

describe("claudeCodeAdapter", () => {
  it("declares L3 produce/consume", () => {
    expect(claudeCodeAdapter.produce_fidelity).toBe("L3");
    expect(claudeCodeAdapter.consume_fidelity).toBe("L3");
  });
  it("extract reads latest JSONL into conversation.last_n_turns", async () => {
    const p = await claudeCodeAdapter.extract(projectRoot);
    expect(p.conversation?.fidelity).toBe("L3");
    expect(p.conversation?.last_n_turns?.length).toBeGreaterThan(0);
  });
  it("import_into forges a resumable session with source_bundle_id", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.conversation = {
      fidelity: "L3", summary: "", summary_through_message: 0,
      last_n_turns: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    };
    const report = await claudeCodeAdapter.import_into(projectRoot, pcb);
    expect(report.fidelity_applied).toBe("L3");
    const encoded = projectRoot.replace(/[/._]/g, "-");
    const sessionDir = path.join(home, ".claude", "projects", encoded);
    const files = readdirSync(sessionDir).filter(f => f.endsWith(".jsonl"));
    const forged = files.find(f => f.startsWith("forged-"));
    expect(forged).toBeDefined();
    const content = readFileSync(path.join(sessionDir, forged as string), "utf8");
    expect(content).toContain("source_bundle_id");
    expect(report.notes.some(n => n.includes("claude --resume"))).toBe(true);
  });
});
