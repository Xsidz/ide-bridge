import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeRemote, readGitState } from "./git.js";

export interface Resolved { id: string; resolved_from: "explicit" | "git" | "path"; }

async function readText(p: string): Promise<string | null> {
  try { return (await fs.readFile(p, "utf8")).trim(); } catch { return null; }
}

export async function resolveProjectId(cwd: string): Promise<Resolved> {
  const yaml = await readText(path.join(cwd, ".ide-bridge.yaml"));
  if (yaml) {
    const m = yaml.match(/^project_id:\s*(\S+)/m);
    if (m && m[1]) return { id: m[1], resolved_from: "explicit" };
  }
  const cached = await readText(path.join(cwd, ".ide-bridge", "project-id"));
  if (cached) return { id: cached, resolved_from: "explicit" };
  const g = await readGitState(cwd);
  if (g?.remote && g.branch) {
    const norm = normalizeRemote(g.remote);
    const branchHash = crypto.createHash("sha1").update(g.branch).digest("hex").slice(0, 6);
    return { id: `${norm.replace(/[^a-z0-9]/gi, "-")}-${branchHash}`, resolved_from: "git" };
  }
  const h = crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 12);
  return { id: `path-${h}`, resolved_from: "path" };
}
