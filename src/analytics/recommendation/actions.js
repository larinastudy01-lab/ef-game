export const TRAINING_TASKS = ["CBT", "PM", "SRT", "SSG", "LB", "DCCS"];
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

export const buildActionCatalog = (tasks = TRAINING_TASKS, difficulties = DIFFICULTY_LEVELS) =>
  tasks.flatMap((task_code) => difficulties.map((difficulty_level) => ({
    action_id: `${task_code}:L${difficulty_level}`, arm_id: task_code, task_code, difficulty_level,
  })));

/** Exploration may change at most one level; no current level starts at 1 or 2. */
export function allowedActionBoundary(actions, { current_difficulty = null, allowed_tasks = TRAINING_TASKS, max_step = 1 } = {}) {
  const current = Number(current_difficulty);
  const allowedTaskSet = new Set(allowed_tasks);
  return actions.filter((action) => allowedTaskSet.has(action.task_code) && (Number.isFinite(current)
    ? Math.abs(action.difficulty_level - current) <= max_step : action.difficulty_level <= 2));
}

export function assertAllowedAction(action, allowed) {
  if (!allowed.some((item) => item.action_id === action?.action_id)) throw new Error("Selected action violates the allowed exploration boundary.");
  return action;
}
