import type { ReactNode } from "react";

/**
 * Small inline flags. The two this app uses carry different weights (Part 2 §5):
 *
 * - `neutral` for "late" — informational, not a failure. The video is in and it
 *   counts; there is nothing for the reader to solve, so red would be a lie.
 * - `amber` for "possible duplicate" — an ambiguous signal asking for a human
 *   judgement, which is exactly what amber is for.
 */
export type TagTone = "neutral" | "amber";

const TONE_CLASS: Record<TagTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  amber: "bg-amber-bg text-amber",
};

export function Tag({
  tone = "neutral",
  children,
  title,
}: {
  tone?: TagTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
