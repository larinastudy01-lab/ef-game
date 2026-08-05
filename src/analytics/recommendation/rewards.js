export const REWARD_VERSIONS = {
  accuracy: "reward_accuracy_v1", efficiency: "reward_efficiency_v1", balanced: "reward_balanced_v1",
};
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function calculateReward(outcome = {}, version = REWARD_VERSIONS.balanced) {
  const accuracy = clamp(outcome.accuracy); const rt = Number(outcome.mean_rt_ms); const targetRt = Number(outcome.target_rt_ms || 1000);
  const efficiency = Number.isFinite(rt) && rt >= 0 ? accuracy * clamp(targetRt / Math.max(rt, targetRt * 0.25)) : accuracy * 0.5;
  const stability = 1 - clamp((outcome.rt_variability_ms || 0) / Math.max(targetRt, 1));
  const completion = outcome.completed === false ? 0 : 1;
  if (version === REWARD_VERSIONS.accuracy) return { reward: accuracy, components: { accuracy }, reward_version: version };
  if (version === REWARD_VERSIONS.efficiency) return { reward: clamp(efficiency), components: { accuracy, efficiency }, reward_version: version };
  if (version === REWARD_VERSIONS.balanced) return { reward: clamp(0.55 * accuracy + 0.2 * efficiency + 0.15 * stability + 0.1 * completion),
    components: { accuracy, efficiency, stability, completion }, reward_version: version };
  throw new Error(`Unknown reward version: ${version}`);
}

