import { Check } from "lucide-react";

interface Feature {
  name: string;
  description: string;
}

interface FeatureListProps {
  features: Feature[];
}

export default function FeatureList({ features }: FeatureListProps) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        maxWidth: "800px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {features.map((feature) => (
        <li
          key={feature.name}
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              marginTop: "2px",
              color: "#30d158",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Check size={16} strokeWidth={2.5} />
          </span>
          <span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "#fdfcfc",
                lineHeight: 1.5,
              }}
            >
              {feature.name}
            </span>
            {feature.description && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: "16px",
                  color: "#9a9898",
                  lineHeight: 1.5,
                }}
              >
                {" "}
                {feature.description}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
