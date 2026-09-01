import { supabase } from "../../lib/supabaseClient";
import { UCBPolicy } from "./policies/UCBPolicy";
import { recommendAndLog, recordOutcomeAndUpdatePolicy } from "./decisionLog";

export const ACTIVE_RECOMMENDATION_KEY = "ef_game_active_recommendation_v1";
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const asLevel = (value, fallback = 1) => {
  const match = String(value ?? "").match(/\d+/);
  const level = match ? Number(match[0]) : Number(value);
  return Number.isFinite(level) ? Math.max(1, Math.min(5, Math.round(level))) : fallback;
};
const storageKey = (patientId) => `${ACTIVE_RECOMMENDATION_KEY}:${patientId}`;
const outcomesInFlight = new Set();
const recommendationsInFlight = new Map();

export function readActiveRecommendation(patientId) {
  if (typeof window === "undefined" || !patientId) return null;
  try { return JSON.parse(window.sessionStorage.getItem(storageKey(patientId)) || "null"); }
  catch { return null; }
}
const storeActiveRecommendation = (patientId, decision) =>
  window.sessionStorage.setItem(storageKey(patientId), JSON.stringify(decision));
const clearActiveRecommendation = (patientId) => window.sessionStorage.removeItem(storageKey(patientId));

export function buildRecommendationContext(results = [], currentDifficulty = 1) {
  const training = results.filter((row) => row?.session?.mode === "training");
  const taskHistory = {};
  for (const result of training) {
    const task = String(result?.game?.gameId || "").toUpperCase();
    if (!task || taskHistory[task]) continue;
    const accuracy = Number(result?.summary?.accuracy || 0);
    taskHistory[task] = {
      recent_accuracy: clamp01(accuracy > 1 ? accuracy / 100 : accuracy),
      recent_mean_rt: Number(result?.summary?.avgReactionTime || 0),
      rt_variability: 0,
      performance_change: 0,
      training_count: training.filter((item) => String(item?.game?.gameId || "").toUpperCase() === task).length,
      current_difficulty: asLevel(result?.session?.difficulty, 1),
    };
  }
  const latest = training[0];
  const latestAccuracy = Number(latest?.summary?.accuracy || 0);
  return {
    recent_accuracy: clamp01(latestAccuracy > 1 ? latestAccuracy / 100 : latestAccuracy),
    recent_mean_rt: Number(latest?.summary?.avgReactionTime || 0), rt_variability: 0,
    recent_performance_change: 0, recent_training_count: training.length,
    current_difficulty: asLevel(currentDifficulty ?? latest?.session?.difficulty, 1), target_rt_ms: 1000,
    previous_task: latest ? String(latest.game?.gameId || "").toUpperCase() : null, task_history: taskHistory,
  };
}

export function buildRecommendationOutcome(result) {
  const accuracy = Number(result?.summary?.accuracy || 0);
  const reactionTimes = (result?.metrics?.reactionTimes || []).map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const mean = Number(result?.summary?.avgReactionTime || 0);
  const variance = reactionTimes.length > 1
    ? reactionTimes.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / reactionTimes.length : 0;
  return { accuracy: clamp01(accuracy > 1 ? accuracy / 100 : accuracy), mean_rt_ms: mean,
    rt_variability_ms: Math.sqrt(variance), target_rt_ms: 1000, completed: true,
    performance_change: 0, source_result_id: result?.resultId || null };
}

async function ensureParticipant(patientId) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) {
    const error = new Error("Please sign in before requesting an online recommendation.");
    error.code = "RECOMMENDATION_AUTH_REQUIRED";
    throw error;
  }

  const { data: patient, error: patientError } = await supabase.from("patients")
    .select("id").eq("id", patientId).maybeSingle();
  if (patientError) throw patientError;
  if (!patient?.id) {
    const error = new Error("The selected patient does not exist in the authenticated user's cloud account.");
    error.code = "PATIENT_NOT_IN_CLOUD";
    throw error;
  }

  // The RPC performs the ownership check and the create-or-return operation in
  // one transaction. This avoids RLS/race failures when React mounts the menu
  // twice or two tabs request a recommendation at the same time.
  const { data: rpcParticipantId, error: rpcError } = await supabase
    .rpc("ensure_research_participant", { target_patient_id: patientId });
  if (!rpcError && rpcParticipantId) return rpcParticipantId;
  if (rpcError && rpcError.code !== "PGRST202" && rpcError.code !== "42883") throw rpcError;

  // Compatibility path for deployments that have not applied the RPC yet.
  const { data: existing, error: selectError } = await supabase.from("research_participants")
    .select("id").eq("patient_id", patientId).maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from("research_participants")
    .upsert({ patient_id: patientId }, { onConflict: "patient_id" }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function hydratedPolicy(participantId) {
  const policy = new UCBPolicy();
  const { data, error } = await supabase.from("recommendation_decisions")
    .select("selected_action,actual_reward,context").eq("participant_id", participantId)
    .eq("policy_version", policy.version).not("actual_reward", "is", null)
    .order("recommendation_timestamp", { ascending: true }).limit(1000);
  if (error) throw error;
  (data || []).forEach((row) => policy.update(row.selected_action, row.actual_reward, row.context));
  return policy;
}

async function createOnlineRecommendationRequest({ patientId, allowedTasks, currentDifficulty = 1, results = [] }) {
  if (!patientId) throw new Error("A patient id is required for online recommendation.");
  const active = readActiveRecommendation(patientId);
  if (active && !active.actual_outcome) return active;
  const participantId = await ensureParticipant(patientId);
  const policy = await hydratedPolicy(participantId);
  const decision = await recommendAndLog(supabase, { participant_id: participantId, policy,
    context: buildRecommendationContext(results, currentDifficulty),
    boundary: { allowed_tasks: allowedTasks, max_step: 1 } });
  storeActiveRecommendation(patientId, decision);
  return decision;
}

export async function createOnlineRecommendation(request) {
  const patientId = request?.patientId;
  if (!patientId) return createOnlineRecommendationRequest(request || {});
  if (recommendationsInFlight.has(patientId)) return recommendationsInFlight.get(patientId);
  const pending = createOnlineRecommendationRequest(request).finally(() => {
    recommendationsInFlight.delete(patientId);
  });
  recommendationsInFlight.set(patientId, pending);
  return pending;
}

export async function completeActiveRecommendation(result) {
  if (result?.session?.mode !== "training") return null;
  const patientId = result?.child?.childId || result?.child?.id;
  const decision = readActiveRecommendation(patientId);
  if (!decision) return null;
  if (String(result?.game?.gameId || "").toUpperCase() !== decision?.selected_action?.task_code) return null;
  if (outcomesInFlight.has(decision.recommendation_id)) return null;
  outcomesInFlight.add(decision.recommendation_id);
  try {
    const policy = await hydratedPolicy(decision.participant_id);
    const completed = await recordOutcomeAndUpdatePolicy(supabase, decision, buildRecommendationOutcome(result), policy);
    clearActiveRecommendation(patientId);
    return completed;
  } finally {
    outcomesInFlight.delete(decision.recommendation_id);
  }
}
