import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writePriming } from "../../src/priming/generator.js";

const MARKER = "<!-- ide-bridge:priming -->";
let p: string;
beforeEach(() => { p = mkdtempSync(path.join(os.tmpdir(), "ib-prim-")); });

describe("writePriming", () => {
  it("writes claude-code priming to CLAUDE.md with mandatory protocol language", async () => {
    await writePriming("claude-code", p);
    const content = readFileSync(path.join(p, "CLAUDE.md"), "utf8");
    expect(content).toContain("ide-bridge");
    expect(content).toContain("mandatory");
    expect(content).toContain("bridge.load_checkpoint");
  });

  it("marker is at the TOP of CLAUDE.md (fresh file)", async () => {
    await writePriming("claude-code", p);
    const content = readFileSync(path.join(p, "CLAUDE.md"), "utf8");
    expect(content.startsWith(MARKER)).toBe(true);
  });

  it("writes cursor priming to .cursor/rules/ide-bridge.mdc", async () => {
    await writePriming("cursor", p);
    expect(existsSync(path.join(p, ".cursor", "rules", "ide-bridge.mdc"))).toBe(true);
    const content = readFileSync(path.join(p, ".cursor", "rules", "ide-bridge.mdc"), "utf8");
    expect(content).toContain("mandatory");
    expect(content).toContain("bridge.load_checkpoint");
  });

  it("writes kiro priming to .kiro/steering/ide-bridge.md", async () => {
    await writePriming("kiro", p);
    expect(existsSync(path.join(p, ".kiro", "steering", "ide-bridge.md"))).toBe(true);
    const content = readFileSync(path.join(p, ".kiro", "steering", "ide-bridge.md"), "utf8");
    expect(content).toContain("mandatory");
    expect(content).toContain("bridge.load_checkpoint");
  });

  it("writes antigravity/generic priming to AGENTS.md with mandatory protocol language", async () => {
    await writePriming("generic", p);
    expect(existsSync(path.join(p, "AGENTS.md"))).toBe(true);
    const content = readFileSync(path.join(p, "AGENTS.md"), "utf8");
    expect(content).toContain("mandatory");
    expect(content).toContain("bridge.load_checkpoint");
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

  it("prepends bridge block at top of existing CLAUDE.md, preserving prior content below", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(p, "CLAUDE.md"), "# My project rules\nBe concise.\n");
    await writePriming("claude-code", p);
    const { readFileSync: rf } = await import("node:fs");
    const content = rf(path.join(p, "CLAUDE.md"), "utf8");
    const markerIdx = content.indexOf("<!-- ide-bridge:priming -->");
    const priorIdx = content.indexOf("My project rules");
    expect(markerIdx).toBeGreaterThanOrEqual(0);
    expect(priorIdx).toBeGreaterThan(markerIdx); // marker comes first
  });
});
