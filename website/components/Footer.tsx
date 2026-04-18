import Link from "next/link";

const COLUMNS = [
  {
    heading: "ide-bridge",
    tagline: "Cross-IDE context portability over MCP.",
    links: [{ label: "ide-bridge.dev", href: "https://www.ide-bridge.dev" }],
  },
  {
    heading: "Product",
    tagline: null,
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Install", href: "/docs/install" },
      { label: "Tools", href: "/docs/tools" },
      { label: "Adapters", href: "/docs/adapters" },
    ],
  },
  {
    heading: "Community",
    tagline: null,
    links: [
      { label: "GitHub", href: "https://github.com/Xsidz/ide-bridge" },
      {
        label: "Issues",
        href: "https://github.com/Xsidz/ide-bridge/issues",
      },
      {
        label: "Discussions",
        href: "https://github.com/Xsidz/ide-bridge/discussions",
      },
      { label: "Contributing", href: "/contributing" },
    ],
  },
  {
    heading: "Legal",
    tagline: null,
    links: [
      {
        label: "License",
        href: "https://github.com/Xsidz/ide-bridge/blob/main/LICENSE",
      },
      {
        label: "Security",
        href: "https://github.com/Xsidz/ide-bridge/blob/main/SECURITY.md",
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="footer-root">
      <style>{`
        .footer-root {
          background-color: #201d1d;
          border-top: 1px solid rgba(15, 0, 0, 0.12);
          padding: 48px 24px 32px;
        }
        .footer-link {
          font-size: 14px;
          color: #9a9898;
          text-decoration: none;
          font-weight: 400;
          transition: color 0.1s;
        }
        .footer-link:hover {
          color: #fdfcfc;
        }
        .footer-bottom-link {
          font-size: 14px;
          color: #9a9898;
          text-decoration: none;
          transition: color 0.1s;
        }
        .footer-bottom-link:hover {
          color: #fdfcfc;
        }
      `}</style>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        {/* Column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "40px",
            marginBottom: "40px",
          }}
        >
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "#fdfcfc",
                  margin: "0 0 8px 0",
                  lineHeight: 1.5,
                }}
              >
                {col.heading}
              </p>
              {col.tagline && (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#9a9898",
                    margin: "0 0 12px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {col.tagline}
                </p>
              )}
              {col.links.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {col.links.map((link) => (
                    <li key={link.href} style={{ marginBottom: "8px" }}>
                      <Link href={link.href} className="footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div
          style={{
            borderTop: "1px solid rgba(15, 0, 0, 0.12)",
            paddingTop: "24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "14px", color: "#6e6e73" }}>
            &copy; {new Date().getFullYear()} ide-bridge contributors. MIT
            License.
          </span>
          <div
            style={{ display: "flex", gap: "16px", alignItems: "center" }}
          >
            <span
              style={{
                fontSize: "14px",
                color: "#6e6e73",
                fontFamily: "inherit",
              }}
            >
              v0.1.0-alpha.0
            </span>
            <Link href="/changelog" className="footer-bottom-link">
              Changelog
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
