import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveProjectId } from "../../src/identity/resolver.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "ib-res-")); });

describe("resolveProjectId", () => {
  it("prefers .ide-bridge.yaml project_id", async () => {
    writeFileSync(path.join(tmp, ".ide-bridge.yaml"), "project_id: explicit-id\n");
    const res = await resolveProjectId(tmp);
    expect(res).toEqual({ id: "explicit-id", resolved_from: "explicit" });
  });
  it("falls back to path fingerprint when no git, no yaml", async () => {
    const res = await resolveProjectId(tmp);
    expect(res.resolved_from).toBe("path");
    expect(res.id).toMatch(/^path-[a-f0-9]{12}$/);
  });
  it("honors cached .ide-bridge/project-id", async () => {
    mkdirSync(path.join(tmp, ".ide-bridge"), { recursive: true });
    writeFileSync(path.join(tmp, ".ide-bridge", "project-id"), "cached-id\n");
    const res = await resolveProjectId(tmp);
    expect(res.id).toBe("cached-id");
  });

  it("resolveProjectId resolves from git remote+branch when no yaml and no cache", async () => {
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync: wf } = await import("node:fs");
    execFileSync("git", ["init", "-q", "-b", "feat-billing"], { cwd: tmp });
    wf(path.join(tmp, "a.txt"), "x");
    execFileSync("git", ["add", "."], { cwd: tmp });
    execFileSync("git", ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "-m", "init"], { cwd: tmp });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:acme/billing.git"], { cwd: tmp });
    const res = await resolveProjectId(tmp);
    expect(res.resolved_from).toBe("git");
    expect(res.id).toMatch(/github-com-acme-billing/);
  });

  it("handles yaml project_id with trailing whitespace and a comment line before it", async () => {
    const { writeFileSync: wf } = await import("node:fs");
    wf(path.join(tmp, ".ide-bridge.yaml"), "# project config\nproject_id:   my-project  \n# end\n");
    const res = await resolveProjectId(tmp);
    expect(res.id).toBe("my-project");
    expect(res.resolved_from).toBe("explicit");
  });
});
