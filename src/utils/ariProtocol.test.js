import { ARI_DIFFICULTY_ORDER, getAriTrainingConfig, normalizeAriDifficulty } from "./ariProtocol";
import { calculateAriScore } from "./ariScoring";
import { analyzeAriTraining } from "../ai/ariTrainingAnalyzer";
import { getAriClinicalMetrics } from "./ariClinicalMetrics";
import { normalizeGameResult } from "./resultManager";
import { createRecordWorkbook } from "./clinicianExcelExport";
import { achievementDifficultyKey } from "./achievementProtocol";

jest.mock("./resultSync", () => ({ queueGameResult: jest.fn() }));

const records = (difficulty) => Array.from({ length: 12 }, (_, index) => ({
  trialIndex: index + 1, mode: "training", difficulty, soundType: index % 2 ? "cat" : "dog",
  expectedTarget: index % 2 ? "dog" : "cat", selectedTarget: index % 2 ? "dog" : "cat",
  correctPosition: index % 2 ? "left" : "right", selectedPosition: index % 2 ? "left" : "right",
  isCorrect: true, targetCorrect: true, reactionTime: 1200, timeout: false,
}));

test.each(ARI_DIFFICULTY_ORDER)("%s keeps its identity in scoring, recommendation, and achievement evidence", (difficulty) => {
  const scoring = calculateAriScore(records(difficulty), { mode: "training", difficulty, plannedTotalRounds: 12 });
  expect(scoring).toMatchObject({ difficulty, difficultyLabel: getAriTrainingConfig(difficulty).label, scoringVersion: "3.0.0" });
  expect(achievementDifficultyKey(difficulty, "ARI")).toBe(difficulty);
  const analysis = analyzeAriTraining({ records: records(difficulty), difficultyKey: difficulty, plannedTotalRounds: 12 });
  expect(analysis.currentDifficulty).toBe(difficulty);
  const config = getAriTrainingConfig(analysis.recommendedDifficulty);
  expect(analysis.nextRoundConfig).toMatchObject({
    difficulty: config.difficulty, hintLevel: config.hintLevel,
    answerTimeLimit: config.answerTimeLimit, suggestedAnswerTimeLimit: config.answerTimeLimit,
    allowSoundReplay: config.allowReplay, interference: config.interference, recommendedRoundLength: 12,
  });
});

test("legacy normal difficulty resolves to medium for training, while formal scoring retains its original definition", () => {
  expect(normalizeAriDifficulty("normal")).toBe("medium");
  expect(normalizeAriDifficulty(5)).toBe("expert");
  const scoring = calculateAriScore(records("normal"), { mode: "test", difficulty: "normal", plannedTotalRounds: 20 });
  expect(scoring).toMatchObject({ difficulty: "normal", difficultyLabel: "普通", scoringVersion: "2.0.0" });
});

test("actual reminders and replay counts reach local/cloud clinical views and Excel in the correct units", () => {
  const raw = { gameId: "ARI", mode: "training", protocolVersion: "3.0.0", protocol: { answerTimeLimit: 10000 },
    promptCount: 2, idleHintCount: 1, consecutiveErrorHintCount: 1, replayCount: 1,
    promptEvents: [{ reason: "idle" }, { reason: "consecutive_errors" }], replayEvents: [{ reason: "replay" }] };
  const normalized = normalizeGameResult({ rawResult: raw, gameId: "ARI", mode: "training" });
  expect(normalized.metrics).toMatchObject({ promptCount: 2, idleHintCount: 1, consecutiveErrorHintCount: 1, replayCount: 1, answerTimeLimit: 10000 });
  const expected = { promptCount: 2, idleHintCount: 1, consecutiveErrorHintCount: 1, replayCount: 1, answerTimeLimitMs: 10000 };
  for (const item of [raw, normalized, { payload: normalized }, { payload: { metrics: normalized.metrics } }]) {
    expect(getAriClinicalMetrics(item)).toMatchObject(expected);
  }
  const book = createRecordWorkbook({ records: [{ id: "ari", ...getAriClinicalMetrics(raw) }], formatDate: (value) => value });
  const sheet = book.getWorksheet("紀錄摘要");
  expect(["R2", "W2", "AD2", "AE2", "AF2"].map((cell) => sheet.getCell(cell).value)).toEqual([2, 1, 1, 1, 10]);
});

test("legacy records without reminder data stay unknown, and explicit empty event lists represent zero", () => {
  expect(getAriClinicalMetrics({})).toMatchObject({ promptCount: null, replayCount: null });
  expect(getAriClinicalMetrics({ promptEvents: [], replayEvents: [] })).toMatchObject({ promptCount: 0, idleHintCount: 0, consecutiveErrorHintCount: 0, replayCount: 0 });
});
