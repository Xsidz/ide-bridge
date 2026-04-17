import fs from "node:fs/promises";
import { startMcpServer } from "../mcp/server.js";
import { configPath, storeRoot } from "../util/paths.js";

async function isAlreadyRunning(): Promise<{ pid: number; port: number } | null> {
  try {
    const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
    if (typeof cfg?.pid !== "number") return null;
    try { process.kill(cfg.pid, 0); return { pid: cfg.pid, port: cfg.port }; }
    catch { return null; }
  } catch { return null; }
}

export async function cmdStart(opts: { port?: number; remote?: string }) {
  if (opts.remote) {
    console.error("--remote is not yet implemented (v0.2)");
    process.exit(2);
  }
  const already = await isAlreadyRunning();
  if (already) {
    console.error(`ide-bridge is already running (pid=${already.pid}, port=${already.port}). Use 'ide-bridge stop' first.`);
    process.exit(1);
  }
  await fs.mkdir(storeRoot(), { recursive: true, mode: 0o700 });
  const handle = await startMcpServer({ port: opts.port ?? 31415 });
  await fs.writeFile(configPath(), JSON.stringify({ port: handle.port, pid: process.pid }, null, 2), { mode: 0o600 });
  console.log(`ide-bridge listening on ${handle.url}/mcp`);
  process.on("SIGINT",  async () => { await handle.stop(); process.exit(0); });
  process.on("SIGTERM", async () => { await handle.stop(); process.exit(0); });
}
