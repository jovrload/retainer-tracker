import { Tag } from "@/components/ui/Tag";
import { NULL_DASH } from "@/lib/format";
import type { CreatorRow } from "./types";

/**
 * Shared by the table and the mobile cards so the flag vocabulary can't drift
 * between the two — the mistake the house style calls out from Themis.
 *
 * Weights follow Part 2 §5: `late` is informational (the video is in, nothing
 * to solve), everything ambiguous is amber and asks for a human judgement.
 */
export function RowFlags({ row }: { row: CreatorRow }) {
  const noneLabelled = row.delivered === 0 && row.unlabelled > 0;
  const hasAny = row.anyLate || row.hasDuplicate || row.hasSplitParts || noneLabelled;

  if (row.delivered === null) return <span className="text-ink-3">{NULL_DASH}</span>;
  if (!hasAny) return <span className="text-ink-3">{NULL_DASH}</span>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {noneLabelled && (
        <Tag
          tone="amber"
          title={`This creator uploaded ${row.unlabelled} video${row.unlabelled === 1 ? "" : "s"} this week but none are labelled TOF. They may have filmed the briefs and forgotten the label — worth checking before chasing.`}
        >
          nothing labelled TOF
        </Tag>
      )}
      {row.hasSplitParts && (
        <Tag
          tone="amber"
          title="At least one briefed video is named as a part (pt 1, pt 2). Parts are counted as separate videos, so the total may be higher than the number of briefs actually filmed."
        >
          split parts
        </Tag>
      )}
      {row.hasDuplicate && (
        <Tag
          tone="amber"
          title="Two briefed videos this week have an identical file size, which usually means the same export was uploaded twice. Worth a look, not a verdict."
        >
          possible duplicate
        </Tag>
      )}
      {row.anyLate && (
        <Tag title="Landed after the Sunday 23:59 deadline. It still counts toward the total.">
          late
        </Tag>
      )}
    </div>
  );
}
