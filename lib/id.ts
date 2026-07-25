/**
 * Ids cross devices and the sync merge keys on them (lib/merge.ts), so two
 * devices generating the same id makes one of the two objects vanish with no
 * error and no tombstone. Session ids used to be `s-${Date.now()}` and other
 * ids 8 chars of Math.random, both of which collide far more readily than
 * randomUUID. The fallback only matters in a non-secure context, where
 * crypto.randomUUID is not exposed.
 */
export function uid(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
