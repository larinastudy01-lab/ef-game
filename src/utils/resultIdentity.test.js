import { dedupeClinicalRecords, getAttemptKeys } from "./resultIdentity";

const rawResult = {
  finishedAt: "2026-09-12T01:32:01.123Z", difficulty: "typeStable", score: 100,
  trials: [{ correct: true, reactionTime: 976 }],
};
const record = (raw, sourceTable = "localStorage", extra = {}) => ({
  patientId: "child-1", gameKey: "DCCS", type: "training", raw, sourceTable,
  trials: rawResult.trials, ...extra,
});

test("cloud, unified history and legacy caches count as one attempt", () => {
  const unified = { resultId: "result-1", rawResult };
  const cloud = record({ id: "result-1", payload: unified }, "game_results", { id: "cloud" });
  const copies = [record(rawResult), record(unified), cloud, record({ ...rawResult }, "sessionStorage")];
  expect(dedupeClinicalRecords(copies)).toEqual([cloud]);
});

test("two cloud IDs from resaving an identical original attempt collapse", () => {
  const copies = ["one", "two"].map((id) => record({ id, payload: { resultId: id, rawResult } }, "game_results"));
  expect(dedupeClinicalRecords(copies)).toHaveLength(1);
});

test("separate attempts in the same second, children, modes and games stay separate", () => {
  const records = [
    record(rawResult),
    record({ ...rawResult, finishedAt: "2026-09-12T01:32:01.456Z" }),
    record({ ...rawResult, trials: [{ correct: true, reactionTime: 968 }] }),
    record(rawResult, "localStorage", { patientId: "child-2" }),
    record(rawResult, "localStorage", { type: "test" }),
    record(rawResult, "localStorage", { gameKey: "SRT" }),
  ];
  expect(dedupeClinicalRecords(records)).toHaveLength(records.length);
});

test("unknown dates and incomplete records are not accidentally merged", () => {
  const raw = { score: 100, finishedAt: "invalid" };
  expect(getAttemptKeys(raw)).toEqual([]);
  expect(dedupeClinicalRecords([record(raw), record(raw)])).toHaveLength(2);
});

test("explicit IDs reconcile copies even when display metrics differ", () => {
  const cloud = record({ id: "one", score: 100 }, "game_results");
  expect(dedupeClinicalRecords([record({ resultId: "one", score: 99 }), cloud])).toEqual([cloud]);
});
