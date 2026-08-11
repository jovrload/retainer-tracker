/**
 * Loading renders a skeleton shaped like the real layout — never a spinner and
 * never a rendered zero (Part 1 Law 2). A zero is a real value and must only
 * ever mean zero.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-surface-2 ${className}`}
    />
  );
}

/** Eight rows, because the creator count is known before the data arrives. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-px" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-10" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
