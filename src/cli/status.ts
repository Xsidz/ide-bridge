import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";

export async function cmdStatus() {
  try {
    const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
    try {
      process.kill(cfg.pid, 0);
      console.log(`running pid=${cfg.pid} port=${cfg.port}`);
    } catch { console.log("not running (stale config)"); }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") console.log("not running");
    else throw e;
  }
}
