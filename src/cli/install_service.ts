import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export function renderLaunchdPlist(binary: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.ide-bridge.daemon</string>
<key>ProgramArguments</key><array><string>${binary}</string><string>start</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>`;
}

export function renderSystemdUnit(binary: string): string {
  return `[Unit]
Description=ide-bridge daemon
After=network.target

[Service]
ExecStart=${binary} start
Restart=on-failure

[Install]
WantedBy=default.target
`;
}

export async function cmdInstallService() {
  const bin = process.env.IDE_BRIDGE_BIN ?? "ide-bridge";
  if (process.platform === "darwin") {
    const p = path.join(os.homedir(), "Library", "LaunchAgents", "com.ide-bridge.daemon.plist");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, renderLaunchdPlist(bin));
    console.log(`wrote ${p}\nload with: launchctl load ${p}`);
  } else if (process.platform === "linux") {
    const p = path.join(os.homedir(), ".config", "systemd", "user", "ide-bridge.service");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, renderSystemdUnit(bin));
    console.log(`wrote ${p}\nenable with: systemctl --user enable --now ide-bridge.service`);
  } else {
    throw new Error(`install-service not supported on ${process.platform}`);
  }
}
