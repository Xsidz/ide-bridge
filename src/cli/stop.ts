import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";

export async function cmdStop() {
  try {
    const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
    if (!cfg.pid) { console.error("no recorded pid"); process.exit(1); }
    process.kill(cfg.pid, "SIGTERM");
    console.log(`stopped pid=${cfg.pid}`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") console.error("ide-bridge is not running");
    else throw e;
  }
}
