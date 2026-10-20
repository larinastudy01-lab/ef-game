import { analyzeLBTraining, getLBInitialTrainingConfig } from "./lbTrainingAnalyzer";
import { getLBTrainingConfig } from "../utils/lbProtocol";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test.each([1, 2, 3, 4, 5])("LB recommendation %i selects one fixed protocol rather than adding a second assistance scale", (level) => {
  const initial = getLBInitialTrainingConfig({ defaultDifficulty: level });
  expect(initial.recommendedLevelIndex).toBe(level - 1);
  expect(initial.trainingConfig).toEqual(getLBTrainingConfig(level));
  const analysis = analyzeLBTraining({ currentDifficulty: level, records: [
    { isCorrect: false, status: "timeout", hintShown: true, reactionTime: 15000 },
  ], maximumLevelIndex: 11 });
  const config = getLBTrainingConfig(analysis.nextDifficultyLevel);
  expect(analysis.nextTrainingConfig).toEqual(config);
  expect(analysis.nextLevelIndex).toBe(config.difficultyLevel - 1);
  expect(analysis.recommendedLevelRange.suggestedLevelIds).toEqual([config.id]);
});
