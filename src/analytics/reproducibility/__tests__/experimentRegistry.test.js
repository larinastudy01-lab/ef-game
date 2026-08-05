import { buildExperimentRegistryExports, createRegistryEntry } from "../experimentRegistry";

const experiment = { experiment_id: "EXP1", research_question: "Can early trials predict later accuracy?",
  dataset_version: "behavioral_dataset_v1", feature_version: "features_v1", target_definition: "future_accuracy",
  model_name: "Linear Regression", hyperparameters: { iterations: 10 }, random_seed: 7,
  split_method: "ParticipantHoldout + GroupKFold", metrics: { rmse: .1 }, result_path: "experiments/EXP1.json",
  training_timestamp: "2026-07-30T00:00:00.000Z" };

test("registry requires complete reproducibility metadata", () => {
  expect(createRegistryEntry(experiment)).toEqual(expect.objectContaining({ experiment_id: "EXP1", seed: 7,
    cross_validation: "ParticipantHoldout + GroupKFold", result_path: "experiments/EXP1.json" }));
  expect(() => createRegistryEntry({ experiment_id: "bad" })).toThrow("missing");
});

test("registry exports both CSV and structured JSON", () => {
  const files = buildExperimentRegistryExports([experiment]);
  expect(files["experiment_registry.csv"]).toContain("research_question");
  expect(JSON.parse(files["experiment_registry.json"]).experiments).toHaveLength(1);
});

