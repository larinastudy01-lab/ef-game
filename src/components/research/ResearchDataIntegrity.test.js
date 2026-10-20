import { createHash } from "crypto";
import { buildTaskFeatureRow } from "../../analytics/features";
import { analyzeBehavioralStatistics } from "../../analytics/statistics";
import { analyzeParticipantLongitudinal } from "../../analytics/longitudinal";
import { generateSyntheticDataset } from "../../analytics/ml";
import { analyzeModelExplainability } from "../../analytics/explainability";
import { runPolicySimulation } from "../../analytics/recommendation";
import { buildUnifiedResearchExport } from "../../analytics/reproducibility";
import { matchesResearchScope } from "../../config/researchTasks";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inputs = ["P1", "P2"].flatMap((participantId) => ["CBT", "PM", "ARI"].flatMap((task_code) => [1, 2, 3].map((day) => ({
  participantId, sessionId: `${participantId}-${day}`, taskSession: { id: `${participantId}-${task_code}-${day}`, task_code, completion_status: "completed", difficulty: 1 },
  sessionMetadata: { session_started_at: `2026-01-0${day}T00:00:00Z`, assessment_or_training: day === 2 ? "training" : "assessment" },
  trials: [1, 2, 3, 4].map((trial_index) => ({ trial_index, is_correct: trial_index <= day, reaction_time_ms: trial_index === 4 ? null : 500 + day * 10 + trial_index, valid_trial: true })),
}))));
const rows = inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata, difficulty: input.taskSession.difficulty }));

test.each([["P1", "ALL"], ["P2", "ARI"], ["ALL", "PM"]])("UI redesign preserves statistics, longitudinal results and exact export bytes for %s / %s", (selectedParticipant, selectedTask) => {
  const selected = rows.filter((row) => matchesResearchScope(row.participant_id, row.task_code, { selectedParticipant, selectedTask }));
  const source = inputs.filter((input) => matchesResearchScope(input.participantId, input.taskSession.task_code, { selectedParticipant, selectedTask }));
  const statistics = analyzeBehavioralStatistics(selected);
  const longitudinal = analyzeParticipantLongitudinal("P1", selected, []);
  const bundle = buildUnifiedResearchExport({ inputs: source, taskRows: selected, statistics, generatedAt: "2026-01-10T00:00:00Z", codeVersion: "ui-baseline" });
  expect({ statistics: digest(statistics), longitudinal: digest(longitudinal), exports: digest(bundle.files) }).toMatchSnapshot();
});

test("UI redesign preserves seeded model and every strategy simulation result", () => {
  const result = analyzeModelExplainability(generateSyntheticDataset({ participants: 40, seed: 20260730 }), { targetType: "regression", demoMode: true, includeComparison: true, folds: 5 });
  // Outcome timestamps are wall-clock audit metadata; exclude them from the numerical baseline.
  const policies = runPolicySimulation({ rounds: 120, seed: 20260730 }).map((policy) => ({ ...policy, history: policy.history.map(({ outcome_recorded_at, ...decision }) => decision) }));
  expect({ model: digest(result), policies: digest(policies) }).toMatchSnapshot();
});
