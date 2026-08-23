import type { DayStyle, Track } from "./types";

/**
 * Post-session stretch routines. Hardcoded on purpose: routine content is a
 * code edit, never app state. Display-only — nothing is persisted.
 */

export type StretchKey = "push" | "pull" | "legs" | "run";

export interface StretchItem {
  name: string;
  /** Human prescription, e.g. "2×30 s per side". */
  detail: string;
  /** Total holds to tick off (rounds × sides). */
  holds: number;
  /** Length of one hold. */
  seconds: number;
  /** Safety note shown under the stretch. */
  caution?: string;
}

export interface StretchRoutine {
  key: StretchKey;
  title: string;
  minutes: number;
  items: StretchItem[];
}

const HIP_FLEXOR: StretchItem = {
  name: "Half-kneeling hip flexor",
  detail: "2×30 s per side",
  holds: 4,
  seconds: 30,
};

const QUAD: StretchItem = {
  name: "Standing quad stretch",
  detail: "1×30 s per side, gently",
  holds: 2,
  seconds: 30,
  caution: "Knee rule: any pinch, drop it",
};

export const STRETCH_ROUTINES: Record<StretchKey, StretchRoutine> = {
  push: {
    key: "push",
    title: "Push cooldown",
    minutes: 4,
    items: [
      { name: "Doorway pec stretch", detail: "2×30 s per side", holds: 4, seconds: 30 },
      { name: "Overhead triceps stretch", detail: "2×30 s per side", holds: 4, seconds: 30 },
      { name: "Hands-behind-back shoulder opener", detail: "2×30 s", holds: 2, seconds: 30 },
    ],
  },
  pull: {
    key: "pull",
    title: "Pull cooldown",
    minutes: 4,
    items: [
      { name: "Lat stretch", detail: "2×30 s per side · hang or side-bend", holds: 4, seconds: 30 },
      { name: "Upper trap / neck stretch", detail: "2×30 s per side", holds: 4, seconds: 30 },
      {
        name: "Forearm flexor stretch",
        detail: "2×20 s per side · palm up, pull fingers back",
        holds: 4,
        seconds: 20,
        caution: "Pain-free only. If the tendon complains, skip and tell the physio",
      },
    ],
  },
  legs: {
    key: "legs",
    title: "Legs cooldown",
    minutes: 7,
    items: [
      HIP_FLEXOR,
      { name: "Figure-4 glute stretch", detail: "2×30 s per side", holds: 4, seconds: 30 },
      { name: "Hamstring stretch", detail: "2×30 s per side · standing or lying", holds: 4, seconds: 30 },
      QUAD,
    ],
  },
  run: {
    key: "run",
    title: "Run cooldown",
    minutes: 5,
    items: [
      { name: "Calf stretch, straight knee", detail: "2×30 s per side · against wall", holds: 4, seconds: 30 },
      {
        name: "Calf stretch, bent knee",
        detail: "2×30 s per side · soleus, the priority",
        holds: 4,
        seconds: 30,
      },
      HIP_FLEXOR,
      QUAD,
    ],
  },
};

/**
 * Which routine follows a day or a finished session. Cardio work of any kind
 * gets the run routine (ergs, stations and hybrids load calves and hips the
 * same way); lifting days match by name; unmatched Hyrox-track days fall back
 * to run; an unmatched gym day gets nothing rather than a wrong routine.
 */
export function stretchRoutineFor(day: {
  name: string;
  style?: DayStyle;
  track?: Track;
}): StretchRoutine | null {
  if (day.style === "cardio") return STRETCH_ROUTINES.run;
  const n = day.name.toLowerCase();
  if (n.includes("push") || n.includes("upper a")) return STRETCH_ROUTINES.push;
  if (n.includes("pull") || n.includes("upper b")) return STRETCH_ROUTINES.pull;
  if (n.includes("leg") || n.includes("lower")) return STRETCH_ROUTINES.legs;
  if (day.track === "hyrox") return STRETCH_ROUTINES.run;
  return null;
}
