import { compareRecords, describeRecord, metricText, recordConditions, taskHistory } from "./professionalMetrics";
import { patientDataStatus } from "./professionalStatus";
import { NORMATIVE_SCORING } from "../config/professionalIndicators";
import { summarizeProfessionalResearch } from "./professionalResearch";

const trial = (correct, rest = {}) => ({ isCorrect: correct, reactionTime: 400, ...rest });
const record = (rest = {}) => ({ id: "r1", patientId: "p1", gameKey: "SRT", type: "test", date: "2026-11-01", difficulty: "easy", raw: { status: "completed", protocolVersion: "srt-v1" }, trials: [trial(true, { targetType: "normal", action: "hit" }), trial(false, { targetType: "normal", action: "miss", reactionTime: null })], ...rest });

test("missing values never become zero and an unknown completion status is not a valid formal assessment", () => {
  const d = describeRecord({ gameKey: "PM", trials: [] });
  expect(d).toMatchObject({ complete: false, accuracy: null, correct: null, total: null, rtMean: null, rtSd: null });
  [null, undefined, "", " ", false, [], NaN, Infinity].forEach((v) => expect(metricText(v, " ms")).toBe("未記錄"));
  expect(metricText(0, "%")).toBe("0%");
  expect(taskHistory([record({ raw: {} })], "SRT").latest).toBeNull();
});
test("SRT keeps Go omissions and No-Go withholds in separate denominators; RT uses correct valid responses only", () => {
  const r = record({ trials: [trial(true, { targetType: "normal", action: "hit", reactionTime: 300 }), trial(false, { targetType: "normal", action: "miss", isTimeout: true, reactionTime: null }), trial(true, { targetType: "rotten", action: "correctReject", reactionTime: null }), trial(false, { targetType: "rotten", action: "clickedRotten", reactionTime: 150 }), trial(true, { targetType: "normal", action: "hit", reactionTime: 500 })] });
  const d = describeRecord(r);
  expect(d.specific).toMatchObject({ commissionRate: 50, goN: 3, noGoN: 2 });
  expect(d.specific.hitRate).toBeCloseTo(200/3); expect(d.specific.omissionRate).toBeCloseTo(100/3);
  expect(d.rtN).toBe(2); expect(d.rtMean).toBe(400); expect(d.rtSd).toBeCloseTo(Math.sqrt(20000));
  expect(d.total).toBe(5);
});
test("marked invalid, unadministered and unfinished trials are excluded; source arrays remain exact", () => {
  const r = record({ trials: [trial(true), trial(true, { valid_trial: false }), trial(false, { administered: false }), trial(false, { completed: false })] });
  const before = JSON.stringify(r); const d = describeRecord(r);
  expect(d.total).toBe(1); expect(d.unknownTrials).toBe(3); expect(JSON.stringify(r)).toBe(before);
});
test("duplicate source keys quarantine derived metrics without deleting raw operations", () => {
  const r = record({ gameKey: "LB", trials: [trial(false, { trialId: "1-4-5" }), trial(true, { trialId: "1-4-5" })] });
  expect(describeRecord(r)).toMatchObject({ integrityError: true, total: null, recordedTrials: 2, status: { tone: "error" } });
  expect(r.trials).toHaveLength(2);
});
test("task metrics honor actual load/condition fields and do not invent stable spans or perseveration", () => {
  const cbt = describeRecord(record({ gameKey: "CBT", trials: [trial(true, { memorySpan: 3 }), trial(false, { memorySpan: 4, errorType: "sequenceError" })] }));
  expect(cbt.specific.maxCorrectLoad).toBe(3); expect(cbt.specific.byLoad[4].accuracy).toBe(0);
  const pm = describeRecord(record({ gameKey: "PM", trials: [trial(false, { memoryCount: 3, scoreValue: .5, wrongTapCount: 1 })] }));
  expect(pm.specific.partialScores).toEqual([.5]); expect(pm.specific.stableSpan).toBeUndefined();
  const dccs = describeRecord(record({ gameKey: "DCCS", trials: [trial(false, { ruleStage: "bagColor", isPostSwitch: true })] }));
  expect(dccs.specific.switchErrors).toBe(1); expect(dccs.specific.perseverationCount).toBeNull();
  const dual = describeRecord(record({ gameKey: "DCCS", trials: [trial(true, { ruleStage: "dualRule", matchBy: "color" }), trial(false, { ruleStage: "dualRule", matchBy: "type" })] }));
  expect(dual.specific.byRule.color.accuracy).toBe(100); expect(dual.specific.byRule.type.accuracy).toBe(0);
  expect(describeRecord(record({ gameKey: "LB" })).specific.completion).toBeNull();
});
test("comparison requires task, mode, difficulty, protocol and condition composition; gaps are never matches", () => {
  const a = record(); const b = record({ id: "r2", date: "2026-11-02", trials: [trial(true, { targetType: "normal", action: "hit" }), trial(true, { targetType: "normal", action: "hit" })] });
  expect(compareRecords(a,b)).toMatchObject({ comparable: true, change: 50 });
  expect(compareRecords(a, { ...b, type: "training" }).comparable).toBe(false);
  expect(compareRecords(a, { ...b, raw: { status: "completed" } }).reasons).toContain("施測版本未完整記錄");
  expect(compareRecords(a, { ...b, difficulty: "hard" }).change).toBeNull();
  expect(compareRecords(a, { ...b, trials: b.trials.slice(0,1) }).reasons).toContain("題次條件組成不同");
  expect(compareRecords(a, { ...b, patientId: "other" }).comparable).toBe(false);
  expect(recordConditions(a).composition).toBe(recordConditions(b).composition);
});
test("low accuracy never creates a clinical risk status; normative scoring stays disabled", () => {
  const low = record({ trials: [trial(false)] });
  expect(patientDataStatus([low], describeRecord).label).toBe("品質檢查通過");
  expect(NORMATIVE_SCORING.enabled).toBe(false);
});
test("ARI uses recorded animals and stimulus versions rather than interpreting legacy role names as stimuli", () => {
  const r = record({ gameKey: "ARI", trials: [trial(true, { soundType: "cat", soundAnimal: "pig", stimulusAnimalLabels: { cat: "小豬", dog: "綿羊" }, stimulusSetId: "test01" })], raw: { status: "completed", taskVersion: "v3", testVersion: "01", protocol: { totalTrials: 20, answerTimeLimit: 5000 } } });
  expect(describeRecord(r).specific.conditions).toHaveProperty("小豬");
  expect(describeRecord(r).specific.conditions.cat).toBeUndefined();
  const different = { ...r, raw: { ...r.raw, testVersion: "02" } };
  expect(compareRecords(r,different).reasons).toContain("題本版本不同");
  expect(recordConditions(r).protocol).toContain("已記錄設定");
  const legacy = record({ gameKey: "ARI", trials: [trial(true, { soundType: "cat" })] });
  expect(describeRecord(legacy).specific.conditions).toHaveProperty("聲音角色 A（動物未記錄）");
});
test("research summary counts only completed records with known valid outcomes, retaining the raw denominator", () => {
  const inputs = [{ participantId: "a", taskSession: { task_code: "CBT", completion_status: "completed" }, trials: [{ is_correct: true, valid_trial: true, reaction_time_ms: 500 }, { administered: false }] }, { participantId: "b", taskSession: { task_code: "PM", completion_status: "interrupted" }, trials: [{ is_correct: false }] }];
  expect(summarizeProfessionalResearch(inputs)).toMatchObject({ validParticipantCount: 1, validTrials: 1, recordedTrials: 3 });
  expect(summarizeProfessionalResearch(inputs).completeness).toBeCloseTo(100/3);
});
