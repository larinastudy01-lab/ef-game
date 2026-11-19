import { finiteNumber } from "./professionalFormatters";

// A view of reward_balanced_v1, not a replacement for calculateReward or the simulator.
export function prepareRewardPresentation(simulation = []) {
  const rounds = new Map(), diagnostics = [];
  const seen = new Set();
  const policies = simulation.map((policy) => {
    const key = policy.policy_version;
    if (!key || seen.has(key)) diagnostics.push(`${policy.policy}：策略版本識別碼缺失或重複`);
    seen.add(key);
    const values = [], observedRounds = new Set();
    (policy.history || []).forEach((row) => {
      const value = finiteNumber(row.actual_reward), round = finiteNumber(row.round);
      const valid = value !== null && value >= 0 && value <= 1 && round !== null && round >= 1 && Number.isInteger(round) && !observedRounds.has(round)
        && row.policy === policy.policy && row.reward_version === "reward_balanced_v1" && row.policy_version === key;
      if (!valid) diagnostics.push(`${policy.policy} 第 ${row.round} 回合：Reward、回合或策略對應待確認`);
      if (typeof row.actual_reward === "string" && value !== null) diagnostics.push(`${policy.policy} 第 ${row.round} 回合：來源為字串數值（僅轉為繪圖數值）`);
      observedRounds.add(round);
      if (round !== null) { const entry = rounds.get(round) || { round }; entry[key] = valid ? value : null; rounds.set(round, entry); }
      if (valid) values.push(value);
    });
    const complete = values.length === policy.rounds && values.length === policy.history?.length;
    if (!complete) diagnostics.push(`${policy.policy}：有效 Reward ${values.length}／${policy.rounds}，暫不提供完整策略統計`);
    const sum = values.reduce((a, b) => a + b, 0), mean = values.length ? sum / values.length : null;
    return { ...policy, key, validCount: values.length, cumulative: complete ? sum : null, mean: complete ? mean : null,
      sd: complete && values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)) : null };
  });
  return { policies, rounds: [...rounds.values()].sort((a, b) => a.round - b.round), diagnostics };
}
