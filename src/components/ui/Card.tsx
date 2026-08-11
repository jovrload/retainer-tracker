import type { ReactNode } from "react";

/** Meaning-colour on a container is sanctioned only here: a 2px top border
 *  on a single hero panel (Part 1 §3). */
export type CardAccent = "none" | "green" | "amber" | "red" | "neutral";

const ACCENT_CLASS: Record<CardAccent, string> = {
  none: "",
  green: "border-t-2 border-t-green-strong",
  amber: "border-t-2 border-t-amber",
  red: "border-t-2 border-t-red-mid",
  neutral: "border-t-2 border-t-line-hover",
};

export function Card({
  children,
  className = "",
  accent = "none",
  interactive = false,
  padded = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  accent?: CardAccent;
  interactive?: boolean;
  padded?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={[
        "rounded-2xl border border-line bg-surface",
        padded ? "p-5" : "",
        ACCENT_CLASS[accent],
        // Depth never comes from stacked shadows — only interactive cards lift.
        interactive
          ? "transition-[border-color,box-shadow] duration-150 hover:border-line-hover hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
