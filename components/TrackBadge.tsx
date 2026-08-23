import type { Track } from "@/lib/types";
import { ZapIcon } from "./icons";

/**
 * Small "HYROX" chip on session types and history rows. Gym is the default
 * and renders nothing — the badge exists to make race-prep work stand out,
 * not to label everything.
 */
export default function TrackBadge({ track, className }: { track?: Track; className?: string }) {
  if (track !== "hyrox") return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-info ${className ?? ""}`}
    >
      <ZapIcon className="h-3 w-3" /> Hyrox
    </span>
  );
}
