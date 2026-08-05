const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));

export function individualExplanation(artifact, row) {
  const source = row.x ? row : artifact.test.find((item) => item.participant_id === row.participant_id && item.session_id === row.session_id);
  if (!source) throw new Error("Participant-session row was not found in the explanation set.");
  const probability = artifact.targetType === "classification" && artifact.model.predictProbability ? artifact.model.predictProbability(source.x) : null;
  const prediction = artifact.model.predict(source.x);
  let contributions; let method; let baseline;
  if (artifact.model.weights) {
    contributions = artifact.preprocessor.feature_names.map((feature, index) => ({ feature,
      feature_value: source.features?.[feature] ?? null, standardized_value: source.x[index], contribution: artifact.model.weights[index] * source.x[index] }));
    baseline = artifact.model.intercept; method = artifact.targetType === "classification"
      ? "linear_log_odds_shap_training_mean_reference" : "linear_additive_shap_training_mean_reference";
  } else {
    baseline = artifact.model.predict(Array(source.x.length).fill(0)); method = "local_training_mean_perturbation";
    contributions = artifact.preprocessor.feature_names.map((feature, index) => { const replaced = [...source.x]; replaced[index] = 0;
      const without = artifact.targetType === "classification" && artifact.model.predictProbability ? artifact.model.predictProbability(replaced) : artifact.model.predict(replaced);
      const full = artifact.targetType === "classification" && artifact.model.predictProbability ? probability : prediction;
      return { feature, feature_value: source.features?.[feature] ?? null, standardized_value: source.x[index], contribution: full - without }; });
  }
  const ordered = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { participant_id: source.participant_id, session_id: source.session_id, prediction, probability,
    confidence: probability === null ? null : Math.max(probability, 1 - probability), baseline,
    explanation_method: method, contributors: ordered, top_positive_contributors: ordered.filter((item) => item.contribution > 0).slice(0, 5),
    top_negative_contributors: ordered.filter((item) => item.contribution < 0).slice(0, 5),
    additive_probability_note: artifact.targetType === "classification" && artifact.model.weights
      ? `Contributions are additive on log-odds; probability = ${sigmoid(baseline + contributions.reduce((sum, item) => sum + item.contribution, 0)).toFixed(4)}.` : null };
}

