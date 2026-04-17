import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "ib-tools-"));
  process.env.IDE_BRIDGE_HOME = tmp;
});

describe("tool handlers", () => {
  it("save_checkpoint creates bundle if none, merges if exists", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    const r1 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code",
      bundle_patch: { plan: { summary: "first", current_step: null, steps: [] } } });
    expect(r1.saved).toBe(true);
    const r2 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code",
      bundle_patch: { todos: [{ id: "t1", text: "x", status: "pending" }] } });
    expect(r2.saved).toBe(true);
    const loaded = await h.load_checkpoint({ project_id: "p" });
    expect(loaded.bundle?.plan.summary).toBe("first");
    expect(loaded.bundle?.todos).toHaveLength(1);
  });
  it("debouncer blocks save within window", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(60_000), adapters: new AdapterRegistry() });
    await h.save_checkpoint({ project_id: "p", source_ide: "claude-code", bundle_patch: {} });
    const r2 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code", bundle_patch: {} });
    expect(r2.saved).toBe(false);
    expect(r2.reason).toMatch(/debounced/);
  });
  it("append_decision and append_todo mutate persisted bundle", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    await h.append_decision({ project_id: "p", text: "use HMAC", rationale: "spec" });
    await h.append_todo({ project_id: "p", text: "write test" });
    const { bundle } = await h.load_checkpoint({ project_id: "p" });
    expect(bundle?.decisions.some(d => d.text === "use HMAC")).toBe(true);
    expect(bundle?.todos.some(t => t.text === "write test")).toBe(true);
  });
  it("list_projects returns known ids", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    await h.append_todo({ project_id: "alpha", text: "x" });
    await h.append_todo({ project_id: "beta",  text: "y" });
    const { projects } = await h.list_projects({});
    expect(projects.sort()).toEqual(["alpha", "beta"]);
  });
  it("get_project_id resolves from cwd", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    const r = await h.get_project_id({ cwd: tmp });
    expect(r.project_id).toMatch(/^path-/);
    expect(r.resolved_from).toBe("path");
  });
});
