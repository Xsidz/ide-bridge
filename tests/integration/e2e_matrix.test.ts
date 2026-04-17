import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { startMcpServer } from "../../src/mcp/server.js";
import { InMemoryStore } from "../helpers/inMemoryStore.js";
import { Debouncer } from "../../src/debounce.js";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { kiroAdapter } from "../../src/adapters/kiro.js";
import { claudeCodeAdapter } from "../../src/adapters/claude_code.js";
import { emptyPcb } from "../../src/pcb/schema.js";
import { negotiateFidelity } from "../../src/adapters/types.js";
import { resolveProjectId } from "../../src/identity/resolver.js";
import { writePriming } from "../../src/priming/generator.js";
import { cmdHookSave } from "../../src/cli/hook.js";
import { configPath, storeRoot } from "../../src/util/paths.js";
import { FileBundleStore } from "../../src/store/file_store.js";

async function call<T>(u: string, name: string, args: unknown): Promise<T> {
  const r = await fetch(`${u}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const j = await r.json() as { result: { content: Array<{ text: string }> } };
  return JSON.parse(j.result.content[0]!.text) as T;
}

describe("e2e_matrix: Scenario 1 — multi-hop CC -> Cursor -> Kiro -> CC", () => {
  let stop: () => Promise<void>;
  let url: string;
  let store: InMemoryStore;
  let projectRoot: string;
  let origHome: string | undefined;

  beforeEach(async () => {
    origHome = process.env.HOME;
    projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-s1-"));
    store = new InMemoryStore();
    const s = await startMcpServer({ port: 0, store, debouncer: new Debouncer(0) });
    stop = s.stop; url = s.url;
  });
  afterEach(async () => {
    await stop();
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
  });

  it("accumulated plan + decisions + todos + spec survive all three IDE hops", async () => {
    await call(url, "save_checkpoint", {
      project_id: "proj-hop",
      source_ide: "claude-code",
      bundle_patch: {
        plan: { summary: "Build payment gateway", current_step: "design", steps: [] },
        conversation: { fidelity: "L3", summary: "", summary_through_message: 0, last_n_turns: [] },
      },
    });
    await call(url, "append_decision", { project_id: "proj-hop", text: "Use Stripe", rationale: "best DX" });
    await call(url, "append_decision", { project_id: "proj-hop", text: "Idempotency via event id" });
    await call(url, "append_todo", { project_id: "proj-hop", text: "Handle webhook replay" });

    const { bundle: afterCursor } = await call<{ bundle: ReturnType<typeof emptyPcb> }>(
      url, "load_checkpoint", { project_id: "proj-hop" }
    );
    expect(afterCursor.plan.summary).toBe("Build payment gateway");
    expect(afterCursor.decisions).toHaveLength(2);
    expect(afterCursor.todos).toHaveLength(1);

    await cursorAdapter.import_into(projectRoot, afterCursor);
    const cursorPrimer = await fs.readFile(path.join(projectRoot, ".cursor", "rules", "_imported.mdc"), "utf8");
    expect(cursorPrimer).toMatch(/Build payment gateway/);

    await call(url, "save_checkpoint", {
      project_id: "proj-hop",
      source_ide: "kiro",
      bundle_patch: {
        specs: [{ id: "spec-1", title: "Payment spec", requirements_md: "# Req\nHandle refunds" }],
      },
    });

    const { bundle: afterKiro } = await call<{ bundle: ReturnType<typeof emptyPcb> }>(
      url, "load_checkpoint", { project_id: "proj-hop" }
    );
    expect(afterKiro.specs).toHaveLength(1);
    expect(afterKiro.last_source_ide).toBe("kiro");

    await kiroAdapter.import_into(projectRoot, afterKiro);
    const kiroPrimer = await fs.readFile(path.join(projectRoot, ".kiro", "steering", "_imported.md"), "utf8");
    expect(kiroPrimer).toMatch(/Build payment gateway/);

    const { bundle: final } = await call<{ bundle: ReturnType<typeof emptyPcb> }>(
      url, "load_checkpoint", { project_id: "proj-hop" }
    );
    expect(final.decisions).toHaveLength(2);
    expect(final.todos).toHaveLength(1);
    expect(final.specs).toHaveLength(1);

    process.env.HOME = mkdtempSync(path.join(os.tmpdir(), "ib-s1-home-"));
    const report = await claudeCodeAdapter.import_into(projectRoot, final);
    expect(report.fidelity_applied).toBe("L3");
    expect(report.notes.some(n => n.includes("claude --resume"))).toBe(true);
  });
});

describe("e2e_matrix: Scenario 2 — dropped mid-save preserves prior state", () => {
  it("store.save() failure does not corrupt previous bundle", async () => {
    const store = new InMemoryStore();
    const good = emptyPcb("crash-test", "claude-code");
    good.plan = { summary: "Prior good state", current_step: null, steps: [] };
    store.seed(good);
    store.onSave = () => { throw new Error("ENOSPC: disk full"); };
    const updated = { ...good, plan: { summary: "Corrupted", current_step: null, steps: [] } };
    await expect(store.save(updated)).rejects.toThrow("ENOSPC");
    const recovered = await store.load("crash-test");
    expect(recovered).not.toBeNull();
    expect(recovered!.plan.summary).toBe("Prior good state");
  });

  it("FileBundleStore.save() atomic — tmp file not left behind after success", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "ib-s2-"));
    process.env.IDE_BRIDGE_HOME = home;
    const fileStore = new FileBundleStore();
    const base = emptyPcb("atomic-test", "claude-code");
    base.plan = { summary: "Good snapshot", current_step: null, steps: [] };
    await fileStore.save(base);
    const loaded = await fileStore.load("atomic-test");
    expect(loaded!.plan.summary).toBe("Good snapshot");
    const { bundlePath } = await import("../../src/util/paths.js");
    const tmpPath = bundlePath("atomic-test") + ".tmp";
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });
});

describe("e2e_matrix: Scenario 3 — fidelity negotiation L3 -> L1", () => {
  it("negotiateFidelity returns L1 for L3 source x L1 consumer", () => {
    expect(negotiateFidelity("L3", "L1")).toBe("L1");
  });

  it("kiroAdapter.import_into reports fidelity_applied L1 regardless of bundle fidelity", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ib-s3-"));
    const pcb = emptyPcb("fidelity-test", "claude-code");
    pcb.conversation = {
      fidelity: "L3",
      summary: "Full transcript",
      summary_through_message: 20,
      last_n_turns: [
        { role: "user", content: [{ type: "text", text: "Design the DB schema" }] },
        { role: "assistant", content: [{ type: "text", text: "Use PostgreSQL with JSONB" }] },
      ],
    };
    pcb.plan = { summary: "Build data layer", current_step: "schema", steps: [] };
    const report = await kiroAdapter.import_into(root, pcb);
    expect(report.fidelity_applied).toBe("L1");
    const primer = await fs.readFile(path.join(root, ".kiro", "steering", "_imported.md"), "utf8");
    expect(primer).toMatch(/Build data layer/);
    expect(primer).not.toMatch(/PostgreSQL with JSONB/);
  });
});

describe("e2e_matrix: Scenario 4 — identity migration path fingerprint -> explicit yaml", () => {
  it("old path-fingerprint bundle is preserved after yaml overrides id", async () => {
    const store = new InMemoryStore();
    const cwd = mkdtempSync(path.join(os.tmpdir(), "ib-s4-"));
    const r1 = await resolveProjectId(cwd);
    expect(r1.resolved_from).toBe("path");
    const pathId = r1.id;
    const oldBundle = emptyPcb(pathId, "claude-code");
    oldBundle.plan = { summary: "Old path bundle", current_step: null, steps: [] };
    store.seed(oldBundle);
    await fs.writeFile(path.join(cwd, ".ide-bridge.yaml"), "project_id: my-explicit-project\n");
    const r2 = await resolveProjectId(cwd);
    expect(r2.resolved_from).toBe("explicit");
    expect(r2.id).toBe("my-explicit-project");
    expect(r2.id).not.toBe(pathId);
    const oldStillThere = await store.load(pathId);
    expect(oldStillThere).not.toBeNull();
    expect(oldStillThere!.plan.summary).toBe("Old path bundle");
    const newBundle = await store.load("my-explicit-project");
    expect(newBundle).toBeNull();
  });
});

describe("e2e_matrix: Scenario 5 — priming -> save -> imported round-trip", () => {
  it("cursor priming coexists with _imported.mdc after a save_checkpoint roundtrip", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ib-s5-"));
    const dest = await writePriming("cursor", root);
    expect(dest).toBe(path.join(root, ".cursor", "rules", "ide-bridge.mdc"));
    const priming = await fs.readFile(dest, "utf8");
    expect(priming).toMatch(/bridge\.load_checkpoint/);

    const store = new InMemoryStore();
    const s = await startMcpServer({ port: 0, store, debouncer: new Debouncer(0) });
    try {
      await call(s.url, "save_checkpoint", {
        project_id: "priming-proj",
        source_ide: "cursor",
        bundle_patch: {
          plan: { summary: "Integrate Stripe", current_step: "webhook", steps: [] },
          decisions: [{ id: "d1", at: new Date().toISOString(), text: "Use raw body for HMAC" }],
        },
      });
      const { bundle } = await call<{ bundle: ReturnType<typeof emptyPcb> }>(
        s.url, "load_checkpoint", { project_id: "priming-proj" }
      );
      await cursorAdapter.import_into(root, bundle);
      const imported = await fs.readFile(path.join(root, ".cursor", "rules", "_imported.mdc"), "utf8");
      expect(imported).toMatch(/Integrate Stripe/);
      const rulesDir = await fs.readdir(path.join(root, ".cursor", "rules"));
      expect(rulesDir).toContain("ide-bridge.mdc");
      expect(rulesDir).toContain("_imported.mdc");
    } finally {
      await s.stop();
    }
  });
});

describe("e2e_matrix: Scenario 6 — hook save with no running daemon", () => {
  let origHome: string | undefined;
  let origBridgeHome: string | undefined;

  beforeEach(() => {
    origHome = process.env.HOME;
    origBridgeHome = process.env.IDE_BRIDGE_HOME;
  });

  afterEach(() => {
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origBridgeHome !== undefined) process.env.IDE_BRIDGE_HOME = origBridgeHome;
    else delete process.env.IDE_BRIDGE_HOME;
  });

  it("cmdHookSave rejects with a connection error, does not crash", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "ib-s6-"));
    process.env.IDE_BRIDGE_HOME = home;
    await fs.mkdir(home, { recursive: true });
    await fs.writeFile(configPath(), JSON.stringify({ port: 19999, pid: 99999 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }); };
    try {
      await expect(cmdHookSave({ projectDir: home })).rejects.toThrow(/ECONNREFUSED/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("cmdHookSave rejects when config.json is absent", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "ib-s6b-"));
    process.env.IDE_BRIDGE_HOME = home;
    await expect(cmdHookSave({ projectDir: home })).rejects.toThrow();
  });
});

describe("e2e_matrix: Scenario 7 — full switch IDE: JSONL -> PCB -> Cursor .mdc", () => {
  let origHome: string | undefined;
  let origBridgeHome: string | undefined;

  beforeEach(() => {
    origHome = process.env.HOME;
    origBridgeHome = process.env.IDE_BRIDGE_HOME;
  });

  afterEach(() => {
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origBridgeHome !== undefined) process.env.IDE_BRIDGE_HOME = origBridgeHome;
    else delete process.env.IDE_BRIDGE_HOME;
  });

  it("decision from CC session appears in Cursor _imported.mdc after save_checkpoint roundtrip", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "ib-s7-home-"));
    process.env.HOME = home;
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-s7-proj-"));
    process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-s7-store-"));
    const encoded = projectRoot.replace(/[/._]/g, "-");
    const sessionDir = path.join(home, ".claude", "projects", encoded);
    await fs.mkdir(sessionDir, { recursive: true });
    const sessionLines = [
      JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "design the auth module" }] }, timestamp: "2026-04-17T00:00:00Z", uuid: "u1" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Use JWT with RS256" }] }, timestamp: "2026-04-17T00:00:01Z", uuid: "u2" }),
    ].join("\n") + "\n";
    await fs.writeFile(path.join(sessionDir, "session.jsonl"), sessionLines);

    const extracted = await claudeCodeAdapter.extract(projectRoot);
    expect(extracted.conversation?.fidelity).toBe("L3");
    expect(extracted.conversation?.last_n_turns).toHaveLength(2);

    const store = new InMemoryStore();
    const s = await startMcpServer({ port: 0, store, debouncer: new Debouncer(0) });
    try {
      await call(s.url, "save_checkpoint", {
        project_id: "switch-ide",
        source_ide: "claude-code",
        bundle_patch: {
          conversation: extracted.conversation,
          plan: { summary: "Auth module", current_step: "design", steps: [] },
          decisions: [{ id: "d1", at: new Date().toISOString(), text: "JWT RS256 for stateless auth" }],
        },
      });
      const { bundle } = await call<{ bundle: ReturnType<typeof emptyPcb> }>(
        s.url, "load_checkpoint", { project_id: "switch-ide" }
      );
      expect(bundle.conversation.fidelity).toBe("L3");
      expect(bundle.decisions[0]!.text).toMatch(/JWT/);
      await cursorAdapter.import_into(projectRoot, bundle);
      const mdc = await fs.readFile(path.join(projectRoot, ".cursor", "rules", "_imported.mdc"), "utf8");
      expect(mdc).toMatch(/Auth module/);
    } finally {
      await s.stop();
    }
  });
});

describe("e2e_matrix: Scenario 8 — daemon start -> stop -> start", () => {
  let origBridgeHome: string | undefined;

  beforeEach(() => {
    origBridgeHome = process.env.IDE_BRIDGE_HOME;
  });

  afterEach(() => {
    if (origBridgeHome !== undefined) process.env.IDE_BRIDGE_HOME = origBridgeHome;
    else delete process.env.IDE_BRIDGE_HOME;
  });

  it("second start after stop serves requests normally", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "ib-s8-"));
    process.env.IDE_BRIDGE_HOME = home;
    await fs.mkdir(storeRoot(), { recursive: true });
    const h1 = await startMcpServer({ port: 0 });
    await fs.writeFile(configPath(), JSON.stringify({ port: h1.port, pid: process.pid }));
    await h1.stop();
    const stalePid = 9999999;
    await fs.writeFile(configPath(), JSON.stringify({ port: h1.port, pid: stalePid }));
    let pidAlive = false;
    try { process.kill(stalePid, 0); pidAlive = true; } catch { /* expected */ }
    expect(pidAlive).toBe(false);
    const h2 = await startMcpServer({ port: 0 });
    await fs.writeFile(configPath(), JSON.stringify({ port: h2.port, pid: process.pid }));
    try {
      const r = await fetch(`${h2.url}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const j = await r.json() as { result: { tools: unknown[] } };
      expect(j.result.tools.length).toBeGreaterThan(0);
      const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
      expect(cfg.port).toBe(h2.port);
    } finally {
      await h2.stop();
    }
  });
});
