import type { StatusKind } from "@/lib/status";

export type CreatorRow = {
  creatorId: number;
  name: string;
  handle: string;
  /** null when the folder check failed — never coerce this to 0 (Law 2). */
  delivered: number | null;
  briefsTicked: number[];
  lastUpload: Date | null;
  anyLate: boolean;
  hasDuplicate: boolean;
  status: StatusKind;
  /** Why the count is unknown, surfaced on hover rather than hidden in logs. */
  errorMessage?: string;
};
