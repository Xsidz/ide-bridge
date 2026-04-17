import { describe, it, expect } from "vitest";
import { extractSummary } from "../../src/pcb/summary.js";
import { emptyPcb } from "../../src/pcb/schema.js";

describe("extractSummary", () => {
  it("returns a plan-step + decisions + todo synopsis under 500 chars", () => {
    const b = emptyPcb("p", "ide-a");
    b.plan = { summary: "Webhook", current_step: "sig verify",
      steps: [{ id: "s1", text: "scaffold", status: "done" },
              { id: "s2", text: "sig verify", status: "in_progress" }] };
    b.decisions = [{ id: "d1", at: "2026-01-01", text: "HMAC-SHA256" }];
    b.todos = [{ id: "t1", text: "replay test", status: "pending" }];
    const s = extractSummary(b);
    expect(s).toMatch(/sig verify/);
    expect(s).toMatch(/HMAC/);
    expect(s.length).toBeLessThanOrEqual(500);
  });

  it("omits done todos and shows only the last 3 of many decisions", () => {
    const b = emptyPcb("p", "ide-a");
    b.decisions = Array.from({ length: 5 }, (_, i) => ({
      id: `d${i + 1}`, at: "2026-01-01", text: `Decision ${i + 1}`,
    }));
    b.todos = [
      { id: "t1", text: "open task",  status: "pending" },
      { id: "t2", text: "done task",  status: "done" },
    ];
    const s = extractSummary(b);
    expect(s).not.toContain("Decision 1");
    expect(s).not.toContain("Decision 2");
    expect(s).toContain("Decision 5");
    expect(s).toContain("open task");
    expect(s).not.toContain("done task");
    expect(s.length).toBeLessThanOrEqual(500);
  });
});
