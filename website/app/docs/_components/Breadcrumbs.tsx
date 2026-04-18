"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/docs": "Overview",
  "/docs/install": "Install",
  "/docs/quickstart": "Quickstart",
  "/docs/configuration": "Configuration",
  "/docs/tools": "MCP tools",
  "/docs/adapters": "Adapters",
  "/docs/hooks": "Hooks",
  "/docs/troubleshooting": "Troubleshooting",
};

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/docs";
  const title = TITLE_MAP[pathname] ?? "Docs";

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs text-[#9a9898]"
    >
      <Link href="/docs" className="hover:text-[#fdfcfc] transition-colors">
        Docs
      </Link>
      {pathname !== "/docs" && (
        <>
          <span>/</span>
          <span className="text-[#fdfcfc]">{title}</span>
        </>
      )}
    </nav>
  );
}
