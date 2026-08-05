import { rowsToCsv } from "../researchDashboard";

const required = ["experiment_id", "research_question", "dataset_version", "feature_version", "target", "model",
  "hyperparameters", "seed", "cross_validation", "metrics", "result_path", "timestamp"];

export function createRegistryEntry(input = {}) {
  const entry = { experiment_id: input.experiment_id || input.id, research_question: input.research_question,
    dataset_version: input.dataset_version, feature_version: input.feature_version,
    target: input.target || input.target_definition, model: input.model || input.model_name,
    hyperparameters: input.hyperparameters || {}, seed: input.seed ?? input.random_seed,
    cross_validation: input.cross_validation || input.split_method, metrics: input.metrics || {},
    result_path: input.result_path, timestamp: input.timestamp || input.training_timestamp };
  const missing = required.filter((field) => entry[field] === null || entry[field] === undefined || entry[field] === "");
  if (missing.length) throw new Error(`Experiment registry entry missing: ${missing.join(", ")}`);
  return entry;
}

export function normalizeExperimentRegistry(experiments = []) {
  return experiments.flatMap((experiment) => { try { return [createRegistryEntry(experiment)]; } catch { return []; } });
}

export function buildExperimentRegistryExports(experiments = []) {
  const entries = normalizeExperimentRegistry(experiments);
  return { "experiment_registry.csv": rowsToCsv(entries), "experiment_registry.json": JSON.stringify({ registry_version: "experiment_registry_v1", experiments: entries }, null, 2) };
}

