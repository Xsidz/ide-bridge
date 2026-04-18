"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Getting started",
    items: [
      { label: "Overview", href: "/docs" },
      { label: "Install", href: "/docs/install" },
      { label: "Quickstart", href: "/docs/quickstart" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Configuration", href: "/docs/configuration" },
      { label: "MCP tools", href: "/docs/tools" },
      { label: "Adapters", href: "/docs/adapters" },
      { label: "Hooks", href: "/docs/hooks" },
    ],
  },
  {
    title: "Help",
    items: [{ label: "Troubleshooting", href: "/docs/troubleshooting" }],
  },
];

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-6 py-6 px-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-[12px] font-bold text-[#fdfcfc] uppercase tracking-widest">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive =
                item.href === "/docs"
                  ? pathname === "/docs"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      "block rounded-[4px] py-1.5 pl-3 pr-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-l-2 border-[#9a9898] pl-[10px] text-[#fdfcfc]"
                        : "border-l-2 border-transparent text-[#9a9898] hover:text-[#fdfcfc]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <div className="flex items-center justify-between border-b border-[rgba(15,0,0,0.12)] px-4 py-3 md:hidden">
        <span className="text-xs font-bold text-[#9a9898] uppercase tracking-widest">
          Docs menu
        </span>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close docs menu" : "Open docs menu"}
          className="rounded-[4px] border border-[rgba(15,0,0,0.12)] px-3 py-1 text-xs text-[#9a9898] hover:text-[#fdfcfc]"
        >
          {mobileOpen ? "close" : "menu"}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-b border-[rgba(15,0,0,0.12)] md:hidden">
          <SidebarContent pathname={pathname ?? ""} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 overflow-y-auto border-r border-[rgba(15,0,0,0.12)] md:block">
        <SidebarContent pathname={pathname ?? ""} />
      </aside>
    </>
  );
}
