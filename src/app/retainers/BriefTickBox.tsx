"use client";

import { useState, useTransition } from "react";
import { toggleBriefTick } from "./actions";

export function BriefTickBox({
  weekId,
  creatorId,
  initialTicked,
  disabled,
}: {
  weekId: number;
  creatorId: number;
  initialTicked: boolean;
  disabled?: boolean;
}) {
  const [ticked, setTicked] = useState(initialTicked);
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={ticked}
        disabled={disabled || isPending}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          setTicked(next);
          startTransition(async () => {
            await toggleBriefTick(weekId, creatorId, next);
          });
        }}
        className="h-4 w-4 cursor-pointer accent-neutral-900 dark:accent-white"
      />
      <span className="text-xs text-neutral-500">{ticked ? "sent" : "not sent"}</span>
    </label>
  );
}
