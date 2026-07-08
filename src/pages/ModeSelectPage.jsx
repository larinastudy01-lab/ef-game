import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import modelBackground from "../asset/home/model_background.png";
import cardBg from "../asset/home/card.png";
import testMapButton from "../asset/home/testmap.png";
import trainingMapButton from "../asset/home/trainingmap.png";
import testIcon from "../asset/test.png";
import trainingIcon from "../asset/training.png";

/**
 * ModeSelectPage.jsx / ModelSelectPage.jsx
 *
 * 更新重點：
 * - 背景使用 asset/home/model_background.png
 * - 卡片使用 asset/home/card.png
 * - 測驗按鈕使用 asset/home/testmap.png
 * - 訓練按鈕使用 asset/home/trainingmap.png
 * - 已移除標題下方說明文字與兩張卡片底部說明文字
 * - 「查看孩子紀錄」與「最近訓練」交換位置，避免重疊
 * - 回首頁實際導向選擇小孩頁面 /child-select
 * - 依需求：測驗右上 icon 使用 asset/training.png；訓練右上 icon 使用 asset/test.png
 * - 點擊「進入訓練地圖」後，先選擇訓練時間與訓練項目
 * - 若完全沒有選擇項目，會使用推薦訓練
 * - 一次訓練最多 12 關
 */

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getCurrentChild = () =>
  safeParse(localStorage.getItem("currentChild")) ||
  safeParse(sessionStorage.getItem("currentChild"));

const saveSelectedMode = (mode) => {
  localStorage.setItem("selectedMode", mode);
  sessionStorage.setItem("selectedMode", mode);
};

const saveTrainingSettings = (settings) => {
  const serializedSettings = JSON.stringify(settings);
  localStorage.setItem("trainingSettings", serializedSettings);
  sessionStorage.setItem("trainingSettings", serializedSettings);
  localStorage.setItem("ef_game_training_settings", serializedSettings);
  sessionStorage.setItem("ef_game_training_settings", serializedSettings);
};

const RESULT_STORAGE_KEYS = [
  "srtTrainingResult",
  "pmTrainingResult",
  "cbtTrainingResult",
  "dptTrainingResult",
  "dccsTrainingResult",
  "lbTrainingResult",
];

const GAME_LABELS = {
  srtTrainingResult: "反應小松鼠",
  pmTrainingResult: "記憶收藏家",
  cbtTrainingResult: "石頭記憶任務",
  dptTrainingResult: "專注小幫手",
  dccsTrainingResult: "規則小隊長",
  lbTrainingResult: "順序切換任務",
};

const TRAINING_GAME_IDS = ["srt", "pm", "cbt", "dpt", "dccs", "lb"];

const TRAINING_GAME_TITLES = [
  "幫小飛鼠弟弟接住掉落的橡實",
  "找出兔子妹妹遺失的物品",
  "記住跳石橋的密碼幫助鹿先生",
  "幫狐狸夫婦把物品上的蒼蠅趕走",
  "幫孔雀小姐的服飾店分類混亂的衣物",
  "引導迷路的綿羊奶奶回家",
];

const TRAINING_GAME_ABILITIES = [
  "訓練反應速度、持續注意與抑制衝動，練習看準目標後再點擊。",
  "訓練工作記憶與延宕回憶，練習記住物品位置與順序。",
  "訓練視覺空間記憶與序列記憶，練習記住路徑並依序作答。",
  "訓練選擇性注意與左右判斷，練習忽略干擾並找出探測位置。",
  "訓練規則轉換與分類能力，練習依照顏色或形狀快速切換規則。",
  "訓練排序、反向排序與認知彈性，練習依規則完成數字順序。",
];

const TRAINING_GAME_OPTIONS = TRAINING_GAME_IDS.map((id, index) => ({
  id,
  title: TRAINING_GAME_TITLES[index],
  ability: TRAINING_GAME_ABILITIES[index],
}));

const MAX_TRAINING_LEVELS = 12;
const MAX_RECENT_LEVEL_RESULTS = 30;

const RESULT_KEYS_BY_GAME_ID = {
  srt: ["srtTrainingResult", "srtTestResult", "srtResults", "srtHistory"],
  pm: ["pmTrainingResult", "pmTestResult", "pmResults", "pmHistory"],
  cbt: ["cbtTrainingResult", "cbtTestResult", "cbtResults", "cbtHistory"],
  dpt: ["dptTrainingResult", "dptTestResult", "dptResults", "dptHistory"],
  dccs: ["dccsTrainingResult", "dccsTestResult", "dccsResults", "dccsHistory"],
  lb: ["lbTrainingResult", "lbTestResult", "lbResults", "lbHistory"],
};

const readStorageValue = (key) =>
  safeParse(localStorage.getItem(key)) ?? safeParse(sessionStorage.getItem(key));

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const getResultTimestamp = (result) => {
  const raw =
    result?.createdAt ||
    result?.timestamp ||
    result?.completedAt ||
    result?.date ||
    result?.playedAt;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizePercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 1) return number * 100;
  return Math.max(0, Math.min(100, number));
};

const getScoreForRecommendation = (result) => {
  if (!result || typeof result !== "object") return null;

  const percentCandidates = [
    result.accuracy,
    result.correctRate,
    result.successRate,
    result.percentage,
    result.percent,
  ];

  for (const value of percentCandidates) {
    const score = normalizePercent(value);
    if (score !== null) return score;
  }

  const correct = Number(result.correctCount ?? result.correct ?? result.hits);
  const total = Number(result.totalCount ?? result.total ?? result.trialCount);
  if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, (correct / total) * 100));
  }

  const stars = Number(result.stars ?? result.star ?? result.totalStars);
  if (Number.isFinite(stars)) {
    const maxStars = Number(result.maxStars) || 3;
    return Math.max(0, Math.min(100, (stars / maxStars) * 100));
  }

  const score = Number(result.score ?? result.totalScore);
  if (Number.isFinite(score)) {
    const maxScore = Number(result.maxScore);
    return Number.isFinite(maxScore) && maxScore > 0
      ? Math.max(0, Math.min(100, (score / maxScore) * 100))
      : Math.max(0, Math.min(100, score));
  }

  if (typeof result.isCorrect === "boolean") return result.isCorrect ? 100 : 0;
  if (typeof result.correct === "boolean") return result.correct ? 100 : 0;

  return null;
};

const extractLevelResults = (value, inheritedTimestamp = 0) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractLevelResults(item, inheritedTimestamp));
  }

  if (typeof value !== "object") return [];

  const timestamp = getResultTimestamp(value) || inheritedTimestamp;
  const nestedKeys = [
    "levelResults",
    "levels",
    "roundResults",
    "rounds",
    "trialResults",
    "trials",
    "questions",
    "records",
    "history",
    "sessions",
    "results",
  ];

  const nested = nestedKeys.flatMap((key) =>
    Array.isArray(value[key])
      ? value[key].flatMap((item) => extractLevelResults(item, timestamp))
      : []
  );

  const ownScore = getScoreForRecommendation(value);
  const own = ownScore === null ? [] : [{ score: ownScore, timestamp }];

  // 有單關明細時以單關為主，避免同一場的總分與單關重複計算。
  return nested.length > 0 ? nested : own;
};

const getAllLevelResultsForGame = (gameId) => {
  const keys = RESULT_KEYS_BY_GAME_ID[gameId] || [];

  return keys
    .flatMap((key) => asArray(readStorageValue(key)))
    .flatMap((result) => extractLevelResults(result))
    .filter((result) => Number.isFinite(result.score))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_RECENT_LEVEL_RESULTS);
};

const getLatestTrainingResult = () => {
  const results = RESULT_STORAGE_KEYS.flatMap((key) =>
    asArray(readStorageValue(key)).map((data) => ({
      key,
      createdAt: getResultTimestamp(data),
      ...data,
    }))
  );

  return results.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
};

const getTrainingRecommendations = () => {
  const recommendations = TRAINING_GAME_OPTIONS.map((game, index) => {
    const levelResults = getAllLevelResultsForGame(game.id);
    const scores = levelResults.map((result) => result.score);
    const averageScore = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;

    // 越近期的關卡權重越高，讓剛完成的弱項能立即進入推薦清單。
    const weightedScore = scores.length
      ? scores.reduce((sum, score, scoreIndex) => {
          const weight = Math.max(1, scores.length - scoreIndex);
          return sum + score * weight;
        }, 0) /
        scores.reduce((sum, _, scoreIndex) => sum + Math.max(1, scores.length - scoreIndex), 0)
      : null;

    return {
      id: game.id,
      index,
      resultCount: scores.length,
      averageScore,
      recommendationScore: weightedScore,
    };
  });

  return recommendations.sort((a, b) => {
    if (a.resultCount === 0 && b.resultCount > 0) return 1;
    if (b.resultCount === 0 && a.resultCount > 0) return -1;
    if (a.recommendationScore !== b.recommendationScore) {
      return (a.recommendationScore ?? 101) - (b.recommendationScore ?? 101);
    }
    return a.index - b.index;
  });
};

const getRecommendedTrainingGameIds = (recommendations) =>
  recommendations.map((item) => item.id);

const buildTrainingLevelPlan = (gameIds, recommendations = []) => {
  if (!gameIds.length) return [];

  const recommendationMap = new Map(
    recommendations.map((item) => [item.id, item])
  );

  // 手動只選一項時仍正常排滿；自動推薦時，弱項會分配到較多關卡。
  const weightedPool = gameIds.flatMap((gameId, index) => {
    const item = recommendationMap.get(gameId);
    if (!item || item.resultCount === 0) return [gameId];

    const score = item.recommendationScore ?? 100;
    const weight = score < 50 ? 4 : score < 70 ? 3 : score < 85 ? 2 : 1;
    return Array.from({ length: weight }, () => gameId);
  });

  const plan = [];
  let cursor = 0;
  while (plan.length < MAX_TRAINING_LEVELS) {
    plan.push(weightedPool[cursor % weightedPool.length]);
    cursor += 1;
  }

  return plan;
};

const ModeSelectPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const child = location.state?.child || getCurrentChild();
  const latestTraining = useMemo(() => getLatestTrainingResult(), []);
  const [isTrainingSettingOpen, setIsTrainingSettingOpen] = useState(false);
  const [trainingMinutes, setTrainingMinutes] = useState(20);
  const [selectedTrainingGameIds, setSelectedTrainingGameIds] = useState([]);
  const [isRecommendationApplied, setIsRecommendationApplied] = useState(false);

  const trainingRecommendations = useMemo(() => getTrainingRecommendations(), []);
  const recommendedTrainingGameIds = useMemo(
    () => getRecommendedTrainingGameIds(trainingRecommendations),
    [trainingRecommendations]
  );

  const getTrainingGameTitles = (gameIds) =>
    TRAINING_GAME_OPTIONS.filter((game) => gameIds.includes(game.id)).map((game) => game.title);

  const selectedTrainingGameTitles = useMemo(
    () => getTrainingGameTitles(selectedTrainingGameIds),
    [selectedTrainingGameIds]
  );

  const recommendedTrainingGameTitles = useMemo(
    () => getTrainingGameTitles(recommendedTrainingGameIds),
    [recommendedTrainingGameIds]
  );

  const toggleTrainingGame = (gameId) => {
    setIsRecommendationApplied(false);
    setSelectedTrainingGameIds((currentIds) =>
      currentIds.includes(gameId)
        ? currentIds.filter((id) => id !== gameId)
        : [...currentIds, gameId]
    );
  };

  const selectAllTrainingGames = () => {
    setIsRecommendationApplied(false);
    setSelectedTrainingGameIds(TRAINING_GAME_IDS);
  };

  const clearTrainingGames = () => {
    setIsRecommendationApplied(false);
    setSelectedTrainingGameIds([]);
  };

  const applyRecommendedTraining = () => {
    setIsRecommendationApplied(true);
    setSelectedTrainingGameIds(recommendedTrainingGameIds);
  };

  const closeTrainingSetting = () => {
    setIsTrainingSettingOpen(false);
  };

  const startTest = () => {
    saveSelectedMode("test");
    navigate("/test-map", {
      state: {
        child,
        mode: "test",
      },
    });
  };

  const startTraining = () => {
    setIsTrainingSettingOpen(true);
  };

  const confirmTrainingSettings = () => {
    const isUsingRecommendation =
      selectedTrainingGameIds.length === 0 || isRecommendationApplied;
    const finalTrainingGameIds = isUsingRecommendation
      ? recommendedTrainingGameIds
      : selectedTrainingGameIds;
    const finalTrainingGameTitles = isUsingRecommendation
      ? recommendedTrainingGameTitles
      : selectedTrainingGameTitles;
    const trainingLevelPlan = buildTrainingLevelPlan(
      finalTrainingGameIds,
      isUsingRecommendation ? trainingRecommendations : []
    );

    if (finalTrainingGameIds.length === 0) return;

    saveSelectedMode("training");

    const trainingSettings = {
      minutes: trainingMinutes,
      trainingMinutes,
      maxTrainingLevels: MAX_TRAINING_LEVELS,
      trainingLevelCount: trainingLevelPlan.length,
      levelCount: trainingLevelPlan.length,
      trainingLevelPlan,
      abilities: finalTrainingGameIds,
      selectedAbilities: finalTrainingGameIds,
      trainingGameIds: finalTrainingGameIds,
      selectedTrainingGameIds: finalTrainingGameIds,
      abilityTitles: finalTrainingGameTitles,
      trainingGameTitles: finalTrainingGameTitles,
      recommendedTrainingGameIds,
      recommendationDetails: trainingRecommendations,
      recommendationSource: "level-results",
      isAutoRecommended: isUsingRecommendation,
      recommendationReason: isUsingRecommendation
        ? "系統依每一關的近期作答結果，優先安排需要加強的訓練。"
        : "家長手動選擇訓練項目。",
      childId: child?.id || child?.childId || null,
      createdAt: new Date().toISOString(),
    };

    saveTrainingSettings(trainingSettings);

    navigate("/game-menu", {
      state: {
        child,
        mode: "training",
        trainingSettings,
      },
    });
  };

  const openHistory = () => {
    navigate("/result-pa", {
      state: {
        child,
        fromModeSelect: true,
      },
    });
  };

  const backToChildSelect = () => {
    navigate("/child-select", {
      state: {
        child,
        fromModeSelect: true,
      },
    });
  };

  return (
    <main className="model-select-page">
      <button
        type="button"
        className="model-select-back"
        onClick={backToChildSelect}
        aria-label="回到選擇孩子頁面"
      >
        ← 回首頁
      </button>

      <section className="model-select-content" aria-label="選擇模式">
        <div className="model-title-board" aria-hidden="true">
          <span>選</span>
          <span>擇</span>
          <span className="green">模</span>
          <span className="blue">式</span>
        </div>

        <div className="model-card-row">
          <article className="model-card model-card-test">
            <div className="model-card-inner">
              <div className="model-badge blue">正式紀錄</div>
              <div className="model-icon-bubble" aria-hidden="true">
                <img src={trainingIcon} alt="" />
              </div>

              <h1>測驗</h1>
              <h2>   </h2>

              <ul>
                <li>固定流程</li>
                <li>不給提示</li>
                <li>紀錄能力表現</li>
              </ul>

              <button
                type="button"
                className="image-action-button"
                onClick={startTest}
                aria-label="進入測驗地圖"
              >
                <img src={testMapButton} alt="進入測驗地圖" />
              </button>
            </div>
          </article>

          <article className="model-card model-card-training">
            <div className="model-card-inner">
              <div className="model-badge green">練習挑戰</div>
              <div className="model-icon-bubble" aria-hidden="true">
                <img src={testIcon} alt="" />
              </div>

              <h1>訓練</h1>
              <h2>   </h2>

              <ul>
                <li>可重複練習</li>
                <li>可安排能力</li>
                <li>可累積星星</li>
              </ul>

              <button
                type="button"
                className="image-action-button"
                onClick={startTraining}
                aria-label="進入訓練地圖"
              >
                <img src={trainingMapButton} alt="進入訓練地圖" />
              </button>
            </div>
          </article>
        </div>
      </section>

      {isTrainingSettingOpen && (
        <section className="training-setting-overlay" aria-label="設定訓練內容">
          <div className="training-setting-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="training-setting-close"
              onClick={closeTrainingSetting}
              aria-label="關閉訓練設定"
            >
              ×
            </button>

            <div className="training-setting-heading">
              <span className="training-setting-badge">訓練設定</span>
              <h2>今天要練習多久？</h2>
              <p>一次訓練最多 12 關。若完全沒有選擇項目，系統會依照每一關的作答結果，自動優先安排需要加強的訓練。</p>
            </div>

            <div className="training-time-card">
              <div className="training-time-row">
                <span>10分鐘</span>
                <strong>{trainingMinutes} 分鐘</strong>
                <span>60分鐘</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={trainingMinutes}
                onChange={(event) => setTrainingMinutes(Number(event.target.value))}
                className="training-time-slider"
                aria-label="選擇訓練時間，最少10分鐘，最多60分鐘"
              />
            </div>

            <div className="training-item-header">
              <div>
                <h3>選擇訓練項目</h3>
                <p>每個項目下方會說明主要訓練能力。</p>
              </div>
              <div className="training-item-actions">
                <button type="button" className="recommend-training-button" onClick={applyRecommendedTraining}>
                  推薦訓練
                </button>
                <button type="button" className="select-all-button" onClick={selectAllTrainingGames}>
                  全選
                </button>
                <button type="button" className="clear-selection-button" onClick={clearTrainingGames}>
                  清除
                </button>
              </div>
            </div>

            {selectedTrainingGameIds.length === 0 && (
              <div className="recommendation-notice">
                目前沒有選擇項目，按下進入後會依每關結果優先安排弱項，並自動安排最多 12 關。
              </div>
            )}

            <div className="training-item-grid" role="group" aria-label="訓練項目">
              {TRAINING_GAME_OPTIONS.map((game) => {
                const isSelected = selectedTrainingGameIds.includes(game.id);

                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`training-item-button ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleTrainingGame(game.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="training-item-check" aria-hidden="true">
                      {isSelected ? "✓" : "+"}
                    </span>
                    <span className="training-item-text">
                      <strong>{game.title}</strong>
                      <small>{game.ability}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="training-level-limit">
              將安排 <strong>{MAX_TRAINING_LEVELS}</strong> 關以內的訓練流程。
            </div>

            <button
              type="button"
              className="confirm-training-button"
              onClick={confirmTrainingSettings}
              aria-label="進入訓練地圖"
            >
              <img src={trainingMapButton} alt="進入訓練地圖" />
            </button>
          </div>
        </section>
      )}

      <section className="model-bottom-bar" aria-label="孩子紀錄">
        <button type="button" className="record-button" onClick={openHistory}>
          <span aria-hidden="true">⭐</span>
          查看孩子紀錄
        </button>

        <div className="recent-practice">
          <span className="squirrel" aria-hidden="true">🐿️</span>
          <span>最近訓練：</span>
          <strong>
            {latestTraining ? GAME_LABELS[latestTraining.key] || "森林任務" : "尚未開始"}
          </strong>
        </div>
      </section>

      <style>{`
        .model-select-page {
          position: relative;
          width: 100%;
          min-height: 100dvh;
          overflow: hidden;
          background: #e8f7ff url(${modelBackground}) center / cover no-repeat;
          font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
          color: #5b3518;
        }

        .model-select-page * {
          box-sizing: border-box;
        }

        .model-select-back {
          position: fixed;
          top: clamp(14px, 2vw, 24px);
          left: clamp(14px, 2vw, 24px);
          z-index: 20;
          min-width: 118px;
          min-height: 48px;
          padding: 0 22px;
          border: 4px solid rgba(255, 236, 170, 0.96);
          border-radius: 999px;
          background: linear-gradient(180deg, #9bea56 0%, #61c51f 64%, #3f9b17 100%);
          color: #ffffff;
          font-family: inherit;
          font-size: clamp(0.92rem, 1.2vw, 1.05rem);
          font-weight: 950;
          text-shadow: 0 2px 0 rgba(38, 102, 15, 0.34);
          cursor: pointer;
          box-shadow: 0 8px 0 #2f8617, 0 12px 18px rgba(48, 97, 29, 0.2);
        }

        .model-select-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: min(1180px, calc(100% - 48px));
          min-height: 100dvh;
          margin: 0 auto;
          padding: clamp(32px, 4.2vh, 52px) 0 clamp(116px, 13vh, 150px);
        }

        .model-title-board {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: clamp(12px, 1.9vw, 26px);
          margin-bottom: clamp(26px, 3.8vh, 48px);
          padding: clamp(18px, 2.1vw, 28px) clamp(54px, 7vw, 96px);
          border: 7px solid rgba(224, 146, 63, 0.96);
          border-radius: clamp(22px, 2.6vw, 34px);
          background: linear-gradient(180deg, #9d6831 0%, #83501f 100%);
          box-shadow:
            inset 0 4px 0 rgba(255, 206, 114, 0.28),
            0 10px 0 rgba(95, 55, 22, 0.22),
            0 20px 34px rgba(91, 53, 24, 0.18);
          color: #ffd476;
          font-size: clamp(3.4rem, 6.4vw, 6.3rem);
          font-weight: 1000;
          line-height: 0.92;
          letter-spacing: 0.08em;
          text-shadow: 0 5px 0 rgba(85, 45, 16, 0.34);
        }

        .model-title-board .green {
          color: #bde56c;
        }

        .model-title-board .blue {
          color: #a7d9f4;
        }

        .model-card-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(34px, 4.6vw, 58px);
          width: 100%;
          align-items: stretch;
        }

        .model-card {
          position: relative;
          min-height: clamp(510px, 58vh, 642px);
          border-radius: clamp(26px, 3.2vw, 42px);
          background: url(${cardBg}) center / 100% 100% no-repeat;
          filter: drop-shadow(0 18px 18px rgba(80, 53, 18, 0.18));
        }

        .model-card::before {
          content: "";
          position: absolute;
          inset: clamp(25px, 3vw, 36px);
          z-index: 0;
          border-radius: 30px;
          pointer-events: none;
        }

        .model-card-test::before {
          background: rgba(225, 248, 255, 0.66);
        }

        .model-card-training::before {
          background: rgba(255, 245, 174, 0.54);
        }

        .model-card-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: clamp(42px, 5vw, 64px) clamp(46px, 5.4vw, 68px) clamp(34px, 4vw, 52px);
        }

        .model-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          font-size: clamp(1rem, 1.45vw, 1.28rem);
          font-weight: 950;
          box-shadow: 0 7px 12px rgba(94, 90, 65, 0.12);
        }

        .model-badge.blue {
          color: #0878d8;
        }

        .model-badge.green {
          color: #218c2d;
        }

        .model-icon-bubble {
          position: absolute;
          top: clamp(38px, 4.4vw, 58px);
          right: clamp(46px, 5vw, 68px);
          display: grid;
          place-items: center;
          width: clamp(78px, 8vw, 106px);
          aspect-ratio: 1;
          border: 7px solid #ffda76;
          border-radius: 999px;
          background: rgba(255, 251, 229, 0.92);
          box-shadow: 0 10px 18px rgba(143, 98, 38, 0.13);
        }

        .model-icon-bubble img {
          width: 70%;
          height: 70%;
          object-fit: contain;
          display: block;
        }

        .model-card h1 {
          margin: clamp(50px, 7vh, 76px) 0 0;
          font-size: clamp(4.4rem, 8vw, 7.2rem);
          font-weight: 1000;
          line-height: 0.92;
          letter-spacing: -0.08em;
          text-shadow: 0 6px 0 rgba(255, 255, 255, 0.72), 0 10px 0 rgba(0, 0, 0, 0.08);
        }

        .model-card-test h1,
        .model-card-test h2 {
          color: #006ed6;
        }

        .model-card-training h1,
        .model-card-training h2 {
          color: #228c22;
        }

        .model-card h2 {
          margin: 4px 0 clamp(22px, 2.8vh, 34px);
          font-size: clamp(1.45rem, 2.4vw, 2rem);
          font-weight: 1000;
          line-height: 1.12;
        }

        .model-card ul {
          display: grid;
          gap: clamp(12px, 1.7vh, 18px);
          margin: 0 0 clamp(28px, 4vh, 44px);
          padding: 0;
          list-style: none;
        }

        .model-card li {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: clamp(50px, 5.7vh, 62px);
          padding: 0 clamp(20px, 2.5vw, 28px);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
          color: #6a3c1d;
          font-size: clamp(1.12rem, 1.65vw, 1.42rem);
          font-weight: 950;
          box-shadow: 0 8px 13px rgba(85, 79, 55, 0.12);
        }

        .model-card li::before {
          content: "✓";
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 34px;
          aspect-ratio: 1;
          border-radius: 999px;
          background: linear-gradient(180deg, #88c869 0%, #5aa942 100%);
          color: #fff;
          font-size: 1.15rem;
          font-weight: 1000;
          box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.34);
        }

        .image-action-button {
          display: grid;
          place-items: center;
          width: min(100%, 346px);
          margin: auto auto 0;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          transform-origin: center;
          transition: transform 0.16s ease, filter 0.16s ease;
        }

        .image-action-button:hover {
          transform: translateY(-3px) scale(1.02);
          filter: brightness(1.05);
        }

        .image-action-button img {
          display: block;
          width: 100%;
          height: auto;
        }

        .model-bottom-bar {
          position: fixed;
          left: clamp(28px, 4vw, 62px);
          right: clamp(28px, 4vw, 62px);
          bottom: clamp(20px, 3vh, 36px);
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: clamp(22px, 4vw, 54px);
          pointer-events: none;
        }

        .recent-practice,
        .record-button {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 66px;
          border: 5px solid #ffe7b0;
          border-radius: 999px;
          background: rgba(255, 244, 211, 0.96);
          color: #8b4f20;
          font-family: inherit;
          font-size: clamp(1rem, 1.55vw, 1.3rem);
          font-weight: 950;
          box-shadow: 0 8px 0 rgba(198, 141, 56, 0.32), 0 14px 18px rgba(81, 56, 22, 0.12);
          white-space: nowrap;
        }

        .record-button {
          order: 1;
          gap: 10px;
          min-width: clamp(230px, 25vw, 320px);
          padding: 0 28px;
          border-color: #fff0bb;
          color: #287b2d;
          cursor: pointer;
        }

        .record-button span {
          color: #eebd2d;
          text-shadow: 0 2px 0 #fff4c6;
        }

        .recent-practice {
          order: 2;
          min-width: clamp(280px, 33vw, 430px);
          padding: 0 28px 0 14px;
        }

        .recent-practice strong {
          margin-left: 8px;
          color: #0870d0;
        }

        .squirrel {
          display: grid;
          place-items: center;
          width: 54px;
          aspect-ratio: 1;
          margin-right: 12px;
          border-radius: 999px;
          background: #fff7e8;
          font-size: 2rem;
        }


        .training-setting-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: clamp(18px, 4vw, 42px);
          background: rgba(57, 42, 21, 0.42);
          backdrop-filter: blur(5px);
        }

        .training-setting-modal {
          position: relative;
          width: min(920px, 100%);
          max-height: min(90dvh, 800px);
          overflow-y: auto;
          padding: clamp(26px, 4vw, 42px);
          border: 7px solid rgba(255, 228, 142, 0.98);
          border-radius: clamp(26px, 4vw, 42px);
          background: linear-gradient(180deg, rgba(255, 252, 234, 0.99) 0%, rgba(255, 241, 192, 0.99) 100%);
          box-shadow: 0 24px 40px rgba(64, 43, 18, 0.26), inset 0 5px 0 rgba(255, 255, 255, 0.72);
        }

        .training-setting-close {
          position: absolute;
          top: 18px;
          right: 18px;
          display: grid;
          place-items: center;
          width: 44px;
          aspect-ratio: 1;
          border: 0;
          border-radius: 999px;
          background: #fff5d1;
          color: #8b4f20;
          font-family: inherit;
          font-size: 2rem;
          font-weight: 1000;
          line-height: 1;
          cursor: pointer;
          box-shadow: inset 0 -3px 0 rgba(198, 141, 56, 0.22);
        }

        .training-setting-heading {
          padding-right: 52px;
        }

        .training-setting-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          background: #d9f4ff;
          color: #0870d0;
          font-weight: 1000;
          box-shadow: inset 0 -3px 0 rgba(8, 112, 208, 0.16);
        }

        .training-setting-heading h2 {
          margin: 14px 0 8px;
          color: #4e2f17;
          font-size: clamp(2rem, 4.4vw, 3.2rem);
          font-weight: 1000;
          line-height: 1.04;
          text-shadow: 0 4px 0 rgba(255, 255, 255, 0.76);
        }

        .training-setting-heading p {
          margin: 0;
          color: #7a4a24;
          font-size: clamp(1rem, 1.8vw, 1.18rem);
          font-weight: 850;
          line-height: 1.55;
        }

        .training-time-card {
          margin-top: clamp(18px, 3vh, 28px);
          padding: clamp(18px, 3vw, 26px);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 9px 16px rgba(95, 73, 32, 0.12);
        }

        .training-time-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          color: #8b4f20;
          font-weight: 950;
        }

        .training-time-row span:last-child {
          text-align: right;
        }

        .training-time-row strong {
          min-width: 128px;
          padding: 8px 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #87e448 0%, #46b40b 100%);
          color: #ffffff;
          font-size: clamp(1.1rem, 2vw, 1.38rem);
          text-align: center;
          text-shadow: 0 2px 0 rgba(38, 102, 15, 0.25);
          box-shadow: 0 6px 0 rgba(47, 134, 23, 0.32);
        }

        .training-time-slider {
          width: 100%;
          margin-top: 22px;
          accent-color: #55bf28;
          cursor: pointer;
        }

        .training-item-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          margin-top: clamp(20px, 3vh, 30px);
        }

        .training-item-header h3 {
          margin: 0;
          color: #5b3518;
          font-size: clamp(1.28rem, 2vw, 1.58rem);
          font-weight: 1000;
        }

        .training-item-header p {
          margin: 4px 0 0;
          color: #8b5a2d;
          font-size: 0.96rem;
          font-weight: 850;
        }

        .training-item-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .select-all-button,
        .clear-selection-button,
        .recommend-training-button,
        .training-item-button,
        .confirm-training-button {
          border: 0;
          font-family: inherit;
          font-weight: 1000;
          cursor: pointer;
          transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
        }

        .select-all-button,
        .clear-selection-button,
        .recommend-training-button {
          flex: 0 0 auto;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          font-size: 0.98rem;
        }

        .recommend-training-button {
          border: 4px solid #ffe0a6;
          background: linear-gradient(180deg, #ffcf69 0%, #f59b28 100%);
          color: #ffffff;
          text-shadow: 0 2px 0 rgba(143, 74, 11, 0.28);
          box-shadow: 0 5px 0 rgba(173, 99, 21, 0.25);
        }

        .select-all-button {
          border: 4px solid #bceaff;
          background: linear-gradient(180deg, #e8f9ff 0%, #bfefff 100%);
          color: #0870d0;
          box-shadow: 0 5px 0 rgba(8, 112, 208, 0.18);
        }

        .clear-selection-button {
          border: 4px solid #ffd3c4;
          background: linear-gradient(180deg, #fff1ea 0%, #ffc4a7 100%);
          color: #b84b20;
          box-shadow: 0 5px 0 rgba(184, 75, 32, 0.16);
        }

        .recommendation-notice,
        .training-level-limit {
          margin-top: 14px;
          padding: 12px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
          color: #8b4f20;
          font-weight: 900;
          line-height: 1.45;
        }

        .recommendation-notice {
          border: 3px dashed rgba(245, 155, 40, 0.55);
        }

        .training-level-limit {
          text-align: center;
        }

        .training-level-limit strong {
          color: #2f8617;
          font-size: 1.16em;
        }

        .training-item-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .training-item-button {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-height: 112px;
          padding: 14px 16px;
          border: 4px solid #f1c87a;
          border-radius: 22px;
          background: linear-gradient(180deg, #fff8e6 0%, #ffe6b7 100%);
          color: #78461f;
          line-height: 1.25;
          text-align: left;
          box-shadow: 0 7px 0 rgba(190, 130, 45, 0.28), 0 10px 14px rgba(104, 75, 31, 0.1);
        }

        .training-item-button.is-selected {
          border-color: #4ebc2c;
          background: linear-gradient(180deg, #dfffd0 0%, #9eef63 100%);
          color: #126b1c;
          box-shadow: 0 7px 0 #2f8617, 0 12px 16px rgba(48, 97, 29, 0.16), inset 0 0 0 2px rgba(255, 255, 255, 0.62);
        }

        .training-item-check {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 34px;
          aspect-ratio: 1;
          border-radius: 999px;
          background: #ffffff;
          color: #c57620;
          font-size: 1.18rem;
          box-shadow: 0 4px 7px rgba(89, 76, 38, 0.15);
        }

        .training-item-button.is-selected .training-item-check {
          color: #118018;
        }

        .training-item-text {
          display: grid;
          gap: 6px;
        }

        .training-item-text strong {
          font-size: clamp(0.98rem, 1.35vw, 1.12rem);
          font-weight: 1000;
        }

        .training-item-text small {
          color: rgba(87, 55, 26, 0.82);
          font-size: clamp(0.82rem, 1.05vw, 0.94rem);
          font-weight: 850;
          line-height: 1.45;
        }

        .training-item-button.is-selected .training-item-text small {
          color: rgba(18, 91, 24, 0.86);
        }

        .confirm-training-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: min(100%, 460px);
          margin: clamp(24px, 3vh, 32px) auto 0;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: transparent;
          filter: drop-shadow(0 10px 12px rgba(48, 97, 29, 0.22));
        }

        .confirm-training-button img {
          display: block;
          width: 100%;
          height: auto;
          pointer-events: none;
          user-select: none;
        }

        .select-all-button:hover,
        .clear-selection-button:hover,
        .recommend-training-button:hover,
        .training-item-button:hover,
        .confirm-training-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        @media (max-width: 1050px) {
          .model-select-page {
            overflow-y: auto;
          }

          .model-select-content {
            min-height: auto;
            padding-bottom: 150px;
          }

          .model-card-row {
            gap: 24px;
          }

          .model-card-inner {
            padding-left: 42px;
            padding-right: 42px;
          }
        }

        @media (max-width: 820px) {
          .model-select-content {
            width: min(620px, calc(100% - 28px));
            padding-top: 84px;
          }

          .model-title-board {
            padding-left: 34px;
            padding-right: 34px;
            font-size: clamp(3rem, 12vw, 5rem);
          }

          .model-card-row {
            grid-template-columns: 1fr;
          }

          .model-card {
            min-height: 500px;
          }

          .training-item-grid {
            grid-template-columns: 1fr;
          }

          .model-bottom-bar {
            position: static;
            display: grid;
            grid-template-columns: 1fr;
            padding: 0 16px 22px;
            margin-top: -120px;
          }

          .record-button,
          .recent-practice {
            width: min(100%, 430px);
            justify-self: center;
          }
        }

        @media (max-width: 520px) {
          .model-select-back {
            min-width: 96px;
            min-height: 42px;
            padding: 0 16px;
          }

          .model-select-content {
            width: min(100%, calc(100% - 16px));
            padding-top: 76px;
          }

          .model-title-board {
            width: 100%;
            gap: 8px;
            padding: 18px 18px;
            border-width: 5px;
          }

          .model-card-inner {
            padding: 40px 34px 34px;
          }

          .model-icon-bubble {
            right: 34px;
          }

          .model-card h1 {
            font-size: clamp(4rem, 20vw, 5.8rem);
          }

          .training-setting-modal {
            padding: 24px 18px;
          }

          .training-setting-heading {
            padding-right: 46px;
          }

          .training-time-row {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .training-time-row span:last-child {
            text-align: center;
          }

          .training-item-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .training-item-actions {
            justify-content: flex-start;
          }

          .confirm-training-button {
            width: min(100%, 360px);
          }

          .recent-practice,
          .record-button {
            min-width: 0;
            white-space: normal;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
};

export default ModeSelectPage;
