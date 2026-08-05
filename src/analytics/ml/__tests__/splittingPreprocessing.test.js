import { groupKFold, participantHoldout, stratifiedGroupKFold } from "../splitting";
import { fitPreprocessor, transformRows } from "../preprocessing";

const rows = Array.from({ length: 12 }, (_, index) => ({ participant_id: `P${Math.floor(index / 2)}`,
  target: index % 2, features: { x: index, missing: index === 11 ? 9999 : null } }));

test("GroupKFold never places one participant in train and test", () => {
  groupKFold(rows, 3).forEach((fold) => {
    const train = new Set(fold.train.map((row) => row.participant_id));
    expect(fold.test.every((row) => !train.has(row.participant_id))).toBe(true);
  });
});

test("StratifiedGroupKFold remains participant-safe", () => {
  stratifiedGroupKFold(rows, 3).forEach((fold) => {
    const train = new Set(fold.train.map((row) => row.participant_id));
    expect(fold.test.every((row) => !train.has(row.participant_id))).toBe(true);
  });
});

test("imputation and scaling are fitted from training rows only", () => {
  const training = rows.slice(0, 10); const testing = rows.slice(10);
  const fitted = fitPreprocessor(training);
  expect(fitted.fitted_participants).not.toContain("P5");
  expect(fitted.feature_names).toEqual(["x"]);
  expect(transformRows(testing, fitted)[0].x[0]).toBeGreaterThan(1);
});

test("outer test participants are untouched by development data", () => {
  const split = participantHoldout(rows, 0.2);
  const test = new Set(split.test_participants);
  expect(split.development.every((row) => !test.has(row.participant_id))).toBe(true);
});
