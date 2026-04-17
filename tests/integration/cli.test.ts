import { describe, it, expect, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TSX = path.join(ROOT, "node_modules/.bin/tsx");
const CLI = path.join(ROOT, "src/index.ts");

function cli(args: string[], env: Record<string, string> = {}, cwd?: string) {
  return execFileSync(TSX, [CLI, ...args],
    { env: { ...process.env, ...env }, cwd, encoding: "utf8" });
}

let home: string;
let proj: string;
beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-cli-"));
  proj = mkdtempSync(path.join(os.tmpdir(), "ib-cli-p-"));
});

describe("ide-bridge CLI", () => {
  it("status reports not running initially", () => {
    const out = cli(["status"], { IDE_BRIDGE_HOME: home });
    expect(out).toMatch(/not running/i);
  });
  it("init writes .ide-bridge.yaml and mentions checked-in default", () => {
    const out = cli(["init"], { IDE_BRIDGE_HOME: home }, proj);
    expect(out).toMatch(/checked in/i);
    expect(existsSync(path.join(proj, ".ide-bridge.yaml"))).toBe(true);
  });
  it("init --gitignore also appends to .gitignore", () => {
    cli(["init", "--gitignore"], { IDE_BRIDGE_HOME: home }, proj);
    const gi = readFileSync(path.join(proj, ".gitignore"), "utf8");
    expect(gi).toMatch(/\.ide-bridge\.yaml/);
  });
});
