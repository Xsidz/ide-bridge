import { describe, it, expect } from "vitest";
import { AdapterRegistry, negotiateFidelity } from "../../../src/adapters/types.js";

describe("AdapterRegistry", () => {
  it("registers and looks up", () => {
    const r = new AdapterRegistry();
    r.register({
      ide: "cc", produce_fidelity: "L3", consume_fidelity: "L3",
      extract: async () => ({}),
      import_into: async () => ({ fidelity_applied: "L3", notes: [] }),
    });
    expect(r.get("cc")?.produce_fidelity).toBe("L3");
    expect(r.list()).toEqual(["cc"]);
  });
});

describe("negotiateFidelity", () => {
  it("picks min of source produce and target consume", () => {
    expect(negotiateFidelity("L3", "L1")).toBe("L1");
    expect(negotiateFidelity("L0", "L3")).toBe("L0");
    expect(negotiateFidelity("L2", "L2")).toBe("L2");
  });
});
