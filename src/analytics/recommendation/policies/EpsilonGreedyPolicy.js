import { seededRandom } from "../../ml/random";
import { POLICY_VERSIONS } from "../version";

export class EpsilonGreedyPolicy {
  constructor({ epsilon = 0.1, seed = 20260730 } = {}) { this.epsilon = epsilon; this.random = seededRandom(seed); this.counts = {}; this.values = {};
    this.name = "Epsilon-Greedy"; this.version = POLICY_VERSIONS.epsilon_greedy; }
  recommend({ actions }) { const arms = uniqueArms(actions); const explore = this.random() < this.epsilon || arms.every((arm) => !this.counts[arm]);
    const arm = explore ? arms[Math.floor(this.random() * arms.length)] : [...arms].sort((a, b) => (this.values[b] || 0) - (this.values[a] || 0))[0];
    const choices = actions.filter((item) => item.arm_id === arm); return { action: choices[Math.floor(this.random() * choices.length)], predicted_reward: this.values[arm] ?? null, exploration: explore }; }
  update(action, reward) { const arm = action.arm_id; const count = (this.counts[arm] || 0) + 1; this.counts[arm] = count;
    this.values[arm] = (this.values[arm] || 0) + (Number(reward) - (this.values[arm] || 0)) / count; }
}
const uniqueArms = (actions) => [...new Set(actions.map((item) => item.arm_id))];

