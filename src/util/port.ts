import net from "node:net";
export async function findFreePort(start: number, end: number): Promise<number> {
  for (let p = start; p <= end; p++) {
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, "127.0.0.1");
    });
    if (free) return p;
  }
  throw new Error(`No free port in [${start}, ${end}]`);
}
