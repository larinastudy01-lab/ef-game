import { allowedActionBoundary, buildActionCatalog } from "../actions";
import { makeRecommendation } from "../engine";
import { calculateReward, REWARD_VERSIONS } from "../rewards";
import { RandomPolicy } from "../policies/RandomPolicy";
import { runPolicySimulation } from "../simulation";
import { persistRecommendation } from "../decisionLog";

test("allowed boundary prevents lowest-to-highest jumps", () => {
  const allowed = allowedActionBoundary(buildActionCatalog(["CBT"]), { current_difficulty: 1 });
  expect(allowed.map((item) => item.difficulty_level)).toEqual([1, 2]); expect(allowed.some((item) => item.difficulty_level === 5)).toBe(false);
});

test("decision log contains policy, context, action and reward version", () => {
  const decision = makeRecommendation({ participant_id: "anonymous-P1", policy: new RandomPolicy({ seed: 2 }),
    context: { recent_accuracy: .7, current_difficulty: 1, diagnosis: "must-be-removed" } });
  expect(decision).toEqual(expect.objectContaining({ recommendation_id: expect.any(String), policy_version: "random_v1",
    available_actions: expect.any(Array), selected_action: expect.any(Object), reward_version: "reward_balanced_v1" }));
  expect(decision.context.diagnosis).toBeUndefined();
});

test("reward versions produce auditable bounded rewards", () => {
  Object.values(REWARD_VERSIONS).forEach((version) => { const result = calculateReward({ accuracy: .8, mean_rt_ms: 700,
    rt_variability_ms: 100, completed: true }, version); expect(result.reward).toBeGreaterThanOrEqual(0); expect(result.reward).toBeLessThanOrEqual(1);
    expect(result.reward_version).toBe(version); });
});

test("simulation compares six policies and is explicitly labeled", () => {
  const results = runPolicySimulation({ rounds: 20, seed: 3 }); expect(results).toHaveLength(6);
  expect(results.every((item) => item.label.startsWith("Simulation"))).toBe(true);
  expect(results.every((item) => Number.isFinite(item.mean_reward))).toBe(true);
});

test("simulation decision cannot be persisted as observed history", async () => {
  await expect(persistRecommendation({}, { simulation: true })).rejects.toThrow("Simulation decisions");
});

