import type { ReactNode } from "react";

/**
 * "Never had data", "filtered to zero" and "not yet wired up" are three
 * different facts about the world and get different copy (Part 1 §7). Shared
 * dashed-border family so they read as the same kind of absence.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-hover bg-surface-2/60 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <p className="max-w-sm text-[13px] leading-snug text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
