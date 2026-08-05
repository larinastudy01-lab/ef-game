import { addRollingFeatures } from "./rolling";
import { buildLongitudinalFeatureSummary } from "./features";
import { buildParticipantTimeline } from "./timeline";
import { assessMixedEffectsReadiness } from "./modelReadiness";
import { LONGITUDINAL_VERSION } from "./version";

export function analyzeParticipantLongitudinal(participantId, taskRows = [], recommendations = []) {
  const participantRows = taskRows.filter((row) => row.participant_id === participantId);
  const taskSeries = Object.fromEntries(["CBT", "PM", "SRT", "SSG", "LB", "DCCS"].map((task) => [task,
    addRollingFeatures(participantRows.filter((row) => row.task_code === task))]));
  return { longitudinal_version: LONGITUDINAL_VERSION, participant_id: participantId,
    comparison_reference: "Personal baseline (first valid recorded session for the same task and metric); no normative comparison.",
    timeline: buildParticipantTimeline(participantId, participantRows, recommendations),
    feature_summary: buildLongitudinalFeatureSummary(participantId, participantRows), task_series: taskSeries,
    mixed_effects_readiness: assessMixedEffectsReadiness(taskRows),
    interpretation_guardrail: "Changes and slopes describe within-participant behavioral patterns; they do not establish causation, diagnosis, or training effectiveness." };
}

