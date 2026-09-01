export const BEHAVIORAL_SCHEMA_VERSION = "1.0.0";
export const TRIAL_PROCESSING_VERSION = "trial-normalizer-1.0.0";

export const TASK_CODES = Object.freeze(["CBT", "PM", "SRT", "SSG", "LB", "DCCS"]);

export const TASK_NAMES = Object.freeze({
  CBT: "Corsi Block Tapping",
  PM: "Picture Memory",
  SRT: "Simple Reaction Task",
  SSG: "Sound-Symbol Game",
  LB: "幫助迷路的綿羊奶奶",
  DCCS: "Dimensional Change Card Sort",
});

export const SESSION_MODES = Object.freeze(["assessment", "training"]);

// Bounds are acquisition-quality checks, not normative or diagnostic cut-offs.
export const REACTION_TIME_LIMITS_MS = Object.freeze({
  CBT: { minimum: 80, maximum: 120000 },
  PM: { minimum: 80, maximum: 120000 },
  SRT: { minimum: 80, maximum: 30000 },
  SSG: { minimum: 80, maximum: 30000 },
  LB: { minimum: 80, maximum: 120000 },
  DCCS: { minimum: 80, maximum: 60000 },
});

export function normalizeTaskCode(value) {
  const key = String(value || "").trim().toUpperCase();
  if (key === "CORSI" || key === "CORSI_BLOCK_TAPPING") return "CBT";
  if (key === "PICTURE_MEMORY" || key === "PM_TRAINING") return "PM";
  if (key === "SSG") return "SSG";
  if (key === "LINKING_BALLOONS") return "LB";
  if (key === "DCSS") return "DCCS";
  return TASK_CODES.includes(key) ? key : key || "UNKNOWN";
}

export function normalizeSessionMode(value) {
  const mode = String(value || "").toLowerCase();
  return mode === "training" ? "training" : "assessment";
}
