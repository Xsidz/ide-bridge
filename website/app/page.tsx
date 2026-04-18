import Link from "next/link";
import Hero from "@/components/Hero";
import FeatureList from "@/components/FeatureList";
import StatsBlock from "@/components/StatsBlock";
import InstallBlock from "@/components/InstallBlock";

/* ─── Section wrapper ─────────────────────────────────────────── */
function Section({
  children,
  narrow = false,
  style,
}: {
  children: React.ReactNode;
  narrow?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        padding: "80px 24px",
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: narrow ? "720px" : "960px",
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ─── Section heading ─────────────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "16px",
        fontWeight: 700,
        color: "#fdfcfc",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "0 0 32px 0",
        lineHeight: 1.5,
        fontFamily: "inherit",
      }}
    >
      {children}
    </h2>
  );
}

/* ─── Data ─────────────────────────────────────────────────────── */
const FEATURES = [
  {
    name: "Zero cloud.",
    description:
      "The daemon binds to 127.0.0.1 only — no network egress, no accounts, no API keys.",
  },
  {
    name: "5 native IDE adapters.",
    description:
      "Claude Code (L3), Cursor (L2), Kiro (L1), Antigravity (L0–L1), and a generic L0 fallback for any MCP-capable IDE.",
  },
  {
    name: "6-tool MCP surface.",
    description:
      "save_checkpoint, load_checkpoint, append_decision, append_todo, list_projects, get_project_id — minimal by design to keep context-window overhead low.",
  },
  {
    name: "Atomic PCB store.",
    description:
      "Every write is a write-then-rename. The bundle is always in a consistent state, with an append-only history log alongside it.",
  },
  {
    name: "Hook-driven autosave.",
    description:
      "Claude Code gets a SessionStart hook (load on startup) and a PreCompact hook (save before context is compacted). Zero manual prompts required.",
  },
  {
    name: "3-tier project identity.",
    description:
      "Project ID resolved in order: explicit .ide-bridge.yaml → git remote+branch → path fingerprint. The checked-in YAML always wins.",
  },
  {
    name: "Graceful fidelity degradation.",
    description:
      "Daemon picks min(source_fidelity, target_fidelity) automatically. Switching from L3 to L1 never crashes — it just drops verbatim turns.",
  },
  {
    name: "Service installer.",
    description:
      "launchd (macOS) and systemd --user (Linux) unit files so the daemon restarts automatically at login.",
  },
  {
    name: "Port conflict resolution.",
    description:
      "If :31415 is taken, the daemon probes :31416–:31425 and writes the chosen port to config.json. Nothing breaks.",
  },
  {
    name: "TypeScript strict throughout.",
    description:
      "noUncheckedIndexedAccess enabled. 61 passing tests, typecheck clean, zero dead code.",
  },
];

const STATS = [
  { value: "61", label: "passing tests" },
  { value: "5", label: "native IDE adapters" },
  { value: "6", label: "MCP tools" },
  { value: "0", label: "cloud dependencies" },
];

const INSTALL_TABS = [
  { label: "npm", code: "npm install -g ide-bridge" },
  { label: "pnpm", code: "pnpm add -g ide-bridge" },
  { label: "yarn", code: "yarn global add ide-bridge" },
];

const PROJECT_CODE = `ide-bridge init && ide-bridge priming claude-code`;

const ASCII_DIAGRAM = `┌─ Claude Code ─┐  ┌─ Cursor ─┐  ┌─ Kiro ─┐  ┌─ Antigravity ─┐  ┌─ Any MCP IDE ─┐
│  CLAUDE.md    │  │ .cursor/ │  │ .kiro/ │  │   AGENTS.md   │  │   AGENTS.md   │
│  Stop hook    │  │  rules/  │  │ steer/ │  │   priming     │  │  (generic)    │
└──────┬────────┘  └────┬─────┘  └───┬────┘  └───────┬───────┘  └───────┬───────┘
       │          MCP Streamable HTTP │               │                  │
       └──────────────────────────────┴───────────────┴──────────────────┘
                                      │
                           http://localhost:31415/mcp
                                      │
                         ┌────────────▼────────────┐
                         │     ide-bridge daemon    │
                         │                          │
                         │  6-tool MCP surface      │
                         │  Per-IDE adapters        │
                         │  PCB store               │
                         │  Identity resolver       │
                         └────────────┬─────────────┘
                                      │
                         ~/.ide-bridge/
                           projects/<project-id>/
                             bundle.json        ← PCB (authoritative)
                             history/           ← append-only log
                             transcripts/<ide>/ ← raw per-IDE transcripts
                           config.json
                           daemon.log`;

const SUPPORTED_IDES = [
  {
    ide: "Claude Code",
    fidelity: "L3 (full session resume)",
    source: "~/.claude/projects/<encoded-cwd>/*.jsonl",
    sink: "Synthesized JSONL + claude --resume",
  },
  {
    ide: "Cursor",
    fidelity: "L2 (last-N verbatim turns)",
    source: "state.vscdb in Cursor's workspaceStorage",
    sink: ".cursor/rules/_imported.mdc primer",
  },
  {
    ide: "Kiro",
    fidelity: "L1 (rolling summary)",
    source: ".kiro/steering/*, .kiro/specs/*",
    sink: ".kiro/steering/_imported.md",
  },
  {
    ide: "Antigravity",
    fidelity: "L0–L1",
    source: "AGENTS.md + bridge-captured plan/decisions",
    sink: 'AGENTS.md with "Prior context" block',
  },
  {
    ide: "Generic",
    fidelity: "L0 (plan + decisions + TODOs + git)",
    source: "Agent-driven saves only",
    sink: 'AGENTS.md with "Prior context" block',
  },
];

const ROADMAP = [
  {
    version: "v0.1",
    status: "shipped",
    summary:
      "Context portability across Claude Code, Cursor, Kiro, Antigravity, and generic fallback. Local-only, zero auth. CLI, priming files, launchd/systemd installers.",
  },
  {
    version: "v0.1.x",
    status: "next",
    summary:
      "Cursor per-database resilience. initialize tool coverage. L3 forged-resume verification test. negotiateFidelity wiring between adapters.",
  },
  {
    version: "v0.2",
    status: "planned",
    summary:
      "Remote sync (--remote <url>, Postgres-backed store). Disk-tailer rescue mode. Secret redaction MVP. Self-host Docker image.",
  },
  {
    version: "v1.0",
    status: "future",
    summary:
      "Multi-IDE role orchestration over A2A. CrewAI-style YAML config. Presence channel, file leases, HITL states. Managed SaaS with auth + dashboard.",
  },
];

const STATUS_COLORS: Record<string, string> = {
  shipped: "#30d158",
  next: "#ff9f0a",
  planned: "#9a9898",
  future: "#6e6e73",
};

/* ─── Page ─────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <Hero />

      {/* 2. The problem */}
      <Section narrow style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}>
        <SectionHeading>The problem</SectionHeading>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <p
            style={{
              fontSize: "16px",
              color: "#fdfcfc",
              lineHeight: 1.5,
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            Agentic IDEs impose per-tool or per-session usage limits. When you
            hit one mid-task — branch half-refactored, plan half-executed — you
            have two options: wait, or switch. Switching means opening a
            different IDE and spending the first several turns re-explaining the
            plan, the constraints, the decisions already made, and the work
            already done. None of that information has anywhere to live except
            inside a single IDE&apos;s conversation history.
          </p>
          <p
            style={{
              fontSize: "16px",
              color: "#9a9898",
              lineHeight: 1.5,
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            The context loss compounds. The rolling summary in your head is
            lossy. You forget the decision you made three hours ago that rules
            out the obvious approach. The new agent re-proposes it. You spend
            another exchange saying no, and explaining why, again. This is a
            single-user problem today — and a team problem in its near-future
            form.
          </p>
        </div>
      </Section>

      {/* 3. The solution */}
      <Section narrow style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}>
        <SectionHeading>The solution</SectionHeading>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              fontSize: "16px",
              color: "#fdfcfc",
              lineHeight: 1.5,
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            ide-bridge is a local daemon that speaks MCP Streamable HTTP and
            binds exclusively to{" "}
            <code
              style={{
                backgroundColor: "#302c2c",
                padding: "1px 6px",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              localhost:31415
            </code>
            . Every connected IDE addresses the same six-tool surface. When an
            agent calls{" "}
            <code
              style={{
                backgroundColor: "#302c2c",
                padding: "1px 6px",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              save_checkpoint
            </code>
            , the daemon merges the incoming bundle fragment into a Portable
            Context Bundle (PCB) stored under{" "}
            <code
              style={{
                backgroundColor: "#302c2c",
                padding: "1px 6px",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            >
              ~/.ide-bridge/projects/
            </code>
            .
          </p>
          <p
            style={{
              fontSize: "16px",
              color: "#9a9898",
              lineHeight: 1.5,
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            The PCB is a single versioned JSON document: plan steps, decisions
            with rationale, TODOs, git state (remote, branch, HEAD, staged and
            unstaged diffs), a rolling conversation summary, and — where the
            source IDE supports it — the last N verbatim turns. Five per-IDE
            adapters handle structural differences between IDEs; a generic
            fallback covers any MCP-capable IDE not explicitly listed.
          </p>
        </div>

        {/* ASCII diagram */}
        <pre
          style={{
            backgroundColor: "#302c2c",
            border: "1px solid rgba(15, 0, 0, 0.12)",
            borderRadius: "4px",
            padding: "24px",
            overflowX: "auto",
            fontSize: "11px",
            lineHeight: 1.6,
            color: "#9a9898",
            fontFamily: "inherit",
            margin: 0,
          }}
        >
          <code style={{ fontFamily: "inherit" }}>{ASCII_DIAGRAM}</code>
        </pre>
      </Section>

      {/* 4. Features */}
      <Section
        narrow
        style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}
      >
        <SectionHeading>Features</SectionHeading>
        <FeatureList features={FEATURES} />
      </Section>

      {/* 5. Supported IDEs */}
      <Section style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}>
        <SectionHeading>Supported IDEs</SectionHeading>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          >
            <thead>
              <tr>
                {["IDE", "Fidelity", "Extract source", "Import sink"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        fontWeight: 700,
                        fontSize: "14px",
                        color: "#fdfcfc",
                        padding: "8px 16px 8px 0",
                        borderBottom: "2px solid #9a9898",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_IDES.map((row, i) => (
                <tr
                  key={row.ide}
                  style={{
                    borderBottom:
                      i < SUPPORTED_IDES.length - 1
                        ? "1px solid rgba(15, 0, 0, 0.12)"
                        : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px 12px 0",
                      color: "#fdfcfc",
                      fontWeight: 500,
                      fontFamily: "inherit",
                    }}
                  >
                    {row.ide}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px 12px 0",
                      color: "#9a9898",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.fidelity}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px 12px 0",
                      color: "#9a9898",
                      fontFamily: "inherit",
                      fontSize: "12px",
                    }}
                  >
                    <code style={{ fontFamily: "inherit" }}>{row.source}</code>
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      color: "#9a9898",
                      fontFamily: "inherit",
                      fontSize: "12px",
                    }}
                  >
                    <code style={{ fontFamily: "inherit" }}>{row.sink}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "#6e6e73",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        >
          Any MCP-capable IDE not listed above gets the generic L0 adapter via
          a priming AGENTS.md. Fidelity levels: L0 = plan + decisions + TODOs +
          git. L1 = L0 + rolling summary. L2 = L1 + last-N verbatim turns. L3 =
          full session resume.
        </p>
      </Section>

      {/* 6. Install */}
      <Section style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}>
        <SectionHeading>Install</SectionHeading>
        <div style={{ maxWidth: "600px" }}>
          <InstallBlock tabs={INSTALL_TABS} />
          <p
            style={{
              marginTop: "24px",
              marginBottom: "8px",
              fontSize: "14px",
              color: "#9a9898",
              fontFamily: "inherit",
            }}
          >
            Then in your project:
          </p>
          <div
            style={{
              backgroundColor: "#302c2c",
              border: "1px solid rgba(15, 0, 0, 0.12)",
              borderRadius: "4px",
              padding: "24px",
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: "inherit",
                fontSize: "14px",
                color: "#fdfcfc",
                lineHeight: 1.6,
              }}
            >
              <code>{PROJECT_CODE}</code>
            </pre>
          </div>
        </div>
      </Section>

      {/* 7. Stats */}
      <Section style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}>
        <SectionHeading>By the numbers</SectionHeading>
        <StatsBlock stats={STATS} />
      </Section>

      {/* 8. Roadmap */}
      <Section
        narrow
        style={{ borderTop: "1px solid rgba(15, 0, 0, 0.12)" }}
      >
        <SectionHeading>Roadmap</SectionHeading>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {ROADMAP.map((item, idx) => (
            <div
              key={item.version}
              style={{
                display: "flex",
                gap: "24px",
                paddingBottom: idx < ROADMAP.length - 1 ? "32px" : "0",
                position: "relative",
              }}
            >
              {/* Timeline line */}
              {idx < ROADMAP.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "55px",
                    top: "24px",
                    bottom: "0",
                    width: "1px",
                    backgroundColor: "rgba(15, 0, 0, 0.12)",
                  }}
                />
              )}

              {/* Version badge */}
              <div
                style={{
                  flexShrink: 0,
                  width: "80px",
                  paddingTop: "2px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "12px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    color: STATUS_COLORS[item.status] ?? "#9a9898",
                    border: `1px solid ${STATUS_COLORS[item.status] ?? "#9a9898"}`,
                    borderRadius: "4px",
                    padding: "2px 8px",
                    lineHeight: 1.5,
                  }}
                >
                  {item.version}
                </span>
              </div>

              {/* Description */}
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "#6e6e73",
                    fontFamily: "inherit",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {item.status}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "#9a9898",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                  }}
                >
                  {item.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 9. Closing CTA */}
      <Section
        narrow
        style={{
          borderTop: "1px solid rgba(15, 0, 0, 0.12)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "16px",
            color: "#9a9898",
            lineHeight: 1.5,
            margin: "0 0 32px 0",
            fontFamily: "inherit",
          }}
        >
          Star the repo if this solves something you&apos;ve hit.
          <br />
          Contributions even more so.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
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
              transition: "border-color 0.1s",
            }}
          >
            Star on GitHub
          </a>
          <Link
            href="/docs"
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
              transition: "background-color 0.1s",
            }}
          >
            Read the docs
          </Link>
        </div>
      </Section>
    </>
  );
}
