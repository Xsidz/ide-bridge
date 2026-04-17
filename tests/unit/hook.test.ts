import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";
import { cmdHookSave, cmdHookLoad } from "../../src/cli/hook.js";
import { configPath } from "../../src/util/paths.js";

let stop: () => Promise<void>;
let home: string;
let proj: string;

beforeEach(async () => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-hook-"));
  proj = mkdtempSync(path.join(os.tmpdir(), "ib-hook-p-"));
  process.env.IDE_BRIDGE_HOME = home;
  const s = await startMcpServer({ port: 0 });
  stop = s.stop;
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify({ port: s.port, pid: process.pid }));
});
afterEach(async () => stop());

describe("cmdHookSave", () => {
  it("resolves project_id from cwd (matches .ide-bridge.yaml if present)", async () => {
    // Write a yaml so resolver returns "explicit-demo" — distinctive id
    writeFileSync(path.join(proj, ".ide-bridge.yaml"), "project_id: explicit-demo\n");
    // Capture stdout
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { chunks.push(chunk.toString()); return true; }) as typeof process.stdout.write;
    try { await cmdHookSave({ projectDir: proj }); }
    finally { process.stdout.write = origWrite; }
    // The daemon should now have a bundle under "explicit-demo"
    mkdirSync(path.join(home, "projects"), { recursive: true });
    const projects = await fs.readdir(path.join(home, "projects"));
    expect(projects).toContain("explicit-demo");
  });
});

describe("cmdHookLoad", () => {
  it("writes nothing to stdout when daemon config is absent (silent failure)", async () => {
    const silentHome = mkdtempSync(path.join(os.tmpdir(), "ib-hookload-noconfig-"));
    process.env.IDE_BRIDGE_HOME = silentHome;
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { chunks.push(chunk.toString()); return true; }) as typeof process.stdout.write;
    try {
      await cmdHookLoad({ projectDir: silentHome });
    } finally {
      process.stdout.write = origWrite;
      process.env.IDE_BRIDGE_HOME = home;
    }
    expect(chunks.join("")).toBe("");
  });

  it("emits a summary when a bundle exists for the resolved project", async () => {
    // Seed a bundle by saving via the live daemon
    writeFileSync(path.join(proj, ".ide-bridge.yaml"), "project_id: hookload-test\n");
    const url = `http://127.0.0.1:${JSON.parse(await fs.readFile(configPath(), "utf8")).port}/mcp`;
    const seedBody = {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: {
        name: "save_checkpoint",
        arguments: {
          project_id: "hookload-test",
          source_ide: "cursor",
          bundle_patch: {
            plan: { summary: "implement auth", current_step: "write tests", steps: [] },
            decisions: [{ id: "d1", at: new Date().toISOString(), text: "use JWT", rationale: "stateless" }],
            todos: [{ id: "t1", text: "add login route", status: "pending" }],
          },
        },
      },
    };
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(seedBody) });

    // Capture stdout from cmdHookLoad
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { chunks.push(chunk.toString()); return true; }) as typeof process.stdout.write;
    try {
      await cmdHookLoad({ projectDir: proj });
    } finally {
      process.stdout.write = origWrite;
    }
    const output = chunks.join("");
    expect(output).toContain("[ide-bridge] Resumed project");
    expect(output).toContain("Plan:");
    expect(output).toContain("use JWT");
  });
});
