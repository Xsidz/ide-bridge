import { simpleGit } from "simple-git";

export function normalizeRemote(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[a-z]+:\/\/[^/@]*@/, "");             // strip user:tok@
  s = s.replace(/^git@([^:]+):/, "$1/");                // git@host:owner/repo
  s = s.replace(/^[a-z]+:\/\//, "");                    // strip https://
  s = s.replace(/\.git$/, "");
  const parts = s.split("/");
  const host = parts.shift() ?? "";
  return `${host.toLowerCase()}/${parts.join("/").toLowerCase()}`;
}

export interface GitState {
  remote: string; branch: string; head: string;
  dirty_files: string[]; staged_diff: string; unstaged_diff: string;
}

export async function readGitState(cwd: string): Promise<GitState | null> {
  const git = simpleGit(cwd);
  if (!(await git.checkIsRepo())) return null;
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === "origin");

  let branch = "";
  let head = "";
  try {
    const rawBranch = (await git.raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    branch = rawBranch === "HEAD" ? "" : rawBranch;  // detached HEAD → empty
    head = (await git.raw(["rev-parse", "--short", "HEAD"])).trim();
  } catch {
    // empty repo (no commits yet) — leave branch/head empty
  }

  const status = await git.status();
  return {
    remote: origin?.refs.fetch ?? "",
    branch, head,
    dirty_files: status.files.map(f => f.path),
    staged_diff: await git.diff(["--staged"]),
    unstaged_diff: await git.diff(),
  };
}
