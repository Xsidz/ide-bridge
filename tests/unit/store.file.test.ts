import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileBundleStore } from "../../src/store/file_store.js";
import { emptyPcb } from "../../src/pcb/schema.js";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "ib-test-"));
  process.env.IDE_BRIDGE_HOME = tmp;
});

describe("FileBundleStore", () => {
  it("load returns null when no bundle", async () => {
    const s = new FileBundleStore();
    expect(await s.load("p")).toBeNull();
  });
  it("save then load round-trips", async () => {
    const s = new FileBundleStore();
    const b = emptyPcb("p", "claude-code");
    await s.save(b);
    const got = await s.load("p");
    expect(got?.bundle_id).toBe(b.bundle_id);
  });
  it("writes history entries on every save", async () => {
    const s = new FileBundleStore();
    await s.save(emptyPcb("p", "a"));
    await s.save(emptyPcb("p", "b"));
    const history = await s.listHistory("p");
    expect(history.length).toBe(2);
  });
  it("history entries expose the real ts and bundle_id", async () => {
    const s = new FileBundleStore();
    const b = emptyPcb("p", "claude-code");
    await s.save(b);
    const [entry] = await s.listHistory("p");
    expect(entry?.bundle_id).toBe(b.bundle_id);
    expect(entry?.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  });
  it("list returns all known project ids", async () => {
    const s = new FileBundleStore();
    await s.save(emptyPcb("alpha", "a"));
    await s.save(emptyPcb("beta", "a"));
    const ids = await s.list();
    expect(ids.sort()).toEqual(["alpha", "beta"]);
  });
});
