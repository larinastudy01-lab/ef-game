import { POLICY_VERSIONS } from "../version";

export class UCBPolicy {
  constructor({ exploration = 2 } = {}) { this.exploration = exploration; this.counts = {}; this.values = {}; this.total = 0;
    this.name = "UCB1"; this.version = POLICY_VERSIONS.ucb; }
  recommend({ actions }) { const arms = [...new Set(actions.map((item) => item.arm_id))];
    const untried = arms.find((arm) => !this.counts[arm]); const arm = untried || [...arms].sort((a, b) => this.score(b) - this.score(a))[0];
    return { action: actions.find((item) => item.arm_id === arm), predicted_reward: this.values[arm] ?? null, exploration: Boolean(untried) }; }
  score(arm) { return (this.values[arm] || 0) + Math.sqrt(this.exploration * Math.log(Math.max(this.total, 1)) / this.counts[arm]); }
  update(action, reward) { const arm = action.arm_id; this.total += 1; const count = (this.counts[arm] || 0) + 1; this.counts[arm] = count;
    this.values[arm] = (this.values[arm] || 0) + (Number(reward) - (this.values[arm] || 0)) / count; }
}

