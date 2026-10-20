import { useMemo } from "react";
import { gameLocalStorage as storage, isTemporaryGameTesting } from "../temporaryGameTesting/runtime";
import { ACHIEVEMENT_POLICY_VERSION } from "./achievementProtocol";

export function createTrainingAchievementAssignment({ gameId, difficulty, difficultyLabel, trainingLevel, location = {} }) {
  if (isTemporaryGameTesting()) return null;
  const state = location.state || {};
  const params = new URLSearchParams(location.search || "");
  if (params.get("gameTesting") === "1") return null;
  let child = state.currentChild || state.child;
  if (!child) { try { child = JSON.parse(storage.getItem("currentChild") || "null"); } catch {} }
  const childId = child?.childId || child?.id || state.childId || storage.getItem("currentChildId");
  if (!childId) return null;
  const plan = state.trainingAssignment;
  const explicit = state.difficulty || state.difficultyKey || state.trainingLevel || state.level || params.get("difficulty") || params.get("level") || params.get("trainingLevel");
  let source = null;
  if (plan && plan.gameId === gameId && String(plan.childId) === String(childId)
    && (!plan.trainingLevel || Number(plan.trainingLevel) === Number(trainingLevel))) {
    source = plan.source === "clinician" ? "clinician" : plan.source === "system_plan" ? "system_plan" : null;
  } else if (state.isRecommended) source = "system_recommendation";
  else if (!explicit && !state.fromTrainingMap) source = "system_default";
  if (!source) return null;
  const issuedAt = new Date().toISOString();
  return {
    policyVersion: ACHIEVEMENT_POLICY_VERSION,
    id: `${gameId}-${issuedAt}-${Math.random().toString(36).slice(2, 10)}`,
    gameId, childId: String(childId), source, difficulty, difficultyLabel, trainingLevel,
    stageId: plan?.stageId || state.trainingStageId || params.get("stage") || null, issuedAt,
  };
}

export function useTrainingAchievementAssignment(options) {
  const { gameId, difficulty, difficultyLabel, trainingLevel, location } = options;
  return useMemo(() => createTrainingAchievementAssignment({ gameId, difficulty, difficultyLabel, trainingLevel, location }),
    [gameId, difficulty, difficultyLabel, trainingLevel, location]);
}
