import { writePriming } from "../priming/generator.js";

export async function cmdPriming(ide: string, opts: { noHooks?: boolean }): Promise<void> {
  const root = process.cwd();
  const installHooks = !opts.noHooks;
  const file = await writePriming(ide, root, { installHooks });
  console.log(`wrote ${file}`);
  if (ide === "claude-code" && installHooks) {
    console.log(`wrote ${root}/.claude/settings.json (SessionStart + PreCompact hooks)`);
  }
}
