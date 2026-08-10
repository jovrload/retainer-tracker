"use client";

import { useState, useTransition } from "react";
import { toggleBriefTick } from "./actions";

const BRIEF_NUMBERS = [1, 2, 3];

/**
 * Three clickable dots — one per brief. Manual only: briefs go out over
 * WhatsApp, so nothing here is or can be automated. Updates optimistically
 * so a click feels instant, then persists via a server action.
 */
export function BriefDots({
  weekId,
  creatorId,
  initialTicked,
}: {
  weekId: number;
  creatorId: number;
  initialTicked: number[];
}) {
  const [ticked, setTicked] = useState<number[]>(initialTicked);
  const [, startTransition] = useTransition();

  function toggle(briefNo: number) {
    const isTicked = ticked.includes(briefNo);
    const next = isTicked ? ticked.filter((n) => n !== briefNo) : [...ticked, briefNo];
    setTicked(next);

    startTransition(async () => {
      try {
        await toggleBriefTick(weekId, creatorId, briefNo, !isTicked);
      } catch {
        // Roll back the optimistic update so the dot never lies about
        // what actually got saved.
        setTicked((current) =>
          isTicked ? [...current, briefNo] : current.filter((n) => n !== briefNo),
        );
      }
    });
  }

  const sentCount = ticked.length;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1.5">
        {BRIEF_NUMBERS.map((briefNo) => {
          const isTicked = ticked.includes(briefNo);
          return (
            <button
              key={briefNo}
              type="button"
              onClick={() => toggle(briefNo)}
              aria-pressed={isTicked}
              aria-label={`Brief ${briefNo} ${isTicked ? "sent" : "not sent"}`}
              title={`Brief ${briefNo} — ${isTicked ? "sent (click to undo)" : "not sent (click to mark sent)"}`}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                isTicked
                  ? "border-green-500 bg-green-500 hover:bg-green-600 dark:border-green-400 dark:bg-green-400"
                  : "border-neutral-300 bg-transparent hover:border-neutral-500 dark:border-neutral-600 dark:hover:border-neutral-400"
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs tabular-nums text-neutral-500">{sentCount}/3</span>
    </div>
  );
}
