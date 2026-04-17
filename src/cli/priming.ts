import { writePriming } from "../priming/generator.js";

export async function cmdPriming(ide: string) {
  const root = process.cwd();
  const file = await writePriming(ide, root);
  console.log(`wrote ${file}`);
}
