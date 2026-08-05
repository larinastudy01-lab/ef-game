import { seededRandom } from "../../ml/random";
import { POLICY_VERSIONS } from "../version";

function gamma(shape, random) { if (shape < 1) return gamma(shape + 1, random) * random() ** (1 / shape); const d = shape - 1 / 3; const c = 1 / Math.sqrt(9 * d);
  while (true) { let x; let v; do { const u1 = Math.max(random(), 1e-12); const u2 = random(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = (1 + c * x) ** 3; } while (v <= 0);
    const u = random(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v; } }
function beta(alpha, value, random) { const x = gamma(alpha, random); return x / (x + gamma(value, random)); }

export class ThompsonSamplingPolicy {
  constructor({ seed = 20260730 } = {}) { this.random = seededRandom(seed); this.alpha = {}; this.beta = {};
    this.name = "Thompson Sampling"; this.version = POLICY_VERSIONS.thompson_sampling; }
  recommend({ actions }) { const arms = [...new Set(actions.map((item) => item.arm_id))]; const samples = Object.fromEntries(arms.map((arm) => [arm, beta(this.alpha[arm] || 1, this.beta[arm] || 1, this.random)]));
    const arm = [...arms].sort((a, b) => samples[b] - samples[a])[0]; return { action: actions.find((item) => item.arm_id === arm), predicted_reward: samples[arm], exploration: true }; }
  update(action, reward) { const arm = action.arm_id; const value = Math.max(0, Math.min(1, Number(reward))); this.alpha[arm] = (this.alpha[arm] || 1) + value; this.beta[arm] = (this.beta[arm] || 1) + 1 - value; }
}

