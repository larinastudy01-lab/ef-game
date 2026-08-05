import { buildActionCatalog, allowedActionBoundary } from "../actions";
import { RandomPolicy } from "../policies/RandomPolicy";
import { RuleBasedPolicy } from "../policies/RuleBasedPolicy";
import { EpsilonGreedyPolicy } from "../policies/EpsilonGreedyPolicy";
import { UCBPolicy } from "../policies/UCBPolicy";
import { ThompsonSamplingPolicy } from "../policies/ThompsonSamplingPolicy";
import { ContextualBanditPolicy } from "../policies/ContextualBanditPolicy";

const actions = allowedActionBoundary(buildActionCatalog(["CBT", "SRT"], [1, 2, 3, 4, 5]), { current_difficulty: 2 });

test.each([
  new RandomPolicy({ seed: 1 }), new RuleBasedPolicy(), new EpsilonGreedyPolicy({ epsilon: 0, seed: 1 }),
  new UCBPolicy(), new ThompsonSamplingPolicy({ seed: 1 }), new ContextualBanditPolicy(),
])("$name recommends only an allowed action and accepts feedback", (policy) => {
  const context = { recent_accuracy: .7, recent_mean_rt: 800, rt_variability: .2, current_difficulty: 2, task_history: {} };
  const decision = policy.recommend({ actions, context });
  expect(actions.map((item) => item.action_id)).toContain(decision.action.action_id);
  expect(() => policy.update(decision.action, .8, context)).not.toThrow();
});

test("rule baseline prioritizes lower-performing task and adjusts one level", () => {
  const policy = new RuleBasedPolicy(); const decision = policy.recommend({ actions, context: { current_difficulty: 2,
    task_history: { CBT: { recent_accuracy: .9 }, SRT: { recent_accuracy: .4 } } } });
  expect(decision.action.task_code).toBe("SRT"); expect(decision.action.difficulty_level).toBe(1);
});

test("UCB explores every task arm before exploitation", () => {
  const policy = new UCBPolicy(); const first = policy.recommend({ actions }); policy.update(first.action, .8);
  const second = policy.recommend({ actions }); expect(second.action.arm_id).not.toBe(first.action.arm_id);
});

