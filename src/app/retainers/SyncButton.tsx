"use client";

import { useTransition } from "react";
import { syncNow } from "./actions";
import { buttonPrimary } from "@/components/ui/Button";

/**
 * A full sync reads eight Drive folders sequentially and takes several seconds,
 * so the pending state isn't cosmetic — without it the button looks broken.
 * Motion here announces work in progress rather than rewarding the click
 * (Part 1 §9), and is suppressed under prefers-reduced-motion.
 */
export function SyncButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await syncNow();
        })
      }
      className={`${buttonPrimary} ${isPending ? "animate-pulse cursor-wait" : ""}`}
    >
      {isPending && (
        <span
          className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-white"
          aria-hidden="true"
        />
      )}
      {isPending ? "Syncing…" : "Sync now"}
    </button>
  );
}
