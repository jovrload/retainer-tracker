/**
 * What counts as a briefed video.
 *
 * Creators are told to label any briefed video "TOF". In practice two
 * conventions are in use, so both are honoured:
 *
 *   - in the filename  — "TOF NO1 02/08/26", "03.08.26 - TOF - 2"
 *   - as a folder      — Tyler keeps an "AUGUST / TOF Videos" folder
 *
 * This matters because most folders also hold a lot of non-briefed work
 * (b-roll, daily content, before/after clips). Without this filter, scanning
 * subfolders would count all of it and report absurd numbers.
 */

/** `\b` keeps "tofu" and similar out. */
const TOF_PATTERN = /\btof\b|top[\s\-_]?of[\s\-_]?funnel/i;

/** "pt 2", "pt.2", "part 2" — one brief delivered across several files. */
const PART_PATTERN = /\bp(?:ar)?t\.?\s*\d+/i;

export function looksLikeTof(fileName: string, folderPath: string[] = []): boolean {
  if (TOF_PATTERN.test(fileName)) return true;
  return folderPath.some((segment) => TOF_PATTERN.test(segment));
}

/**
 * Whether a filename claims to be one part of a multi-part upload. Counting
 * part-files as separate deliveries would let two briefs split into three
 * files read as a complete week, so this is surfaced as a flag for a human
 * rather than guessed at.
 */
export function looksLikePart(fileName: string): boolean {
  return PART_PATTERN.test(fileName);
}
