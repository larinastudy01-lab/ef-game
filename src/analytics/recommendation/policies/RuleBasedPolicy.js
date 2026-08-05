import { POLICY_VERSIONS } from "../version";

/** Shared research baseline; existing task analyzers remain the production task-specific rules. */
export class RuleBasedPolicy {
  constructor() { this.name = "Rule-based"; this.version = POLICY_VERSIONS.rule_based; }
  recommend({ actions, context = {} }) {
    if (!actions.length) throw new Error("Rule policy requires allowed actions.");
    const taskHistory = context.task_history || {}; const taskScores = [...new Set(actions.map((item) => item.task_code))].map((task) => {
      const history = taskHistory[task] || {}; const accuracy = Number(history.recent_accuracy ?? context.recent_accuracy ?? 0.7);
      const variability = Number(history.rt_variability ?? context.rt_variability ?? 0); const change = Number(history.performance_change ?? context.recent_performance_change ?? 0);
      const count = Number(history.training_count || 0); return { task, priority: (1 - accuracy) + Math.min(variability, 1) * 0.25 - change * 0.15 - count * 0.01 };
    }).sort((a, b) => b.priority - a.priority);
    const selectedTask = taskScores[0].task; const accuracy = Number(taskHistory[selectedTask]?.recent_accuracy ?? context.recent_accuracy ?? 0.7);
    const current = Number(context.current_difficulty || 1); const desired = accuracy >= 0.85 ? current + 1 : accuracy < 0.6 ? current - 1 : current;
    const candidates = actions.filter((item) => item.task_code === selectedTask).sort((a, b) => Math.abs(a.difficulty_level - desired) - Math.abs(b.difficulty_level - desired));
    return { action: candidates[0], predicted_reward: Math.max(0, Math.min(1, accuracy)), exploration: false,
      rationale: `Priority combines recent accuracy, RT variability, performance change and training count; difficulty target=${desired}.` };
  }
  update() {}
}

