"use client";

import { useState, useTransition } from "react";
import { toggleBriefTick } from "./actions";
import { BRIEFS_PER_WEEK } from "@/lib/status";

const BRIEF_NUMBERS = Array.from({ length: BRIEFS_PER_WEEK }, (_, i) => i + 1);

/**
 * The only interactive control on the page (Part 2 §9), so:
 *
 * - Reads as a control at rest, not just on hover — visible border, pointer
 *   cursor, hover and focus states, real <button> elements.
 * - Square with a check glyph, so ticked/unticked differ in fill *and* shape
 *   and never rely on hue alone (Part 2 §12). Deliberately not a circle: the
 *   automatic side of the table has no dots at all now, but shape still does
 *   the work of saying "this one is yours".
 * - Optimistic, with an honest failure: on a failed write the dot reverts *and*
 *   says so inline. A dot that silently un-ticks on the next refresh is worse
 *   than a slow one.
 * - 36px targets on mobile, where the Saturday chase actually happens.
 */
export function BriefDots({
  weekId,
  creatorId,
  initialTicked,
  isClosedWeek = false,
}: {
  weekId: number;
  creatorId: number;
  initialTicked: number[];
  isClosedWeek?: boolean;
}) {
  const [ticked, setTicked] = useState<number[]>(initialTicked);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  function toggle(briefNo: number) {
    const wasTicked = ticked.includes(briefNo);
    setFailed(false);
    setTicked((cur) => (wasTicked ? cur.filter((n) => n !== briefNo) : [...cur, briefNo]));

    startTransition(async () => {
      try {
        await toggleBriefTick(weekId, creatorId, briefNo, !wasTicked);
      } catch {
        setTicked((cur) => (wasTicked ? [...cur, briefNo] : cur.filter((n) => n !== briefNo)));
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {BRIEF_NUMBERS.map((briefNo) => {
            const isTicked = ticked.includes(briefNo);
            return (
              <button
                key={briefNo}
                type="button"
                onClick={() => toggle(briefNo)}
                aria-pressed={isTicked}
                aria-label={`Brief ${briefNo} of ${BRIEFS_PER_WEEK} — ${isTicked ? "sent" : "not sent"}`}
                title={
                  isClosedWeek
                    ? `This week is closed. ${isTicked ? "Click to un-mark as sent." : "Click to mark as sent."}`
                    : isTicked
                      ? "Sent — click to undo"
                      : "Click to mark this brief as sent"
                }
                className={[
                  "grid h-9 w-9 place-items-center rounded-lg border-2 md:h-7 md:w-7",
                  "cursor-pointer transition-colors duration-150",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isTicked
                    ? "border-green-strong bg-green-strong text-white hover:bg-green-mid"
                    : "border-line-hover bg-surface text-transparent hover:border-ink-3 hover:bg-surface-2",
                  isClosedWeek ? "border-dashed" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M2.5 6.3 4.8 8.6 9.5 3.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>
        <span className="tnum text-xs text-ink-3">
          {ticked.length}/{BRIEFS_PER_WEEK}
        </span>
      </div>

      {failed && (
        <span className="text-[11px] font-medium leading-snug text-red-mid">
          Couldn&apos;t save that change. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
