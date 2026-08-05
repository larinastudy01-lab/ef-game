import { seededRandom } from "../../ml/random";
import { POLICY_VERSIONS } from "../version";

export class RandomPolicy {
  constructor({ seed = 20260730 } = {}) { this.random = seededRandom(seed); this.name = "Random"; this.version = POLICY_VERSIONS.random; }
  recommend({ actions }) { if (!actions.length) throw new Error("Random policy requires allowed actions.");
    return { action: actions[Math.floor(this.random() * actions.length)], predicted_reward: null, exploration: true }; }
  update() {}
}

