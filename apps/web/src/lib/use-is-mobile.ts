"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the viewport is at or below `maxWidth` px. SSR-safe:
 * initial value is false on the server so layout doesn't flash, then the
 * effect syncs once mounted on the client.
 */
export function useIsMobile(maxWidth = 720): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIs(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return is;
}

/** Same hook but for very narrow phones (≤420px). */
export function useIsNarrow(maxWidth = 420): boolean {
  return useIsMobile(maxWidth);
}
