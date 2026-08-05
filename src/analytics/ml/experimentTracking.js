import { DEFAULT_DATASET_VERSION, DEFAULT_SEED, ML_PIPELINE_VERSION } from "./version";

export function createExperimentRecord({ rows, model, targetType, featureVersion = "features_v1", datasetVersion = DEFAULT_DATASET_VERSION,
  seed = DEFAULT_SEED, splitMethod, folds, holdout, metrics, trainingTimeMs, demoMode = false, codeVersion = null,
  researchQuestion = null, resultPath = null }) {
  const timestamp = new Date().toISOString();
  const signature = `${timestamp}:${model.name}:${seed}:${rows.length}`;
  const hash = [...signature].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261).toString(16);
  const experimentId = `exp_${hash}`; const targetDefinition = rows[0]?.target_definition || "unspecified_behavioral_target";
  return {
    experiment_id: experimentId, research_question: researchQuestion || `How well can ${targetDefinition} be predicted from authorized behavioral features?`,
    result_path: resultPath || `experiments/${experimentId}.json`, dataset_version: datasetVersion, feature_version: featureVersion,
    ml_pipeline_version: ML_PIPELINE_VERSION, target_definition: targetDefinition,
    target_type: targetType, model_name: model.name, hyperparameters: model.parameters, random_seed: seed,
    split_method: splitMethod, train_participants: holdout.development_participants,
    validation_participants: folds.map((fold) => fold.test_participants), test_participants: holdout.test_participants,
    metrics, class_distribution: targetType === "classification" ? distribution(rows) : null,
    training_time_ms: trainingTimeMs, training_timestamp: timestamp, code_model_version: codeVersion,
    data_mode: demoMode ? "synthetic_demo" : "observed_research", is_demo: demoMode,
    interpretation_guardrail: "Behavioral performance research prototype; not a clinical diagnosis.",
  };
}

const distribution = (rows) => rows.reduce((result, row) => ({ ...result, [row.target]: (result[row.target] || 0) + 1 }), {});

export function experimentTable(records = []) {
  return records.map((record) => ({ Model: record.model_name, "Feature Version": record.feature_version,
    Target: record.target_definition, "CV Method": record.split_method, ...record.metrics,
    "Training Time (ms)": record.training_time_ms, Hyperparameters: JSON.stringify(record.hyperparameters),
    "Data Mode": record.data_mode }));
}

export async function persistExperiment(supabase, record) {
  if (record.is_demo) throw new Error("Synthetic demo experiments must not be persisted as observed research results.");
  const { data, error } = await supabase.from("ml_experiments").insert({
    id: record.experiment_id, dataset_version: record.dataset_version, feature_version: record.feature_version,
    research_question: record.research_question, result_path: record.result_path,
    target_definition: record.target_definition, target_type: record.target_type, model_name: record.model_name,
    hyperparameters: record.hyperparameters, random_seed: record.random_seed, split_method: record.split_method,
    train_participants: record.train_participants, validation_participants: record.validation_participants,
    test_participants: record.test_participants, metrics: record.metrics, class_distribution: record.class_distribution,
    training_time_ms: record.training_time_ms, code_model_version: record.code_model_version,
    ml_pipeline_version: record.ml_pipeline_version, training_timestamp: record.training_timestamp,
  }).select().single();
  if (error) throw error; return data;
}
