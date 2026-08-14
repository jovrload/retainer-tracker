import type { StatusKind } from "@/lib/status";

export type CreatorRow = {
  creatorId: number;
  name: string;
  handle: string;
  /**
   * Briefed ("TOF") videos this week — the number that counts.
   * null when the folder check failed; never coerce that to 0 (Law 2).
   */
  delivered: number | null;
  /** Qualifying videos found that were not labelled as briefed work. */
  unlabelled: number;
  briefsTicked: number[];
  lastUpload: Date | null;
  anyLate: boolean;
  hasDuplicate: boolean;
  /** A briefed upload names itself part 1/2, so the file count may overstate. */
  hasSplitParts: boolean;
  status: StatusKind;
  /** Why the count is unknown, surfaced on hover rather than hidden in logs. */
  errorMessage?: string;
};
