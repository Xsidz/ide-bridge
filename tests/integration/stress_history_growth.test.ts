import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileBundleStore } from "../../src/store/file_store.js";
import { emptyPcb } from "../../src/pcb/schema.js";

beforeEach(() => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-hist-"));
});

describe("stress: history growth", () => {
  it("100 saves produce 100 history entries in sorted order", async () => {
    const store = new FileBundleStore();
    for (let i = 0; i < 100; i++) {
      await store.save(emptyPcb("histproj", "claude-code"));
    }
    const history = await store.listHistory("histproj");
    expect(history.length).toBe(100);
    const timestamps = history.map(e => e.ts);
    expect(timestamps).toEqual([...timestamps].sort());
  });
});
