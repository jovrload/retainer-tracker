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
  /**
   * Every qualifying video the creator uploaded this week, briefed or not.
   * Shown alongside the TOF count so the whole week is visible: "uploaded 9,
   * none of them briefed" is a very different story from "uploaded nothing".
   */
  videosUploaded: number;
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
