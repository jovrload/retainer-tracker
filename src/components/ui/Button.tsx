/**
 * Primary = accent fill (near-black), white text. Secondary = white with a
 * border. One filled button per screen, maximum (Part 1 §6) — on this screen
 * that's "Sync now".
 *
 * 36px minimum tap target on mobile (Part 1 §10).
 */
export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium " +
  "min-h-9 md:min-h-8 transition-colors duration-150 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-ground disabled:cursor-not-allowed";

export const buttonPrimary = `${buttonBase} bg-accent text-white hover:bg-ink/85 disabled:opacity-60`;

export const buttonSecondary =
  `${buttonBase} border border-line bg-surface text-ink ` +
  "hover:border-line-hover hover:bg-surface-2 disabled:opacity-40";
