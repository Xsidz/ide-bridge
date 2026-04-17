import { describe, it, expect } from "vitest";
import { storeRoot, projectDir, configPath } from "../../src/util/paths.js";

describe("paths", () => {
  it("storeRoot ends with .ide-bridge", () => {
    expect(storeRoot()).toMatch(/\.ide-bridge$/);
  });
  it("projectDir places projects under storeRoot/projects", () => {
    expect(projectDir("my-proj")).toMatch(/\.ide-bridge\/projects\/my-proj$/);
  });
  it("configPath is storeRoot/config.json", () => {
    expect(configPath()).toMatch(/\.ide-bridge\/config\.json$/);
  });
});
