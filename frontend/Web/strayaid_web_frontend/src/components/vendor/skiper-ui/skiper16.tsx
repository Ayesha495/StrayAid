"use client";

import { motion, useTransform } from "framer-motion";
import { useRef } from "react";
import type React from "react";



const StickyCard_001 = ({
  i,
  title,
  src,
  progress,
  range,
  targetScale,
  children,
  className,
  top,
}: {
  i: number;
  title: string;
  src: string;
  progress: any;
  range: [number, number];
  targetScale: number;
  /** StrayAid: custom card content and size instead of the fixed 500×300 image. */
  children?: React.ReactNode;
  className?: string;
  /** StrayAid: where the card sticks, e.g. "calc(96px + 24px * i)". */
  top?: string;
}) => {
  const container = useRef<HTMLDivElement>(null);

  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      ref={container}
      className="sticky top-0 flex items-center justify-center"
    >
      <motion.div
        style={{
          scale,
          top: top ?? `calc(-5vh + ${i * 20 + 250}px)`,
        }}
        className={className ?? "rounded-4xl relative -top-1/4 flex h-[300px] w-[500px] origin-top flex-col overflow-hidden"}
      >
        {children ?? <img src={src} alt={title} className="h-full w-full object-cover" />}
      </motion.div>
    </div>
  );
};

// StrayAid: the Skiper16 demo (sample images + Lenis smooth scroll) was removed; only the card is used.

export { StickyCard_001 };

/**
 * Skiper 16 StickyCard_001 — React + Framer Motion
 * We respect the original creators. This is an inspired rebuild with our own taste and does not claim any ownership.
 *
 * License & Usage:
 * - Free to use and modify in both personal and commercial projects.
 * - Attribution to Skiper UI is required when using the free version.
 * - No attribution required with Skiper UI Pro.
 *
 * Feedback and contributions are welcome.
 *
 * Author: @gurvinder-singh02
 * Website: https://gxuri.me
 * Twitter: https://x.com/Gur__vi
 */
