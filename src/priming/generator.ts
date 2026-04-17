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

export async function writePriming(
  ide: string,
  projectRoot: string,
  opts: { installHooks?: boolean } = {},
): Promise<string> {
  const route = ROUTES[ide];
  if (!route) throw new Error(`unknown ide: ${ide}`);
  const body = await fs.readFile(path.join(here, "templates", route.template), "utf8");
  const dest = path.join(projectRoot, route.dest);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (route.appendMode) {
    let existing = "";
    try { existing = await fs.readFile(dest, "utf8"); } catch { /* file absent */ }
    const marker = "<!-- ide-bridge:priming -->";
    if (!existing.includes(marker)) {
      const separator = existing ? `\n\n---\n\n${existing.trimStart()}` : "";
      await fs.writeFile(dest, `${marker}\n${body}${separator}`);
    }
  } else {
    await fs.writeFile(dest, body);
  }

  if (ide === "claude-code" && opts.installHooks !== false) {
    await installClaudeHooks(projectRoot);
  }

  return dest;
}

interface HookEntry { type: "command"; command: string; }
interface HookMatcher { matcher: string; hooks: HookEntry[]; }
interface ClaudeSettings {
  hooks?: {
    SessionStart?: HookMatcher[];
    PreCompact?: HookMatcher[];
    [key: string]: HookMatcher[] | undefined;
  };
  [key: string]: unknown;
}

const IDE_BRIDGE_HOOK_MARKERS = {
  load: "ide-bridge hook load",
  save: "ide-bridge hook save",
};

function hasCommand(matchers: HookMatcher[] | undefined, command: string): boolean {
  return !!matchers?.some(m => m.hooks.some(h => h.command === command));
}

async function installClaudeHooks(projectRoot: string): Promise<{ written: boolean; path: string }> {
  const settingsDir = path.join(projectRoot, ".claude");
  const settingsPath = path.join(settingsDir, "settings.json");
  let settings: ClaudeSettings = {};
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    settings = JSON.parse(raw);
  } catch { /* file absent or unreadable — start fresh */ }
  settings.hooks ??= {};
  const hooks = settings.hooks;

  // SessionStart -> ide-bridge hook load
  if (!hasCommand(hooks.SessionStart, IDE_BRIDGE_HOOK_MARKERS.load)) {
    hooks.SessionStart ??= [];
    hooks.SessionStart.push({
      matcher: "startup|resume",
      hooks: [{ type: "command", command: IDE_BRIDGE_HOOK_MARKERS.load }],
    });
  }

  // PreCompact -> ide-bridge hook save
  if (!hasCommand(hooks.PreCompact, IDE_BRIDGE_HOOK_MARKERS.save)) {
    hooks.PreCompact ??= [];
    hooks.PreCompact.push({
      matcher: "",
      hooks: [{ type: "command", command: IDE_BRIDGE_HOOK_MARKERS.save }],
    });
  }

  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return { written: true, path: settingsPath };
}
