import { buildReadableResearchExport, buildReadableTrialTable } from "../readableExports";
import { buildRawTrialRows, rowsToCsv } from "../exports";

const input = (code, raw) => ({ participantId: "participant-uuid", sessionId: "session-uuid",
  taskSession: { id: `${code}-session`, task_code: code, difficulty: 3 }, sessionMetadata: { assessment_or_training: "assessment" },
  rawTrials: [{ id: `${code}-trial`, trial_index: 1, source_trial_key: "source-1", raw_data: raw, raw_schema_version: "1.0.0" }],
  trials: [{ is_correct: true, reaction_time_ms: 999, valid_trial: false }] });

test.each([
  ["CBT", { targetSequence: [2, 1], userSequence: [1, 2] }, [2, 1], [1, 2]],
  ["PM", { correctIds: ["p1"], selectedIds: [], responseStatus: "timeout" }, ["p1"], []],
  ["SRT", { shouldClick: false, action: "withhold", targetType: "rotten" }, false, "withhold"],
  ["ARI", { expectedTarget: "dog", selectedTarget: "cat", soundType: "cat" }, "dog", "cat"],
  ["LB", { expectedKey: "red-2", clickedKey: "blue-2", stageId: "stage2" }, "red-2", "blue-2"],
  ["DCCS", { correctSide: "left", userAnswerSide: "right", cardColor: "red" }, "left", "right"],
])("%s exposes the actual acquisition answers without filling from derived trials", (code, raw, expected, actual) => {
  const source = input(code, raw); const before = JSON.stringify(source);
  const { rows } = buildReadableTrialTable([source]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ participant_id: "participant-uuid", trial_id: `${code}-trial`, expected_response: expected,
    actual_response: actual, is_correct: null, reaction_time_ms: null, is_timeout: null });
  expect(rows[0].condition).toBe(code === "LB" ? "stage2" : null);
  expect(JSON.stringify(source)).toBe(before);
});

test("false, zero, versions and sequence values survive CSV export and source bytes stay unchanged", () => {
  const source = input("CBT", { targetSequence: [2, 1], userSequence: [], isCorrect: false, reactionTime: 0,
    isTimeout: false, testVersion: "02", difficulty: 0, email: "private@example.com", nickname: "private-name" });
  const rawBefore = rowsToCsv(buildRawTrialRows([source]));
  const result = buildReadableResearchExport({ inputs: [source], taskRows: [{ participant_id: "participant-uuid", task_code: "CBT", accuracy: .75 }] });
  expect(result.trials.rows[0]).toMatchObject({ is_correct: false, reaction_time_ms: 0, is_timeout: false, test_version: "02", difficulty: 0 });
  expect(result.files["逐題作答資料.csv"]).toContain('"[2,1]",[],false,0,false');
  expect(result.files["逐題作答資料.csv"]).not.toMatch(/private@example|private-name|email|nickname/);
  expect(result.files["場次摘要.csv"]).toContain("正確率（%）");
  expect(result.files["場次摘要.csv"]).toContain(",75,");
  expect(result.files["欄位說明.csv"]).toContain("Auditory Rule Inhibition");
  expect(rowsToCsv(buildRawTrialRows([source]))).toBe(rawBefore);
});

test("unavailable raw trials remain absent and task fields have separate documented columns", () => {
  const noRaw = { ...input("PM", {}), rawTrials: [] };
  expect(buildReadableTrialTable([noRaw]).rows).toEqual([]);
  const source = input("PM", { memoryCount: 2, tapLogs: [{ action: "select", id: "a,b" }] });
  const result = buildReadableResearchExport({ inputs: [source] });
  expect(result.trials.columns.map((column) => column.label)).toContain("記憶數量");
  expect(result.trials.columns.map((column) => column.label)).not.toContain("卡片顏色");
  expect(result.files["欄位說明.csv"]).toContain("raw_data.tapLogs");
  expect(result.files["逐題作答資料.csv"]).toContain('"[{""action"":""select"",""id"":""a,b""}]"');
});
