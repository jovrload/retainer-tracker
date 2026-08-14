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
  /** Reserved for the single hero panel: soft elevation + a faint ground wash. */
  hero = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  accent?: CardAccent;
  interactive?: boolean;
  padded?: boolean;
  hero?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={[
        "rounded-2xl border border-line",
        hero
          ? "elevate bg-gradient-to-b from-surface to-surface-2/45"
          : "elevate-sm bg-surface",
        padded ? "p-5" : "",
        ACCENT_CLASS[accent],
        interactive
          ? "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-hover hover:shadow-[0_4px_16px_-4px_rgba(26,25,22,0.10)]"
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
