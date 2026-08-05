export const CONTEXT_FEATURES = ["recent_accuracy", "recent_mean_rt", "rt_variability", "recent_performance_change",
  "recent_training_count", "current_difficulty"];

export function vectorizeContext(context = {}, arm = null) {
  const targetRt = Math.max(1, Number(context.target_rt_ms || 1000));
  const armHistory = context.task_history?.[arm] || {};
  return [1, Number(context.recent_accuracy || 0), Number(context.recent_mean_rt || 0) / targetRt,
    Number(context.rt_variability || 0), Number(context.recent_performance_change || 0),
    Number(context.recent_training_count || 0) / 10, Number(context.current_difficulty || 1) / 5,
    Number(context.previous_task === arm), Number(armHistory.recent_accuracy || 0), Number(armHistory.training_count || 0) / 10];
}

export function sanitizeContext(context = {}) {
  const allowed = [...CONTEXT_FEATURES, "target_rt_ms", "previous_task", "task_history"];
  const safe = Object.fromEntries(Object.entries(context).filter(([key]) => allowed.includes(key)));
  safe.task_history = Object.fromEntries(Object.entries(safe.task_history || {}).filter(([task]) => ["CBT", "PM", "SRT", "SSG", "LB", "DCCS"].includes(task))
    .map(([task, history]) => [task, Object.fromEntries(Object.entries(history || {}).filter(([key]) =>
      ["recent_accuracy", "recent_mean_rt", "rt_variability", "performance_change", "training_count", "current_difficulty"].includes(key))) ]));
  return safe;
}
