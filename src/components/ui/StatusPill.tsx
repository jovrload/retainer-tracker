import { STATUS_LABEL, type StatusKind } from "@/lib/status";

/**
 * Colour is never the only carrier (Part 1 Law 3, Part 2 §12): every pill
 * carries its word, and `unknown` additionally carries a warning glyph
 * because someone has to act on it.
 *
 * `unknown` is neutral and outlined, not a traffic light — the data isn't
 * bad, it's absent.
 */
const PILL_CLASS: Record<StatusKind, string> = {
  unknown: "border border-line-hover bg-surface text-ink-2",
  outstanding: "bg-red-mid-bg text-red-mid ring-1 ring-inset ring-red-mid/15",
  behind: "bg-amber-bg text-amber ring-1 ring-inset ring-amber/15",
  ontrack: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-ink/[0.06]",
  complete: "bg-green-strong-bg text-green-strong ring-1 ring-inset ring-green-strong/15",
};

export function StatusPill({
  status,
  qualified = false,
  title,
}: {
  status: StatusKind;
  /** A "Complete" that sits on a duplicate flag shouldn't read fully confident. */
  qualified?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${PILL_CLASS[status]}`}
    >
      {status === "unknown" && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="shrink-0"
          fill="currentColor"
        >
          <path d="M6 0.6 11.4 10.5H0.6L6 0.6Z" opacity="0.18" />
          <path d="M6 1.7 10.5 9.9H1.5L6 1.7Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <rect x="5.4" y="4.4" width="1.2" height="2.9" rx="0.6" />
          <rect x="5.4" y="8" width="1.2" height="1.2" rx="0.6" />
        </svg>
      )}
      {STATUS_LABEL[status]}
      {qualified && <span aria-hidden="true">*</span>}
    </span>
  );
}
