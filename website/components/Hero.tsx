import Link from "next/link";
import InstallBlock from "./InstallBlock";

const INSTALL_TABS = [
  { label: "npm", code: "npm install -g ide-bridge" },
  { label: "pnpm", code: "pnpm add -g ide-bridge" },
  { label: "yarn", code: "yarn global add ide-bridge" },
];

export default function Hero() {
  return (
    <section
      style={{
        backgroundColor: "#201d1d",
        padding: "80px 24px 96px",
        width: "100%",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* Eyebrow */}
        <p
          style={{
            fontSize: "14px",
            fontWeight: 400,
            color: "#9a9898",
            margin: "0 0 16px 0",
            lineHeight: 2,
            fontFamily: "inherit",
          }}
        >
          v0.1.0-alpha.0 · MIT · npm
        </p>

        {/* H1 */}
        <h1
          style={{
            fontSize: "2.375rem",
            fontWeight: 700,
            color: "#fdfcfc",
            margin: "0 0 16px 0",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        >
          Switch IDEs without losing your thread.
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "16px",
            fontWeight: 400,
            color: "#9a9898",
            margin: "0 0 40px 0",
            lineHeight: 1.5,
            maxWidth: "640px",
            fontFamily: "inherit",
          }}
        >
          ide-bridge is a local MCP daemon that saves a structured context
          bundle per project — plan, decisions, TODOs, git state, conversation
          summary. Any MCP-capable IDE can save to it or load from it.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "40px",
            alignItems: "center",
          }}
        >
          <Link
            href="/docs/install"
            style={{
              display: "inline-block",
              backgroundColor: "#fdfcfc",
              color: "#201d1d",
              fontWeight: 500,
              fontSize: "16px",
              fontFamily: "inherit",
              lineHeight: 2,
              padding: "4px 20px",
              borderRadius: "4px",
              textDecoration: "none",
              border: "1px solid #fdfcfc",
              transition: "background-color 0.1s, color 0.1s",
            }}
          >
            Get started
          </Link>
          <a
            href="https://github.com/Xsidz/ide-bridge"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              backgroundColor: "transparent",
              color: "#fdfcfc",
              fontWeight: 500,
              fontSize: "16px",
              fontFamily: "inherit",
              lineHeight: 2,
              padding: "4px 20px",
              borderRadius: "4px",
              textDecoration: "none",
              border: "1px solid #646262",
              transition: "border-color 0.1s, color 0.1s",
            }}
          >
            View on GitHub
          </a>
        </div>

        {/* Install block */}
        <div style={{ maxWidth: "480px" }}>
          <InstallBlock tabs={INSTALL_TABS} />
        </div>
      </div>
    </section>
  );
}
