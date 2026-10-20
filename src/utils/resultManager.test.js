import { ALL_RESULTS_KEY, normalizeGameResult, saveUnifiedResult } from "./resultManager";
import { queueGameResult } from "./resultSync";
import { awardTrainingCoins } from "./economyManager";
import { completeActiveRecommendation } from "../analytics/recommendation/onlineRecommendation";

jest.mock("./resultSync", () => ({ queueGameResult: jest.fn() }));
jest.mock("./economyManager", () => ({ awardTrainingCoins: jest.fn(() => ({ awarded: false })) }));
jest.mock("../analytics/recommendation/onlineRecommendation", () => ({ completeActiveRecommendation: jest.fn().mockResolvedValue(null) }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.clearAllMocks();
  awardTrainingCoins.mockReturnValue({ awarded: false });
  completeActiveRecommendation.mockResolvedValue(null);
});

const save = (rawResult, mode = "training", childId = "child-1") => saveUnifiedResult({
  rawResult, mode, gameId: "DCCS", child: { childId },
});

test("SRT variability, actual hints and interval protocol reach the unified clinical payload", () => {
  const rawResult = { rtStd: 0, rtCV: 0, promptCount: 2,
    protocol: { stimulusIntervalsMs: [1000, 3000] },
    longAttentionMetrics: { rtStdIncrease: 20 }, metrics: { goldenPurpose: "game_reward" },
  };
  expect(normalizeGameResult({ rawResult, gameId: "SRT" }).metrics).toMatchObject({
    rtStd: 0, rtCV: 0, promptCount: 2, longAttentionMetrics: { rtStdIncrease: 20 },
    protocol: { stimulusIntervalsMs: [1000, 3000] }, goldenPurpose: "game_reward",
  });
});

test("CBT reminder and playback-click events reach the clinical payload independently", () => {
  const rawResult = { promptCount: 2, earlyClickCount: 1,
    promptEvents: [{ type: "idle_mouse" }, { type: "wrong_answer_hint" }],
    earlyClickEvents: [{ type: "early_click", interpretation: "timing_event_requires_context" }],
    protocol: { answerLimitMs: 15000 },
  };
  expect(normalizeGameResult({ rawResult, gameId: "CBT" }).metrics).toMatchObject(rawResult);
});

test("PM actual prompts, confusion associations and click history reach the unified payload", () => {
  const trials = [{ protocolVersion: "2.0.0", promptCount: 1, selectedIds: ["PM22"], targetIds: ["PM10"],
    tapLogs: [{ action: "select", itemId: "PM22", timestamp: 4000 }],
    confusionAnalysis: { possibleConfusionCount: 1, errors: [{ selectedId: "PM22", matchedTargetIds: ["PM10"], type: "visual_similarity" }] } }];
  const rawResult = { protocolVersion: "2.0.0", trials,
    scoring: { summary: { promptCount: 1, possibleConfusionCount: 1, visualConfusionCount: 1, categoryConfusionCount: 0 } },
    stimulusPolicy: { showTime: 5, answerTimeLimit: 15 } };
  const result = normalizeGameResult({ rawResult, gameId: "PM" });
  expect(result.metrics).toMatchObject({ protocolVersion: "2.0.0", promptCount: 1, possibleConfusionCount: 1, visualConfusionCount: 1, categoryConfusionCount: 0 });
  expect(result.trials[0]).toMatchObject(trials[0]);
  expect(result.rawResult).toEqual(rawResult);
});

test("retrying a completed attempt reuses result and behavioral IDs for cloud upsert", () => {
  const raw = { finishedAt: "2026-09-12T01:32:01.123Z", score: 100, trials: [{ correct: true }] };
  const first = save(raw);
  const retry = save(JSON.parse(JSON.stringify(raw)));
  expect(retry.resultId).toBe(first.resultId);
  expect(retry.behavioral).toEqual(first.behavioral);
  expect(JSON.parse(localStorage.getItem(ALL_RESULTS_KEY))).toHaveLength(1);
  expect(queueGameResult.mock.calls.map(([result]) => result.resultId)).toEqual([first.resultId, first.resultId]);
  expect(JSON.parse(localStorage.getItem("dccsTrainingResult")).resultId).toBe(first.resultId);
});

test("new attempts, children and modes each keep their own result", () => {
  const raw = { finishedAt: "2026-09-12T01:32:01.123Z", score: 100, trials: [{ correct: true }] };
  const results = [save(raw), save({ ...raw, finishedAt: "2026-09-12T01:32:01.456Z" }), save(raw, "test"), save(raw, "training", "child-2")];
  expect(new Set(results.map((result) => result.resultId)).size).toBe(4);
  expect(JSON.parse(localStorage.getItem(ALL_RESULTS_KEY))).toHaveLength(4);
});

test("same raw object without timestamps can be retried without duplicating", () => {
  const raw = { score: 0 };
  expect(save(raw).resultId).toBe(save(raw).resultId);
  expect(JSON.parse(localStorage.getItem(ALL_RESULTS_KEY))).toHaveLength(1);
});
