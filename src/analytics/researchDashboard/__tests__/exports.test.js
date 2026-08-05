import { buildResearchExportBundle, buildRawTrialRows, rowsToCsv } from "../exports";

test("raw export uses immutable acquisition payload and anonymous participant id", () => {
  const rows = buildRawTrialRows([{ participantId: "P-ANON", sessionId: "S1", taskSession: { id: "TS1", task_code: "SRT" },
    rawTrials: [{ id: "TR1", source_trial_key: "one", trial_index: 1, raw_schema_version: "raw_v1", raw_data: { click: true } }] }]);
  expect(rows[0]).toEqual(expect.objectContaining({ participant_id: "P-ANON", raw_data: { click: true } }));
  expect(rows[0].name).toBeUndefined(); expect(rows[0].email).toBeUndefined();
});

test("CSV safely serializes nested values and quotes delimiters", () => {
  const csv = rowsToCsv([{ participant_id: "P1", context: { note: "a,b" } }]);
  expect(csv).toContain('"{""note"":""a,b""}"');
});

test("research bundle exposes the six required export files without identifiers", () => {
  const bundle = buildResearchExportBundle({ taskRows: [{ participant_id: "P1", session_id: "S1", task_code: "CBT", accuracy: .8 }],
    recommendations: [{ id: "R1", participant_id: "P1", selected_action: { task_code: "CBT" } }] });
  expect(Object.keys(bundle)).toEqual(["raw_trials.csv", "task_features.csv", "participant_features.csv", "statistics.csv", "prediction.csv", "recommendation.csv"]);
  expect(Object.values(bundle).join("\n")).not.toMatch(/full_name|email|nickname/i);
});

