import type { MetadataRoute } from "next";

const BASE = "https://www.ide-bridge.dev";

const STATIC_PATHS = [
  "/",
  "/docs",
  "/docs/install",
  "/docs/quickstart",
  "/docs/configuration",
  "/docs/tools",
  "/docs/adapters",
  "/docs/hooks",
  "/docs/troubleshooting",
  "/changelog",
  "/contributing",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1.0 : 0.7,
  }));
}
