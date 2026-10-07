import { ALL_RESULTS_KEY, saveUnifiedResult } from "./resultManager";
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
