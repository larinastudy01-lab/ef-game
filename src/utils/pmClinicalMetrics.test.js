import { getPmClinicalMetrics } from "./pmClinicalMetrics";

test("local, cloud and normalized metrics preserve explicit zero and confusion distinctions", () => {
  const raw = { protocolVersion: "2.0.0", scoring: { summary: { promptCount: 0,
    possibleConfusionCount: 2, visualSimilarityConfusionCount: 1, categoryConfusionCount: 1, unrelatedErrorCount: 0 } } };
  for (const record of [raw, { payload: { rawResult: raw } }, { rawResult: raw }, { payload: { metrics: { ...raw.scoring.summary, protocolVersion: "2.0.0" } } }]) {
    expect(getPmClinicalMetrics(record)).toEqual({ promptCount: 0, possibleConfusionCount: 2,
      visualConfusionCount: 1, categoryConfusionCount: 1, unrelatedWrongCount: 0, protocolVersion: "2.0.0" });
  }
});

test("trial fallback sums aliases once and leaves unrecorded historical values unknown", () => {
  const record = { trials: [
    { promptCount: 1, idleHintCount: 1, confusionAnalysis: { possibleConfusionCount: 1, visualSimilarityConfusionCount: 1, visualConfusionCount: 1, categoryConfusionCount: 0, unrelatedWrongCount: 0 } },
    { promptCount: 0, possibleConfusionCount: 1, visualConfusionCount: 0, categoryConfusionCount: 1, unrelatedWrongCount: 1 },
  ] };
  expect(getPmClinicalMetrics(record)).toMatchObject({ promptCount: 1, possibleConfusionCount: 2, visualConfusionCount: 1, categoryConfusionCount: 1, unrelatedWrongCount: 1 });
  expect(getPmClinicalMetrics({ trials: [{ correct: false }] })).toMatchObject({ promptCount: null, possibleConfusionCount: null });
});
