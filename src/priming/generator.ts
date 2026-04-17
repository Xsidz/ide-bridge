import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const ROUTES: Record<string, { template: string; dest: string; appendMode?: boolean }> = {
  "claude-code": { template: "claude_code.md", dest: "CLAUDE.md", appendMode: true },
  cursor:        { template: "cursor.mdc",     dest: ".cursor/rules/ide-bridge.mdc" },
  kiro:          { template: "kiro.md",        dest: ".kiro/steering/ide-bridge.md" },
  antigravity:   { template: "antigravity.md", dest: "AGENTS.md", appendMode: true },
  generic:       { template: "generic.md",     dest: "AGENTS.md", appendMode: true },
};

export async function writePriming(ide: string, projectRoot: string): Promise<string> {
  const route = ROUTES[ide];
  if (!route) throw new Error(`unknown ide: ${ide}`);
  const body = await fs.readFile(path.join(here, "templates", route.template), "utf8");
  const dest = path.join(projectRoot, route.dest);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (route.appendMode) {
    let existing = "";
    try { existing = await fs.readFile(dest, "utf8"); } catch { /* file absent */ }
    const marker = "<!-- ide-bridge:priming -->";
    if (existing.includes(marker)) {
      return dest; // already primed — don't touch
    }
    const separator = existing ? `\n\n---\n\n${existing.trimStart()}` : "";
    await fs.writeFile(dest, `${marker}\n${body}${separator}`);
  } else {
    await fs.writeFile(dest, body);
  }
  return dest;
}
