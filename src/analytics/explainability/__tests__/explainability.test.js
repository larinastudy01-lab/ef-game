import { analyzeModelExplainability } from "../pipeline";
import { assertNonDiagnosticText, buildBehavioralNarrative } from "../narrative";
import { generateSyntheticDataset } from "../../ml/synthetic";

test("global and individual explanations are derived from the selected model", () => {
  const rows = generateSyntheticDataset({ participants: 24, sessionsPerParticipant: 1, targetType: "regression", seed: 17 });
  const result = analyzeModelExplainability(rows, { targetType: "regression", demoMode: true, includeComparison: false, folds: 3, seed: 17 });
  expect(result.global_importance.length).toBeGreaterThan(0);
  expect(result.global_importance[0]).toEqual(expect.objectContaining({ feature: expect.any(String), importance: expect.any(Number) }));
  expect(result.individual_explanations.length).toBeGreaterThan(0);
  expect(result.model_name).toMatch(/Linear Regression|Decision Tree Regressor/);
  if (result.model_name === "Linear Regression") expect(result.shap_summary[0]).toEqual(expect.objectContaining({ mean_absolute_shap: expect.any(Number) }));
  else expect(result.shap_summary).toBeNull();
  expect(result.data_mode).toBe("DEMO / SYNTHETIC DATA");
});

test("linear individual contributions reproduce the prediction scale", () => {
  const rows = generateSyntheticDataset({ participants: 20, sessionsPerParticipant: 1, targetType: "regression", seed: 4 });
  const result = analyzeModelExplainability(rows, { targetType: "regression", demoMode: true, includeComparison: false, folds: 3, seed: 4 });
  const individual = result.individual_explanations[0];
  if (individual.explanation_method.includes("linear")) {
    const reconstructed = individual.baseline + individual.contributors.reduce((sum, item) => sum + item.contribution, 0);
    expect(reconstructed).toBeCloseTo(individual.prediction, 8);
  } else expect(individual.explanation_method).toBe("local_training_mean_perturbation");
});

test("fold stability is disclosed rather than hidden", () => {
  const rows = generateSyntheticDataset({ participants: 24, targetType: "classification", seed: 8 });
  const result = analyzeModelExplainability(rows, { targetType: "classification", demoMode: true, includeComparison: false, folds: 3, seed: 8 });
  expect(["stable", "mixed", "unstable"]).toContain(result.importance_stability.stability_label);
  expect(result.importance_stability.disclosure).toMatch(/fold/i);
});

test("human-readable explanation remains non-diagnostic", () => {
  const narrative = buildBehavioralNarrative({ contributors: [{ feature: "rt_variability_ms", contribution: 0.4 }] });
  expect(assertNonDiagnosticText(narrative)).toContain("行為表現關聯");
  expect(() => assertNonDiagnosticText("此幼兒具有注意力障礙")).toThrow("Diagnostic language");
});
