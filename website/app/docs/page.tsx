import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation — ide-bridge",
  description:
    "Everything you need to know about ide-bridge: installation, configuration, MCP tools, and adapters.",
};

interface DocCard {
  title: string;
  description: string;
  href: string;
  cta: string;
}

const CARDS: DocCard[] = [
  {
    title: "Getting started",
    description:
      "Install the daemon, initialize your project, and run your first cross-IDE handoff in under 10 minutes.",
    href: "/docs/install",
    cta: "Start with Install →",
  },
  {
    title: "Reference",
    description:
      "Full reference for all 6 MCP tools, the .ide-bridge.yaml config file, environment variables, and per-IDE adapters.",
    href: "/docs/tools",
    cta: "Browse MCP tools →",
  },
  {
    title: "Help",
    description:
      'Common errors, path conflicts, fidelity mismatches, and the "checkpoint saved but not visible" class of problems.',
    href: "/docs/troubleshooting",
    cta: "Troubleshooting →",
  },
];

export default function DocsPage() {
  return (
    <>
      <h1>Documentation</h1>

      <p>
        ide-bridge is a local MCP daemon that stores a{" "}
        <strong>Portable Context Bundle</strong> per project and exposes six
        MCP tools. Any supported agentic IDE can save to or load from the bundle
        — so when you switch IDEs mid-task, the next agent turn starts already
        knowing what you were doing and why.
      </p>

      {/* Three-column card grid */}
      <div className="not-prose mt-8 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group block rounded-[4px] border border-[rgba(15,0,0,0.12)] bg-[#302c2c] p-6 transition-colors hover:border-[#646262]"
          >
            <p className="mb-2 text-sm font-bold text-[#fdfcfc]">{card.title}</p>
            <p className="mb-4 text-xs leading-[1.5] text-[#9a9898]">
              {card.description}
            </p>
            <span className="text-xs font-medium text-[#007aff]">
              {card.cta}
            </span>
          </Link>
        ))}
      </div>

      <hr className="my-10" />

      <h2>What&apos;s in the bundle?</h2>

      <p>
        Every ide-bridge project stores a single versioned JSON document called
        the <strong>Portable Context Bundle (PCB)</strong>. It contains
        everything an agent needs to resume work: plan steps, decisions with
        rationale, open TODOs, git state (remote, branch, HEAD, diffs), and a
        rolling conversation summary. When the source IDE supports it, the last
        N verbatim turns are included too.
      </p>

      <p>
        The daemon deep-merges incoming bundle fragments on every{" "}
        <code>save_checkpoint</code> call — arrays are appended, decisions and
        TODOs are deduplicated by ID, and writes are atomic (write-then-rename).
        The full schema and all six tools are documented in{" "}
        <Link href="/docs/tools">MCP tools</Link>.
      </p>

      <h2>Supported fidelity levels</h2>

      <p>
        Different IDEs can produce and consume different amounts of context.
        ide-bridge calls this the <em>fidelity level</em>:
      </p>

      <ul>
        <li>
          <strong>L0</strong> — plan steps, decisions, TODOs, git state
        </li>
        <li>
          <strong>L1</strong> — L0 + rolling conversation summary
        </li>
        <li>
          <strong>L2</strong> — L1 + last-N verbatim turns
        </li>
        <li>
          <strong>L3</strong> — full session resume (Claude Code only)
        </li>
      </ul>

      <p>
        The daemon automatically picks{" "}
        <code>min(source_fidelity, target_fidelity)</code> on every handoff. See{" "}
        <Link href="/docs/adapters">Adapters</Link> for the fidelity cap of each
        IDE.
      </p>

      <p className="mt-10">
        <strong>Next:</strong>{" "}
        <Link href="/docs/install">Install →</Link>
      </p>
    </>
  );
}
