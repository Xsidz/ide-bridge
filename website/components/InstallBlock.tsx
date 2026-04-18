"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Tab {
  label: string;
  code: string;
}

interface InstallBlockProps {
  tabs: Tab[];
}

export default function InstallBlock({ tabs }: InstallBlockProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const code = tabs[activeTab]?.code ?? "";
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may be unavailable; silently ignore
    }
  };

  return (
    <div
      style={{
        border: "1px solid rgba(15, 0, 0, 0.12)",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(15, 0, 0, 0.12)",
          backgroundColor: "#201d1d",
        }}
      >
        {tabs.map((tab, idx) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(idx)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 16px",
              fontSize: "16px",
              fontWeight: 500,
              fontFamily: "inherit",
              lineHeight: 1,
              color: activeTab === idx ? "#fdfcfc" : "#9a9898",
              borderBottom:
                activeTab === idx
                  ? "2px solid #9a9898"
                  : "2px solid transparent",
              transition: "color 0.1s, border-color 0.1s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code area */}
      <div style={{ position: "relative", backgroundColor: "#302c2c" }}>
        <pre
          style={{
            margin: 0,
            padding: "24px",
            backgroundColor: "#302c2c",
            color: "#fdfcfc",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: 1.6,
            overflowX: "auto",
            borderRadius: 0,
          }}
        >
          <code>{tabs[activeTab]?.code ?? ""}</code>
        </pre>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "none",
            border: "1px solid rgba(15, 0, 0, 0.12)",
            borderRadius: "4px",
            cursor: "pointer",
            padding: "4px 8px",
            color: copied ? "#30d158" : "#9a9898",
            fontFamily: "inherit",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "color 0.1s",
          }}
          aria-label="Copy to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
