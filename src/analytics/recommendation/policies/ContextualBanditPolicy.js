import { POLICY_VERSIONS } from "../version";
import { vectorizeContext } from "../context";

const dot = (a, b) => a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);

/** Diagonal LinUCB prototype; context contains behavioral fields only. */
export class ContextualBanditPolicy {
  constructor({ alpha = 0.5 } = {}) { this.alpha = alpha; this.state = {}; this.name = "Contextual Bandit"; this.version = POLICY_VERSIONS.contextual_bandit; }
  armState(arm, size) { if (!this.state[arm]) this.state[arm] = { diagonal: Array(size).fill(1), b: Array(size).fill(0), count: 0 }; return this.state[arm]; }
  recommend({ actions, context = {} }) { const arms = [...new Set(actions.map((item) => item.arm_id))];
    const scored = arms.map((arm) => { const x = vectorizeContext(context, arm); const state = this.armState(arm, x.length); const theta = state.b.map((value, i) => value / state.diagonal[i]);
      const uncertainty = Math.sqrt(x.reduce((sum, value, i) => sum + value ** 2 / state.diagonal[i], 0));
      return { arm, predicted: dot(theta, x), score: dot(theta, x) + this.alpha * uncertainty }; }).sort((a, b) => b.score - a.score);
    return { action: actions.find((item) => item.arm_id === scored[0].arm), predicted_reward: scored[0].predicted, exploration: scored[0].score > scored[0].predicted }; }
  update(action, reward, context = {}) { const x = vectorizeContext(context, action.arm_id); const state = this.armState(action.arm_id, x.length);
    x.forEach((value, index) => { state.diagonal[index] += value ** 2; state.b[index] += Number(reward) * value; }); state.count += 1; }
}
