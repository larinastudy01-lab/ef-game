import { runMlExperiment } from "../pipeline";
import { generateSyntheticDataset } from "../synthetic";
import { persistExperiment } from "../experimentTracking";

test("regression baselines produce grouped CV metrics", () => {
  const rows = generateSyntheticDataset({ participants: 12, targetType: "regression" });
  const result = runMlExperiment(rows, { targetType: "regression", demoMode: true, includeComparison: false, folds: 3 });
  expect(result.data_mode).toBe("DEMO / SYNTHETIC DATA");
  expect(result.experiments.map((item) => item.model_name)).toEqual(["Linear Regression", "Decision Tree Regressor"]);
  expect(result.experiments.every((item) => Number.isFinite(item.metrics.mae))).toBe(true);
});

test("classification reports distribution and required metrics", () => {
  const rows = generateSyntheticDataset({ participants: 16, targetType: "classification" });
  const result = runMlExperiment(rows, { targetType: "classification", demoMode: true, includeComparison: false, folds: 4 });
  expect(result.split_method).toBe("ParticipantHoldout + StratifiedGroupKFold"); expect(Object.keys(result.class_distribution)).toHaveLength(2);
  expect(result.experiments[0].metrics).toEqual(expect.objectContaining({ accuracy: expect.any(Number), f1: expect.any(Number) }));
  expect(result.experiments[0].metrics.confusion_matrix).toEqual(expect.objectContaining({ tn: expect.any(Number), tp: expect.any(Number) }));
});

test("synthetic experiments are rejected by persistent research tracking", async () => {
  await expect(persistExperiment({}, { is_demo: true })).rejects.toThrow("must not be persisted");
});

test("classification refuses a one-class target", () => {
  const rows = generateSyntheticDataset({ participants: 6, targetType: "classification" }).map((row) => ({ ...row, target: 1 }));
  expect(() => runMlExperiment(rows, { targetType: "classification", demoMode: true })).toThrow("two outcome classes");
});
