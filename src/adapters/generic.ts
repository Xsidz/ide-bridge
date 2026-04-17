import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import type { Pcb } from "../pcb/schema.js";
import { extractSummary } from "../pcb/summary.js";

function renderPriorContext(pcb: Pcb): string {
  const s = extractSummary(pcb);
  const decisions = pcb.decisions.slice(-5).map(d => `- ${d.text}${d.rationale ? ` — ${d.rationale}` : ""}`).join("\n");
  const todos = pcb.todos.filter(t => t.status !== "done").map(t => `- [ ] ${t.text}`).join("\n");
  return [
    "# Prior context (from ide-bridge)", "",
    "Before acting, call `bridge.load_checkpoint()` for the full Portable Context Bundle.", "",
    `Summary: ${s || "(none)"}`, "",
    "## Recent decisions", decisions || "(none)", "",
    "## Open TODOs", todos || "(none)", "",
  ].join("\n");
}

export const genericAdapter: IdeAdapter = {
  ide: "generic",
  produce_fidelity: "L0",
  consume_fidelity: "L0",
  async extract() { return {}; },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const file = path.join(projectRoot, "AGENTS.md");
    await fs.writeFile(file, renderPriorContext(pcb));
    return { fidelity_applied: "L0", notes: [`wrote ${file}`] };
  },
};
