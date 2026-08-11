import type { ReactNode } from "react";

/**
 * Owns the heading-to-content relationship (Part 1 §5).
 *
 * A heading must sit closer to its own content than to the block above it. In
 * a flex column with a single gap every sibling pair gets the same spacing, so
 * a heading ends up equidistant and reads as belonging to neither. The parent
 * sets the gap *between* sections (24px); this component sets the smaller gap
 * between a heading and its content. Never faked with negative margins.
 */
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasHeading = Boolean(title || description || action);

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      {hasHeading && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <div className="text-sm text-ink-2">{description}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
