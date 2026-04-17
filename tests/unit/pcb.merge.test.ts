import { describe, it, expect } from "vitest";
import { mergePatch } from "../../src/pcb/merge.js";
import { emptyPcb } from "../../src/pcb/schema.js";

describe("mergePatch", () => {
  it("appends todos without duplication", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, { todos: [{ id: "t1", text: "x", status: "pending" }] });
    expect(out.todos).toHaveLength(1);
    const out2 = mergePatch(out, { todos: [{ id: "t1", text: "x updated", status: "pending" }] });
    expect(out2.todos).toHaveLength(1);
    expect(out2.todos[0].text).toBe("x updated");
  });
  it("replaces plan when provided", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, { plan: { summary: "new", current_step: null, steps: [] } });
    expect(out.plan.summary).toBe("new");
  });
  it("advances updated_at", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, {});
    expect(new Date(out.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(base.updated_at).getTime());
  });
});
