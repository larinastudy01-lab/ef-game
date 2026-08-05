import { buildCleanedTrialRows, buildUnifiedResearchExport, createDatasetManifest } from "../exportBundle";

const inputs = [{ participantId: "P1", sessionId: "S1", taskSession: { id: "TS1", task_code: "SRT" },
  rawTrials: [{ id: "RAW1", trial_index: 1, raw_data: { clicked: true }, raw_schema_version: "raw_v1" }],
  trials: [{ trial_id: "RAW1", trial_index: 1, is_correct: false, reaction_time_ms: 250,
    valid_trial: false, exclusion_reasons: ["repeated_submit"], processing_version: "trial-normalizer-1.0.0" }] }];
const taskRows = [{ participant_id: "P1", session_id: "S1", task_session_id: "TS1", task_code: "SRT",
  feature_version: "features_v1", accuracy: 0, excluded_trial_count: 1 }];

test("manifest records versions, hierarchy counts, and retained exclusions", () => {
  const manifest = createDatasetManifest({ inputs, taskRows, generatedAt: "2026-07-30T00:00:00.000Z", codeVersion: "commit-abc" });
  expect(manifest).toEqual(expect.objectContaining({ dataset_version: "behavioral_dataset_v1", participant_count: 1,
    session_count: 1, task_count: 1, trial_count: 1, excluded_trial_count: 1,
    feature_version: "features_v1", feature_versions: ["features_v1"], code_version: "commit-abc" }));
});

test("cleaned trial export retains validity and processing lineage", () => {
  const rows = buildCleanedTrialRows(inputs); expect(rows[0]).toEqual(expect.objectContaining({ valid_trial: false,
    exclusion_reasons: ["repeated_submit"], processing_version: "trial-normalizer-1.0.0" }));
});

test("unified bundle contains every required research artifact and JSON metadata", () => {
  const bundle = buildUnifiedResearchExport({ inputs, taskRows, generatedAt: "2026-07-30T00:00:00.000Z", codeVersion: "test" });
  expect(Object.keys(bundle.files)).toEqual(expect.arrayContaining(["raw_trial_data.csv", "cleaned_trial_data.csv", "task_features.csv",
    "participant_features.csv", "ml_predictions.csv", "shap_results.csv", "recommendation_decisions.csv",
    "longitudinal_features.csv", "dataset_manifest.json", "export_metadata.json", "experiment_registry.csv", "experiment_registry.json"]));
  expect(JSON.parse(bundle.files["dataset_manifest.json"]).excluded_trial_count).toBe(1);
});
