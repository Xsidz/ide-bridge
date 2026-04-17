import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import { extractSummary } from "../pcb/summary.js";

async function readMdOr(p: string): Promise<string | undefined> {
  try { return await fs.readFile(p, "utf8"); } catch { return undefined; }
}

export const kiroAdapter: IdeAdapter = {
  ide: "kiro",
  produce_fidelity: "L1",
  consume_fidelity: "L1",
  async extract(projectRoot) {
    const steeringDir = path.join(projectRoot, ".kiro", "steering");
    const specsDir = path.join(projectRoot, ".kiro", "specs");
    const instructions: Array<{ id: string; scope: "project"; format: "markdown"; source_path: string; content: string }> = [];
    try {
      for (const f of await fs.readdir(steeringDir)) {
        if (!f.endsWith(".md")) continue;
        const content = await fs.readFile(path.join(steeringDir, f), "utf8");
        instructions.push({
          id: `kiro-steering-${f}`, scope: "project",
          format: "markdown", source_path: path.join(".kiro/steering", f), content,
        });
      }
    } catch { /* no steering dir */ }
    const specs: Array<{ id: string; title: string; requirements_md?: string; design_md?: string; tasks_md?: string }> = [];
    try {
      for (const d of await fs.readdir(specsDir)) {
        const base = path.join(specsDir, d);
        specs.push({
          id: `kiro-spec-${d}`, title: d,
          requirements_md: await readMdOr(path.join(base, "requirements.md")),
          design_md:       await readMdOr(path.join(base, "design.md")),
          tasks_md:        await readMdOr(path.join(base, "tasks.md")),
        });
      }
    } catch { /* no specs dir */ }
    return { instructions, specs };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const dir = path.join(projectRoot, ".kiro", "steering");
    await fs.mkdir(dir, { recursive: true });
    const body = [
      "# Imported context (ide-bridge)", "",
      `Summary: ${extractSummary(pcb)}`, "",
      "Call `bridge.load_checkpoint()` for full PCB.",
    ].join("\n");
    await fs.writeFile(path.join(dir, "_imported.md"), body);
    return { fidelity_applied: "L1", notes: ["wrote .kiro/steering/_imported.md"] };
  },
};
