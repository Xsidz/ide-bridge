"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Tools", href: "/docs/tools" },
  { label: "Changelog", href: "/changelog" },
  { label: "Contributing", href: "/contributing" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        backgroundColor: "#201d1d",
        borderBottom: "1px solid rgba(15, 0, 0, 0.12)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: "56px",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "0 24px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: "16px",
            color: "#fdfcfc",
            letterSpacing: "0.02em",
            textDecoration: "none",
          }}
        >
          [ide-bridge]
        </Link>

        {/* Desktop nav */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
          }}
          className="hidden sm:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontWeight: 500,
                fontSize: "16px",
                color: "#fdfcfc",
                textDecoration: "none",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLAnchorElement).style.textDecoration =
                  "underline";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLAnchorElement).style.textDecoration = "none";
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* GitHub link */}
          <a
            href="https://github.com/Xsidz/ide-bridge"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontWeight: 500,
              fontSize: "16px",
              color: "#9a9898",
              textDecoration: "none",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLAnchorElement).style.color = "#fdfcfc";
              (e.target as HTMLAnchorElement).style.textDecoration =
                "underline";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLAnchorElement).style.color = "#9a9898";
              (e.target as HTMLAnchorElement).style.textDecoration = "none";
            }}
          >
            GitHub →
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "none",
            border: "none",
            color: "#fdfcfc",
            cursor: "pointer",
            padding: "4px",
          }}
          className="sm:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay menu */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            top: "56px",
            backgroundColor: "#201d1d",
            zIndex: 49,
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
          className="sm:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                fontWeight: 500,
                fontSize: "16px",
                color: "#fdfcfc",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/Xsidz/ide-bridge"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              fontWeight: 500,
              fontSize: "16px",
              color: "#9a9898",
              textDecoration: "none",
            }}
          >
            GitHub →
          </a>
        </div>
      )}
    </header>
  );
}
