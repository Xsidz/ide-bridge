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

import { mkdtempSync as mk2, writeFileSync as wf2 } from "node:fs";
import { execFileSync as efs2 } from "node:child_process";
import os2 from "node:os";
import path2 from "node:path";

describe("readGitState edge cases", () => {
  it("returns empty branch/head for a fresh repo with no commits", async () => {
    const dir = mk2(path2.join(os2.tmpdir(), "ib-git-empty-"));
    efs2("git", ["init", "-q", "-b", "main"], { cwd: dir });
    const g = await readGitState(dir);
    expect(g).not.toBeNull();
    expect(g?.branch).toBe("");
    expect(g?.head).toBe("");
  });
  it("returns empty branch when HEAD is detached", async () => {
    const dir = mk2(path2.join(os2.tmpdir(), "ib-git-detached-"));
    efs2("git", ["init", "-q", "-b", "main"], { cwd: dir });
    wf2(path2.join(dir, "a.txt"), "hi");
    efs2("git", ["add", "."], { cwd: dir });
    efs2("git", ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "-m", "init"], { cwd: dir });
    const sha = efs2("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
    efs2("git", ["checkout", "-q", "--detach", sha], { cwd: dir });
    const g = await readGitState(dir);
    expect(g?.branch).toBe("");
    expect(g?.head).toMatch(/^[a-f0-9]{7,}$/);
  });
});
