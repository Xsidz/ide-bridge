import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";
import { cmdHookSave } from "../../src/cli/hook.js";
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
