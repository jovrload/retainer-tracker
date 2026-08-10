"use client";

import { useTransition } from "react";
import { syncNow } from "./actions";

/**
 * A full sync takes several seconds (8 Drive folders, sequentially), so the
 * pending state is not cosmetic — without it the button looks broken.
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
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        isPending
          ? "animate-pulse cursor-wait bg-neutral-400 text-white dark:bg-neutral-600"
          : "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      }`}
    >
      {isPending && (
        <span className="h-2 w-2 animate-ping rounded-full bg-white dark:bg-neutral-900" />
      )}
      {isPending ? "Syncing…" : "Sync now"}
    </button>
  );
}
