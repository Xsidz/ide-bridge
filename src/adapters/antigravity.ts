import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import { extractSummary } from "../pcb/summary.js";

const START = "<!-- ide-bridge:start -->";
const END = "<!-- ide-bridge:end -->";

async function readAgentsMd(projectRoot: string): Promise<string> {
  try { return await fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8"); } catch { return ""; }
}

function stripBridgeBlock(content: string): string {
  const re = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, "g");
  return content.replace(re, "").trimStart();
}

export const antigravityAdapter: IdeAdapter = {
  ide: "antigravity",
  produce_fidelity: "L1",
  consume_fidelity: "L1",
  async extract(projectRoot) {
    const content = await readAgentsMd(projectRoot);
    if (!content) return {};
    return {
      instructions: [{
        id: "antigravity-agents-md", scope: "project", format: "markdown",
        source_path: "AGENTS.md", content: stripBridgeBlock(content),
      }],
    };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const file = path.join(projectRoot, "AGENTS.md");
    const existing = stripBridgeBlock(await readAgentsMd(projectRoot));
    const block = [
      START,
      "# Prior context (ide-bridge)",
      `Summary: ${extractSummary(pcb)}`,
      "Call `bridge.load_checkpoint()` before acting.",
      END,
    ].join("\n");
    await fs.writeFile(file, `${block}\n\n${existing}`);
    return { fidelity_applied: "L1", notes: [`merged ide-bridge block into ${file}`] };
  },
};
