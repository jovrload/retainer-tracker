import type { ReactNode } from "react";

/**
 * `info` (blue) is for the app explaining itself — methodology, caveats, what a
 * number doesn't tell you. Never for alerts (Part 1 §3).
 *
 * `critical` is the reserved red-strong state and this app grants it exactly
 * one meaning: every folder check failed, so nothing on screen can be trusted
 * (Part 2 §6). Using it for anything routine destroys it.
 */
export type BannerTone = "info" | "critical" | "neutral";

const TONE_CLASS: Record<BannerTone, string> = {
  info: "border-info-line bg-info-bg text-info",
  critical: "border-red-strong/25 bg-red-strong-bg text-red-strong",
  neutral: "border-line bg-surface-2 text-ink-2",
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "critical" ? "alert" : undefined}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${TONE_CLASS[tone]}`}
    >
      <div className="flex flex-col gap-0.5">
        {title && <span className="font-semibold">{title}</span>}
        {children && <span className="text-[13px] leading-snug">{children}</span>}
      </div>
      {action}
    </div>
  );
}
