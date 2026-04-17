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
});
