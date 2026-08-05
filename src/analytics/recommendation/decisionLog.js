import { applyRecommendationOutcome, makeRecommendation } from "./engine";
import { calculateReward } from "./rewards";

export async function persistRecommendation(supabase, decision) {
  if (decision.simulation) throw new Error("Simulation decisions must not be persisted as observed recommendation history.");
  const { data, error } = await supabase.from("recommendation_decisions").insert({
    id: decision.recommendation_id, participant_id: decision.participant_id, recommendation_timestamp: decision.timestamp,
    recommendation_version: decision.recommendation_version, policy_name: decision.policy, policy_version: decision.policy_version,
    reward_version: decision.reward_version, context: decision.context, available_actions: decision.available_actions,
    selected_action: decision.selected_action, predicted_reward: decision.predicted_reward, exploration: decision.exploration,
  }).select().single(); if (error) throw error; return data;
}

export async function persistRecommendationOutcome(supabase, decision) {
  const { data, error } = await supabase.from("recommendation_decisions").update({ actual_outcome: decision.actual_outcome,
    actual_reward: decision.actual_reward, reward_components: decision.reward_components, outcome_recorded_at: decision.outcome_recorded_at })
    .eq("id", decision.recommendation_id).is("actual_outcome", null).select().single();
  if (error) throw error; return data;
}

export async function loadRecommendationHistory(supabase, limit = 200) {
  const { data, error } = await supabase.from("recommendation_decisions").select("*")
    .order("recommendation_timestamp", { ascending: false }).limit(limit); if (error) throw error; return data || [];
}

/** Preferred online entry point: a new adaptive decision is persisted before it is returned. */
export async function recommendAndLog(supabase, request) {
  const decision = makeRecommendation(request); await persistRecommendation(supabase, decision); return decision;
}

/** Appends the observed outcome once, computes the versioned reward, and updates policy state. */
export async function recordOutcomeAndUpdatePolicy(supabase, decision, outcome, policy) {
  const reward = calculateReward(outcome, decision.reward_version); const completed = applyRecommendationOutcome(decision, outcome, reward, policy);
  await persistRecommendationOutcome(supabase, completed); return completed;
}
