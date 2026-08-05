import { buildActionCatalog } from "./actions";
import { makeRecommendation, applyRecommendationOutcome } from "./engine";
import { calculateReward, REWARD_VERSIONS } from "./rewards";
import { seededRandom } from "../ml/random";
import { RandomPolicy } from "./policies/RandomPolicy";
import { RuleBasedPolicy } from "./policies/RuleBasedPolicy";
import { EpsilonGreedyPolicy } from "./policies/EpsilonGreedyPolicy";
import { UCBPolicy } from "./policies/UCBPolicy";
import { ThompsonSamplingPolicy } from "./policies/ThompsonSamplingPolicy";
import { ContextualBanditPolicy } from "./policies/ContextualBanditPolicy";

export const createSimulationPolicies = (seed = 11) => [new RandomPolicy({ seed }), new RuleBasedPolicy(), new EpsilonGreedyPolicy({ seed }),
  new UCBPolicy(), new ThompsonSamplingPolicy({ seed }), new ContextualBanditPolicy()];

function environmentOutcome(action, context, random) {
  const taskAffinity = ({ CBT: .73, PM: .68, SRT: .7, SSG: .62, LB: .66, DCCS: .64 })[action.task_code];
  const mismatch = Math.abs(action.difficulty_level - Number(context.current_difficulty || 1));
  const noise = (random() - 0.5) * 0.18; const accuracy = Math.max(0.05, Math.min(0.98, taskAffinity - mismatch * .08 + noise));
  return { accuracy, mean_rt_ms: 650 + action.difficulty_level * 90 + random() * 180, rt_variability_ms: 80 + random() * 170,
    completed: random() > 0.04, target_rt_ms: 1000, performance_change: accuracy - context.recent_accuracy };
}

export function runPolicySimulation({ rounds = 120, seed = 11, reward_version = REWARD_VERSIONS.balanced } = {}) {
  const catalog = buildActionCatalog(); return createSimulationPolicies(seed).map((policy, policyIndex) => {
    const random = seededRandom(seed + policyIndex); let context = { recent_accuracy: .65, recent_mean_rt: 850, rt_variability: .2,
      recent_performance_change: 0, previous_task: null, task_history: {}, current_difficulty: 2, recent_training_count: 0 };
    const history = [];
    for (let round = 0; round < rounds; round += 1) { const decision = makeRecommendation({ participant_id: `SIMULATION_P${policyIndex}`,
      policy, context, catalog, reward_version, timestamp: new Date(Date.UTC(2026, 0, 1, 0, round)).toISOString() });
      const outcome = environmentOutcome(decision.selected_action, context, random); const reward = calculateReward(outcome, reward_version);
      history.push({ ...applyRecommendationOutcome(decision, outcome, reward, policy), simulation: true, round: round + 1 });
      context = { ...context, recent_accuracy: outcome.accuracy, recent_mean_rt: outcome.mean_rt_ms,
        rt_variability: outcome.rt_variability_ms / 1000, recent_performance_change: outcome.performance_change,
        previous_task: decision.selected_action.task_code, current_difficulty: decision.selected_action.difficulty_level,
        recent_training_count: context.recent_training_count + 1 };
    }
    return { policy: policy.name, policy_version: policy.version, rounds, mean_reward: history.reduce((sum, item) => sum + item.actual_reward, 0) / rounds,
      final_20_mean_reward: history.slice(-20).reduce((sum, item) => sum + item.actual_reward, 0) / Math.min(20, rounds), history,
      label: "Simulation — not observed child training effect" };
  });
}

