import fs from "node:fs/promises";
import path from "node:path";

export async function cmdInit(opts: { gitignore?: boolean }) {
  const cwd = process.cwd();
  const yaml = path.join(cwd, ".ide-bridge.yaml");
  const projectId = path.basename(cwd);
  const body = `project_id: ${projectId}\n# checked in by default — share across machines/teammates.\n# Pass --gitignore on init or add to .gitignore to keep private.\n`;
  await fs.writeFile(yaml, body);
  console.log(`wrote ${yaml} (checked in by default)`);
  if (opts.gitignore) {
    const gi = path.join(cwd, ".gitignore");
    let prev = "";
    try { prev = await fs.readFile(gi, "utf8"); } catch { /* .gitignore absent */ }
    if (!prev.includes(".ide-bridge.yaml")) {
      const sep = prev.endsWith("\n") || prev === "" ? "" : "\n";
      await fs.writeFile(gi, prev + sep + ".ide-bridge.yaml\n");
    }
  }
}
