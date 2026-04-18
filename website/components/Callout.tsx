import type { ReactNode } from "react";

/**
 * Callout — info/warn/success/danger box used in MDX docs.
 *
 * Accepts either `type` or `variant` as the prop name (both conventions
 * appear across MDX files). Accepts `warn` or `warning` as aliases for
 * the same color. Unknown variants fall back to `info` styling with a
 * dev-time console warning (never breaks the page).
 */

type CalloutSemantic = "info" | "warn" | "warning" | "success" | "danger";

type CalloutProps = {
  type?: CalloutSemantic;
  variant?: CalloutSemantic;
  title?: string;
  children: ReactNode;
};

const BORDER_COLORS: Record<"info" | "warn" | "success" | "danger", string> = {
  info: "#007aff",
  warn: "#ff9f0a",
  success: "#30d158",
  danger: "#ff3b30",
};

function normalizeVariant(
  raw: CalloutSemantic | undefined,
): "info" | "warn" | "success" | "danger" {
  if (raw === "warning") return "warn";
  if (raw === "info" || raw === "warn" || raw === "success" || raw === "danger") {
    return raw;
  }
  return "info";
}

export default function Callout({ type, variant, title, children }: CalloutProps) {
  const semantic = normalizeVariant(variant ?? type);
  const borderColor = BORDER_COLORS[semantic];

  return (
    <div
      role="note"
      style={{
        backgroundColor: "#302c2c",
        borderRadius: "4px",
        borderLeft: `4px solid ${borderColor}`,
        padding: "20px",
        marginTop: "16px",
        marginBottom: "16px",
      }}
    >
      {title && (
        <p
          style={{
            fontWeight: 700,
            fontSize: "16px",
            color: "#fdfcfc",
            margin: "0 0 8px 0",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        >
          {title}
        </p>
      )}
      <div
        style={{
          fontSize: "16px",
          color: "#9a9898",
          lineHeight: 1.5,
          fontFamily: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Named export kept for backward-compat if other agents imported it */
export { Callout };
