import { allowedActionBoundary, assertAllowedAction, buildActionCatalog } from "./actions";
import { sanitizeContext } from "./context";
import { REWARD_VERSIONS } from "./rewards";
import { RECOMMENDATION_VERSION } from "./version";

export function makeRecommendation({ participant_id, policy, context = {}, catalog = buildActionCatalog(), reward_version = REWARD_VERSIONS.balanced,
  boundary = {}, timestamp = new Date().toISOString() }) {
  if (!participant_id) throw new Error("Anonymous participant_id is required.");
  const safeContext = sanitizeContext(context); const available = allowedActionBoundary(catalog, { current_difficulty: safeContext.current_difficulty, ...boundary });
  if (!available.length) throw new Error("No actions remain inside the exploration safety boundary.");
  const decision = policy.recommend({ actions: available, context: safeContext }); assertAllowedAction(decision.action, available);
  const idBase = `${participant_id}:${timestamp}:${policy.version}:${decision.action.action_id}`;
  const hash = [...idBase].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261).toString(16);
  return { recommendation_id: `rec_${hash}`, participant_id, timestamp, recommendation_version: RECOMMENDATION_VERSION,
    policy: policy.name, policy_version: policy.version, reward_version, context: safeContext, available_actions: available,
    selected_action: decision.action, predicted_reward: decision.predicted_reward, exploration: decision.exploration,
    rationale: decision.rationale || null, actual_outcome: null, actual_reward: null };
}

export function applyRecommendationOutcome(decision, outcome, rewardResult, policy) {
  policy.update(decision.selected_action, rewardResult.reward, decision.context);
  return { ...decision, actual_outcome: outcome, actual_reward: rewardResult.reward,
    reward_components: rewardResult.components, reward_version: rewardResult.reward_version, outcome_recorded_at: new Date().toISOString() };
}

