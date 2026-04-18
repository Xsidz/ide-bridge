interface Stat {
  value: string;
  label: string;
}

interface StatsBlockProps {
  stats: Stat[];
}

export default function StatsBlock({ stats }: StatsBlockProps) {
  return (
    <div
      style={{
        backgroundColor: "#302c2c",
        border: "1px solid rgba(15, 0, 0, 0.12)",
        borderRadius: "4px",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "32px",
          textAlign: "center",
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <p
              style={{
                fontSize: "2.375rem",
                fontWeight: 700,
                color: "#fdfcfc",
                margin: "0 0 8px 0",
                lineHeight: 1.2,
                fontFamily: "inherit",
              }}
            >
              {stat.value}
            </p>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: "#9a9898",
                margin: 0,
                lineHeight: 2,
                fontFamily: "inherit",
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
