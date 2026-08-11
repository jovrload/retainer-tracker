"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A label whose definition lives one hover away (Part 1 §6). Dotted underline
 * rather than an info-dot, because a row of dots across a table header is noise.
 *
 * The tooltip renders through a portal with `position: fixed`. An absolutely
 * positioned one gets clipped by any ancestor with `overflow: hidden | auto`,
 * which here means every accent-topped card and every scrolling table.
 */
export function DefinedLabel({
  children,
  definition,
  className = "",
}: {
  children: React.ReactNode;
  definition: string;
  className?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  // `coords` can only become non-null from a pointer or focus event, which is
  // necessarily post-hydration — so no separate "mounted" flag is needed to
  // keep the portal off the server render.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!coords) return;

    const close = () => setCoords(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    // A scroll invalidates the measured rect; closing is more honest than
    // tracking a stale position.
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [coords]);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  }

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={coords ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setCoords(null)}
        onFocus={show}
        onBlur={() => setCoords(null)}
        className={`cursor-help underline decoration-dotted decoration-from-font underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${className}`}
      >
        {children}
      </span>

      {coords &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-normal normal-case leading-snug tracking-normal text-ink shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
          >
            <span className="block max-w-[16rem]">{definition}</span>
          </span>,
          document.body,
        )}
    </>
  );
}
