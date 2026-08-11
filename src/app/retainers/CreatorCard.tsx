import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tag } from "@/components/ui/Tag";
import { BriefDots } from "./BriefDots";
import { formatLondonTime, formatRelativeTime, NULL_DASH } from "@/lib/format";
import { BRIEFS_PER_WEEK, STATUS_EXPLAINER } from "@/lib/status";
import type { CreatorRow } from "./types";

/**
 * The mobile view (Part 2 §8). Below 768px the table is not squeezed — five
 * columns crushed into 375px is unreadable and the tap targets fail. One card
 * per creator instead, in the same sort order, because there is no peripheral
 * vision on a phone and whoever needs chasing has to be at the top.
 */
export function CreatorCard({
  row,
  weekId,
  isClosedWeek,
  now,
  index,
}: {
  row: CreatorRow;
  weekId: number;
  isClosedWeek: boolean;
  now: Date;
  index: number;
}) {
  return (
    <Card
      className="animate-card-in"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.name}</p>
            <p className="truncate text-[13px] text-ink-2">@{row.handle}</p>
          </div>
          <StatusPill
            status={row.status}
            qualified={row.status === "complete" && row.hasDuplicate}
            title={row.errorMessage ?? STATUS_EXPLAINER[row.status]}
          />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Delivered
            </p>
            {row.delivered === null ? (
              <p
                className="hero-num mt-1 text-2xl text-ink-3"
                title={row.errorMessage ?? "The folder check failed, so the count is unknown."}
              >
                {NULL_DASH}
              </p>
            ) : (
              <p className="hero-num mt-1 text-2xl text-ink">
                {row.delivered}
                <span className="text-base font-medium text-ink-3">/{BRIEFS_PER_WEEK}</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Briefs sent
            </p>
            <div className="mt-1 flex justify-end">
              <BriefDots
                weekId={weekId}
                creatorId={row.creatorId}
                initialTicked={row.briefsTicked}
                isClosedWeek={isClosedWeek}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3 text-[13px] text-ink-2">
          <span title={formatLondonTime(row.lastUpload)}>
            Last upload: {formatRelativeTime(row.lastUpload, now)}
          </span>
          {row.anyLate && <Tag title="Landed after the Sunday 23:59 deadline. It still counts.">late</Tag>}
          {row.hasDuplicate && (
            <Tag
              tone="amber"
              title="Two videos this week have an identical file size, which usually means the same export was uploaded twice. Worth a look, not a verdict."
            >
              possible duplicate
            </Tag>
          )}
        </div>
      </div>
    </Card>
  );
}
