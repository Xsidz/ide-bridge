import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeRemote, readGitState } from "../../src/identity/git.js";

describe("normalizeRemote", () => {
  it("strips .git and lowercases host", () => {
    expect(normalizeRemote("git@GitHub.com:Acme/API.git")).toBe("github.com/acme/api");
    expect(normalizeRemote("https://user:tok@github.com/x/y.git")).toBe("github.com/x/y");
  });
});

describe("readGitState", () => {
  let tmp: string;
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "ib-git-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
    writeFileSync(path.join(tmp, "a.txt"), "hi");
    execFileSync("git", ["add", "."], { cwd: tmp });
    execFileSync("git", ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "-m", "init"], { cwd: tmp });
  });
  it("returns branch and head hash", async () => {
    const g = await readGitState(tmp);
    expect(g?.branch).toBe("main");
    expect(g?.head).toMatch(/^[a-f0-9]{7,}$/);
  });
});
