import { runPolicySimulation } from "../analytics/recommendation";
import { prepareRewardPresentation } from "./rewardPresentation";

test("all six strategies map by version and actual round with correct raw summary values", () => {
  const simulation = runPolicySimulation({ rounds: 120, seed: 20260730 });
  const original = JSON.stringify(simulation);
  const result = prepareRewardPresentation(simulation);
  expect(result.diagnostics).toEqual([]);
  expect(result.policies.map((p) => p.policy).sort()).toEqual(["Contextual Bandit", "Epsilon-Greedy", "Random", "Rule-based", "Thompson Sampling", "UCB1"]);
  result.policies.forEach((p) => {
    expect(p.mean).toBe(p.mean_reward); expect(p.validCount).toBe(120);
    expect(p.cumulative).toBeCloseTo(p.mean_reward * 120, 10); expect(p.sd).toBeGreaterThan(0);
    p.history.forEach((row) => expect(result.rounds.find((r) => r.round === row.round)[p.key]).toBe(row.actual_reward));
  });
  const reversed = prepareRewardPresentation([...simulation].reverse().map((p) => ({ ...p, history: [...p.history].reverse() })));
  expect(reversed.rounds).toEqual(result.rounds); expect(JSON.stringify(simulation)).toBe(original);
});
test.each([null, NaN, Infinity, -0.2, 1.2, "", false, []])("invalid reward %p is retained in source and becomes a chart gap, never clamped or averaged", (invalid) => {
  const simulation = runPolicySimulation({ rounds: 3, seed: 11 });
  simulation[0].history[0].actual_reward = invalid;
  const view = prepareRewardPresentation(simulation);
  expect(view.rounds[0][simulation[0].policy_version]).toBeNull();
  expect(view.policies[0].mean).toBeNull(); expect(view.policies[0].cumulative).toBeNull(); expect(view.diagnostics.length).toBeGreaterThan(0);
  expect(simulation[0].history[0].actual_reward).toBe(invalid);
});
test("numeric strings are disclosed and policy mismatches are excluded rather than mislabeled", () => {
  const simulation = runPolicySimulation({ rounds: 3, seed: 11 });
  simulation[0].history[0].actual_reward = "0.5";
  simulation[1].history[0].policy = "UCB1";
  const view = prepareRewardPresentation(simulation);
  expect(view.rounds[0][simulation[0].policy_version]).toBe(.5);
  expect(view.diagnostics.join(" ")).toContain("字串數值");
  expect(view.rounds[0][simulation[1].policy_version]).toBeNull();
});
test("summary sample SD and cumulative Reward match a known sequence without rounding source values", () => {
  const simulation = runPolicySimulation({ rounds: 3, seed: 11 });
  simulation[0].history.forEach((row, i) => { row.actual_reward = [.1, .2, .3][i]; });
  const p = prepareRewardPresentation(simulation).policies[0];
  expect(p.mean).toBeCloseTo(.2, 12); expect(p.cumulative).toBeCloseTo(.6, 12); expect(p.sd).toBeCloseTo(.1, 12);
});
