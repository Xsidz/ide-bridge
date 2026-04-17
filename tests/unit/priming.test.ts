import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writePriming } from "../../src/priming/generator.js";

let p: string;
beforeEach(() => { p = mkdtempSync(path.join(os.tmpdir(), "ib-prim-")); });

describe("writePriming", () => {
  it("writes claude-code priming to CLAUDE.md", async () => {
    await writePriming("claude-code", p);
    expect(readFileSync(path.join(p, "CLAUDE.md"), "utf8")).toContain("IDE Bridge");
  });
  it("writes cursor priming to .cursor/rules/ide-bridge.mdc", async () => {
    await writePriming("cursor", p);
    expect(existsSync(path.join(p, ".cursor", "rules", "ide-bridge.mdc"))).toBe(true);
  });
  it("writes kiro priming to .kiro/steering/ide-bridge.md", async () => {
    await writePriming("kiro", p);
    expect(existsSync(path.join(p, ".kiro", "steering", "ide-bridge.md"))).toBe(true);
  });
  it("writes antigravity/generic priming to AGENTS.md", async () => {
    await writePriming("generic", p);
    expect(existsSync(path.join(p, "AGENTS.md"))).toBe(true);
  });
  it("rejects unknown ide", async () => {
    await expect(writePriming("foo", p)).rejects.toThrow();
  });

  it("calling writePriming twice does not duplicate the priming block", async () => {
    await writePriming("claude-code", p);
    await writePriming("claude-code", p);
    const { readFileSync: rf } = await import("node:fs");
    const content = rf(path.join(p, "CLAUDE.md"), "utf8");
    const occurrences = (content.match(/<!-- ide-bridge:priming -->/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
