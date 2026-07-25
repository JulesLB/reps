/**
 * The deploy's build stamp, baked at build time. A running tab compares this
 * against the stamp compiled into its own bundle to learn it's stale — see
 * lib/buildStamp.ts for why that matters.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json({ stamp: process.env.NEXT_PUBLIC_BUILD_STAMP ?? "dev" });
}
