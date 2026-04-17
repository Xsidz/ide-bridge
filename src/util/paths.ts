import os from "node:os";
import path from "node:path";

export function storeRoot(): string {
  return process.env.IDE_BRIDGE_HOME ?? path.join(os.homedir(), ".ide-bridge");
}
export function projectDir(projectId: string): string {
  return path.join(storeRoot(), "projects", projectId);
}
export function bundlePath(projectId: string): string {
  return path.join(projectDir(projectId), "bundle.json");
}
export function historyDir(projectId: string): string {
  return path.join(projectDir(projectId), "history");
}
export function configPath(): string {
  return path.join(storeRoot(), "config.json");
}
