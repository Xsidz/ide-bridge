import type { NextConfig } from "next";
import rehypePrettyCode from "rehype-pretty-code";
import path from "path";

/**
 * Manual MDX wiring that works with both Turbopack (dev) and webpack (build).
 *
 * @next/mdx injects loader options that Turbopack cannot serialize when
 * rehypePlugins contain function references. We therefore configure the
 * webpack path ourselves (with full rehype pipeline) and use Turbopack's
 * native mdxRs compiler for dev — which doesn't support rehype plugins but
 * gives fast HMR. Syntax highlighting is always present in production builds.
 */

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // Turbopack (next dev): use built-in Rust MDX compiler — no rehype plugins,
  // but fast HMR. Rehype syntax highlighting applies in webpack (next build).
  experimental: {
    mdxRs: true,
  },
  turbopack: {
    // Silence "multiple lockfiles" warning — website/ is a standalone sub-project
    // inside a monorepo-style root. Explicitly set root to this directory.
    root: __dirname,
    resolveAlias: {
      // Required by @next/mdx to resolve the MDX components file
      "next-mdx-import-source-file": "@vercel/turbopack-next/mdx-import-source",
    },
  },
  webpack(config) {
    // Override Turbopack-injected MDX rule with a webpack-safe version that
    // includes the full rehype pipeline.
    config.module.rules.push({
      test: /\.mdx?$/,
      use: [
        {
          loader: require.resolve("@mdx-js/loader"),
          options: {
            providerImportSource: "next-mdx-import-source-file",
            remarkPlugins: [],
            rehypePlugins: [[rehypePrettyCode, { theme: "github-dark-dimmed" }]],
          },
        },
      ],
    });

    // Resolve the MDX components file for webpack builds
    config.resolve.alias = {
      ...config.resolve.alias,
      "next-mdx-import-source-file": [
        path.resolve(process.cwd(), "src/mdx-components"),
        path.resolve(process.cwd(), "mdx-components"),
        "@mdx-js/react",
      ],
    };

    return config;
  },
};

export default nextConfig;
