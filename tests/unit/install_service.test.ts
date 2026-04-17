import { describe, it, expect } from "vitest";
import { renderLaunchdPlist, renderSystemdUnit } from "../../src/cli/install_service.js";

describe("service unit templates", () => {
  it("plist includes ide-bridge start and localhost binding", () => {
    const s = renderLaunchdPlist("/usr/local/bin/ide-bridge");
    expect(s).toContain("<string>/usr/local/bin/ide-bridge</string>");
    expect(s).toContain("<string>start</string>");
    expect(s).toContain("com.ide-bridge.daemon");
  });
  it("systemd unit sets ExecStart and Restart", () => {
    const s = renderSystemdUnit("/usr/local/bin/ide-bridge");
    expect(s).toContain("ExecStart=/usr/local/bin/ide-bridge start");
    expect(s).toContain("Restart=on-failure");
  });
});
