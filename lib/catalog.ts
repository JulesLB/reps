import type { MuscleGroup } from "./types";

export interface CatalogEntry {
  name: string;
  muscle: MuscleGroup;
}

const C = (name: string, muscle: MuscleGroup): CatalogEntry => ({ name, muscle });

export const CATALOG: CatalogEntry[] = [
  C("Barbell Bench Press", "chest"),
  C("Incline Barbell Bench Press", "chest"),
  C("Decline Bench Press", "chest"),
  C("Dumbbell Bench Press", "chest"),
  C("Incline Dumbbell Press", "chest"),
  C("Chest Press Machine", "chest"),
  C("Incline Chest Press Machine", "chest"),
  C("Smith Machine Bench Press", "chest"),
  C("Pec Fly Machine (Pec Deck)", "chest"),
  C("Cable Fly", "chest"),
  C("Low-to-High Cable Fly", "chest"),
  C("Incline Cable Fly", "chest"),
  C("Push-Up", "chest"),
  C("Weighted Dip (Chest)", "chest"),

  C("Pull-Up", "back"),
  C("Chin-Up", "back"),
  C("Assisted Pull-Up Machine", "back"),
  C("Lat Pulldown", "back"),
  C("Close-Grip Lat Pulldown", "back"),
  C("Seated Cable Row", "back"),
  C("Chest-Supported Row", "back"),
  C("Machine Row", "back"),
  C("Barbell Row", "back"),
  C("Dumbbell Row", "back"),
  C("T-Bar Row", "back"),
  C("Straight-Arm Pulldown", "back"),
  C("Machine Pullover", "back"),
  C("Deadlift", "back"),
  C("Rack Pull", "back"),
  C("Back Extension", "back"),

  C("Overhead Press (Barbell)", "shoulders"),
  C("Dumbbell Shoulder Press", "shoulders"),
  C("Shoulder Press Machine", "shoulders"),
  C("Arnold Press", "shoulders"),
  C("Lateral Raise", "shoulders"),
  C("Cable Lateral Raise", "shoulders"),
  C("Machine Lateral Raise", "shoulders"),
  C("Front Raise", "shoulders"),
  C("Rear Delt Fly Machine", "shoulders"),
  C("Reverse Pec Deck", "shoulders"),
  C("Face Pull", "shoulders"),
  C("Upright Row", "shoulders"),
  C("Barbell Shrug", "shoulders"),
  C("Dumbbell Shrug", "shoulders"),

  C("Barbell Curl", "biceps"),
  C("EZ-Bar Curl", "biceps"),
  C("Dumbbell Curl", "biceps"),
  C("Hammer Curl", "biceps"),
  C("Incline Dumbbell Curl", "biceps"),
  C("Preacher Curl", "biceps"),
  C("Preacher Curl Machine", "biceps"),
  C("Cable Curl", "biceps"),
  C("Bayesian Cable Curl", "biceps"),
  C("Concentration Curl", "biceps"),
  C("Spider Curl", "biceps"),

  C("Triceps Pushdown", "triceps"),
  C("Rope Pushdown", "triceps"),
  C("Overhead Triceps Extension (Cable)", "triceps"),
  C("Overhead Triceps Extension (Dumbbell)", "triceps"),
  C("Skull Crusher", "triceps"),
  C("Close-Grip Bench Press", "triceps"),
  C("Weighted Dip (Triceps)", "triceps"),
  C("Machine Triceps Extension", "triceps"),
  C("Dumbbell Kickback", "triceps"),

  C("Back Squat", "quads"),
  C("Front Squat", "quads"),
  C("Smith Machine Squat", "quads"),
  C("Hack Squat Machine", "quads"),
  C("Pendulum Squat", "quads"),
  C("Leg Press", "quads"),
  C("Leg Extension", "quads"),
  C("Bulgarian Split Squat", "quads"),
  C("Walking Lunge", "quads"),
  C("Dumbbell Lunge", "quads"),
  C("Goblet Squat", "quads"),
  C("Step-Up", "quads"),
  C("Sissy Squat", "quads"),

  C("Romanian Deadlift", "hamstrings"),
  C("Stiff-Leg Deadlift", "hamstrings"),
  C("Seated Leg Curl", "hamstrings"),
  C("Lying Leg Curl", "hamstrings"),
  C("Standing Leg Curl", "hamstrings"),
  C("Nordic Hamstring Curl", "hamstrings"),
  C("Good Morning", "hamstrings"),
  C("Glute-Ham Raise", "hamstrings"),

  C("Hip Thrust Machine", "glutes"),
  C("Barbell Hip Thrust", "glutes"),
  C("Glute Bridge", "glutes"),
  C("Cable Glute Kickback", "glutes"),
  C("Glute Kickback Machine", "glutes"),
  C("Hip Abduction Machine", "glutes"),
  C("Hip Adduction Machine", "glutes"),
  C("Cable Pull-Through", "glutes"),
  C("Sumo Deadlift", "glutes"),
  C("Kettlebell Swing", "glutes"),

  C("Standing Calf Raise", "calves"),
  C("Seated Calf Raise", "calves"),
  C("Leg Press Calf Raise", "calves"),
  C("Smith Machine Calf Raise", "calves"),
  C("Donkey Calf Raise", "calves"),

  C("Plank", "core"),
  C("Side Plank", "core"),
  C("Crunch", "core"),
  C("Cable Crunch", "core"),
  C("Ab Crunch Machine", "core"),
  C("Hanging Leg Raise", "core"),
  C("Hanging Knee Raise", "core"),
  C("Captain's Chair Leg Raise", "core"),
  C("Ab Wheel Rollout", "core"),
  C("Russian Twist", "core"),
  C("Decline Sit-Up", "core"),
  C("Cable Woodchopper", "core"),
  C("Pallof Press", "core"),
  C("Dead Bug", "core"),

  C("Farmer's Carry", "other"),
  C("Sled Push", "other"),
  C("Battle Ropes", "other"),

  C("Stationary Bike", "cardio"),
  C("Spin Bike", "cardio"),
  C("Assault Bike", "cardio"),
  C("Rowing Machine", "cardio"),
  C("Stair Climber", "cardio"),
  C("Treadmill Run", "cardio"),
  C("Treadmill Incline Walk", "cardio"),
  C("Elliptical", "cardio"),
];

export function searchCatalog(query: string, limit: number): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.slice(0, limit);
  const starts: CatalogEntry[] = [];
  const contains: CatalogEntry[] = [];
  for (const e of CATALOG) {
    const n = e.name.toLowerCase();
    if (n.startsWith(q)) starts.push(e);
    else if (n.includes(q) || e.muscle.includes(q)) contains.push(e);
  }
  return [...starts, ...contains].slice(0, limit);
}
