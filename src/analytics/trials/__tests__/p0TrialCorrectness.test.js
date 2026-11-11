import { buildBehavioralHierarchy } from "../buildBehavioralHierarchy";
import { mapRawTrial } from "../taskFieldMappers";
import { validateTrial, getTrialResponseState } from "../validation";
import { buildTaskFeatureRow } from "../../features/pipeline";

const pmRaw = (extra = {}) => ({ trialNumber: 1, correctIds: ["target"], selectedIds: ["target"],
  isCorrect: true, reactionTime: 1000, ...extra });
const canonical = (raw, index = 0) => {
  const mapped = mapRawTrial(raw, "PM", index);
  return { ...mapped, ...validateTrial(mapped) };
};
const lbTrials = () => ["forward", "red-blue"].flatMap((stageId) => Array.from({ length: 10 }, (_, stepIndex) => ({
  stageId, stepIndex, expectedKey: stageId + stepIndex, clickedKey: stageId + stepIndex,
  isCorrect: true, reactionTime: 500,
})));

test("LB phase-qualified keys preserve all twenty raw steps, order and existing behavioral IDs", () => {
  const raw = lbTrials();
  const before = JSON.stringify(raw);
  const result = { game: { gameId: "LB" }, session: { mode: "test" }, trials: raw,
    behavioral: { sessionId: "s", taskSessionId: "t", trialIds: raw.map((_, index) => "id-" + index) } };
  const first = buildBehavioralHierarchy(result);
  const repeated = buildBehavioralHierarchy(JSON.parse(JSON.stringify(result)));
  expect(new Set(first.trials.map((trial) => trial.sourceTrialKey)).size).toBe(20);
  expect(first.trials[0].sourceTrialKey).toBe("LB:forward:0");
  expect(first.trials[10].sourceTrialKey).toBe("LB:red-blue:0");
  expect(first.trials.map((trial) => trial.trialIndex)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  expect(first.trials.every((trial) => trial.validTrial)).toBe(true);
  expect(first.trials.map((trial) => trial.trialId)).toEqual(repeated.trials.map((trial) => trial.trialId));
  expect(first.trials[10].rawData.stepIndex).toBe(0);
  expect(JSON.stringify(raw)).toBe(before);
  const interrupted = buildBehavioralHierarchy({ ...result, trials: raw.slice(0, 12), session: { mode: "test", status: "interrupted" } });
  expect(new Set(interrupted.trials.map((trial) => trial.sourceTrialKey)).size).toBe(12);
  expect(interrupted.trials.every((trial) => !trial.exclusionReasons.includes("duplicated_trial"))).toBe(true);
});

test("LB legacy records without a stage keep their original explicit source identity", () => {
  expect(mapRawTrial({ trialId: "legacy-1", stepIndex: 0 }, "LB").sourceTrialKey).toBe("legacy-1");
});

test.each([
  ["one correct choice", { deselectCount: 0 }],
  ["wrong choice cancelled", { deselectCount: 1, tapLogs: [{ action: "select", itemId: "wrong" }, { action: "deselect", itemId: "wrong" }] }],
  ["cancelled then selected again", { deselectCount: 1, tapLogs: [{ action: "deselect" }, { action: "select" }] }],
  ["multiple legal cancellations", { deselectCount: 4 }],
  ["legacy absent duplicate fields", {}],
])("PM %s is not inferred to be a double click", (_, extra) => {
  const raw = pmRaw(extra);
  const before = JSON.stringify(raw);
  const trial = canonical(raw);
  expect(trial.validTrial).toBe(true);
  expect(trial.isCorrect).toBe(true);
  expect(trial.rawData).toBe(raw);
  expect(trial.taskSpecificMetadata.deselectCount).toBe(raw.deselectCount);
  expect(JSON.stringify(raw)).toBe(before);
});

test.each([{ doubleClickCount: 1 }, { repeatedClickCount: 2 }, { tapLogs: [{ action: "doubleClick" }] }])(
  "PM explicitly recorded duplicate evidence remains excluded: %j", (extra) => {
    expect(canonical(pmRaw(extra)).exclusionReasons).toContain("accidental_double_click");
  }
);

test.each(["CBT", "SRT", "ARI", "LB", "DCCS"])("%s duplicate-count mapping remains unchanged", (task) => {
  expect(mapRawTrial({ deselectCount: 3 }, task).doubleClickCount).toBe(3);
  expect(mapRawTrial({ repeatedClickCount: 2, deselectCount: 3 }, task).doubleClickCount).toBe(2);
});

const pmFeatures = (raws, status = "completed") => buildTaskFeatureRow({
  taskSession: { task_code: "PM", completion_status: status }, trials: raws.map(canonical),
});
test.each([[12, 0, 0], [12, 3, 0.25], [12, 12, 1], [6, 2, 1 / 3]])(
  "PM timeout denominator includes %i administered trials with %i timeouts", (count, timeouts, expected) => {
    const raws = Array.from({ length: count }, (_, index) => pmRaw({ trialNumber: index + 1,
      isTimeout: index < timeouts, isCorrect: index >= timeouts, reactionTime: index < timeouts ? 15000 : 1000 }));
    const before = JSON.stringify(raws);
    const row = pmFeatures(raws);
    expect(row.pm_timeout_rate).toBeCloseTo(expected);
    expect(row.pm_timeout_trial_count).toBe(timeouts);
    expect(row.pm_administered_trial_count).toBe(count);
    expect(row.pm_timeout_rate_status).toBe("available");
    expect(row.analysis_trial_count).toBe(count - timeouts);
    expect(JSON.stringify(raws)).toBe(before);
  }
);

test("PM never fabricates 0% for exclusively unadministered questions", () => {
  const row = pmFeatures(Array.from({ length: 12 }, (_, index) => pmRaw({ trialNumber: index + 1,
    administered: false, status: "not_administered", isCorrect: null, selectedIds: [], reactionTime: null })));
  expect(row.pm_timeout_rate).toBeNull();
  expect(row.pm_timeout_rate_status).toBe("not_calculable_no_administered_trials");
  expect(row.pm_administered_trial_count).toBe(0);
  expect(getTrialResponseState({ trialNumber: 1, correctIds: ["planned"] }).administered).toBeNull();
});

test("PM keeps timed-out and other excluded administered events even in interrupted sessions", () => {
  const row = pmFeatures([
    pmRaw({ trialNumber: 1, isTimeout: true, isCorrect: false, repeatedClickCount: 1 }),
    pmRaw({ trialNumber: 2, reactionTime: -1 }),
    pmRaw({ trialNumber: 3, administered: false, isCorrect: null }),
  ], "interrupted");
  expect(row.pm_timeout_rate).toBe(0.5);
  expect(row.pm_administered_trial_count).toBe(2);
  expect(row.analysis_trial_count).toBe(0);
  expect(row.exclusion_reason_counts.timeout).toBe(1);
});

test("legacy persisted derivations retain timeout evidence through exclusion reasons", () => {
  const row = buildTaskFeatureRow({ taskSession: { task_code: "PM" }, trials: [
    { is_correct: false, valid_trial: false, exclusion_reasons: ["timeout", "impossible_reaction_time"] },
    { is_correct: true, valid_trial: true, exclusion_reasons: [], actual_response: ["target"] },
  ] });
  expect(row.pm_timeout_rate).toBe(0.5);
});

test("explicit PM response status remains distinct from analytical exclusion", () => {
  const timedOut = canonical(pmRaw({ selectedIds: [], isCorrect: false, responseStatus: "timed_out" }));
  expect(timedOut.timedOut).toBe(true);
  expect(timedOut.exclusionReasons).toContain("timeout");
  const planned = canonical(pmRaw({ administered: false, responseStatus: "not_administered" }));
  expect(planned.exclusionReasons).toContain("not_administered");
});
