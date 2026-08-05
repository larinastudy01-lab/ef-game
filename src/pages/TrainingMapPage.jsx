import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TrainingMapPage.css";

/**
 * TrainingMapPage.jsx
 *
 * 功能：
 * 1. 家長選擇能力森林：工作記憶 / 抑制控制 / 認知彈性
 * 2. 顯示該能力下的訓練關卡
 * 3. 根據 localStorage 中的訓練結果給 AI 推薦
 * 4. 點擊關卡 icon 後可選擇簡單 / 普通 / 困難
 * 5. 解鎖條件：
 *    - 簡單 3 星
 *    - 普通 2 星
 *    - 困難 1 星
 *
 * 建議路由：
 * <Route path="/training-map" element={<TrainingMapPage />} />
 */

const ABILITY_AREAS = {
  memory: {
    title: "記憶森林",
    subtitle: "練習記住順序與圖片",
    story: "波波和皮皮要幫鹿先生過橋，也要幫兔子妹妹找回物品。",
    games: ["CBT", "PM"],
  },
  inhibition: {
    title: "反應森林",
    subtitle: "練習專心看目標，不亂點",
    story: "波波和皮皮要幫小松鼠接橡實，也要幫狐狸夫婦趕走蒼蠅。",
    games: ["SRT", "SSG"],
  },
  flexibility: {
    title: "變化森林",
    subtitle: "練習照順序與切換規則",
    story: "波波和皮皮要幫綿羊奶奶找到路，也要幫孔雀小姐整理衣服。",
    games: ["LB", "DCCS"],
  },
};

const GAME_CONFIG = {
  CBT: {
    name: "石頭小橋",
    character: "鹿先生",
    ability: "memory",
    description: "記住石頭順序，幫鹿先生過橋。",
    route: "/training-cbt",
    storageKey: "cbtTrainingResult",
  },
  PM: {
    name: "湖邊找物",
    character: "兔子妹妹",
    ability: "memory",
    description: "記住圖片，幫兔子妹妹找回物品。",
    route: "/training-picture-memory",
  },
  SRT: {
    name: "橡實接接",
    character: "小松鼠",
    ability: "inhibition",
    description: "看到橡實出現，幫小松鼠接住。",
    route: "/training-srt",
    storageKey: "srtTrainingResult",
  },
  SSG: {
    name: "SSG 聲音符號遊戲",
    character: "貓咪與狗狗",
    ability: "inhibition",
    description: "找到搗亂蒼蠅，幫派對順利開始。",
    route: "/training-ssg",
    storageKey: "ssgTrainingResult",
  },
  LB: {
    name: "回家小路",
    character: "綿羊奶奶",
    ability: "flexibility",
    description: "照順序點路標，幫綿羊奶奶回家。",
    route: "/training-linking-balloons",
    storageKey: "lbTrainingResult",
  },
  DCCS: {
    name: "服飾分類",
    character: "孔雀小姐",
    ability: "flexibility",
    description: "依照顏色或圖案，幫孔雀小姐整理衣服。",
    route: "/training-dccs",
    storageKey: "dccsTrainingResult",
  },
};

const DIFFICULTIES = [
  {
    id: "easy",
    label: "簡單",
    unlockText: "一開始就可以玩",
    requiredStars: 0,
  },
  {
    id: "normal",
    label: "普通",
    unlockText: "簡單達 3 星開啟",
    requiredStars: 3,
  },
  {
    id: "hard",
    label: "困難",
    unlockText: "普通達 2 星開啟",
    requiredStars: 2,
  },
];

const STORAGE_KEYS = Object.values(GAME_CONFIG).map((game) => game.storageKey);

const safeParse = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getStoredResult = (storageKey) => {
  return (
    safeParse(localStorage.getItem(storageKey)) ||
    safeParse(sessionStorage.getItem(storageKey))
  );
};

const getCurrentChild = () => {
  return (
    safeParse(localStorage.getItem("currentChild")) ||
    safeParse(sessionStorage.getItem("currentChild")) ||
    safeParse(localStorage.getItem("selectedChild")) ||
    safeParse(sessionStorage.getItem("selectedChild"))
  );
};

const getGameStats = (gameId) => {
  const game = GAME_CONFIG[gameId];
  const result = getStoredResult(game.storageKey);

  if (!result) {
    return {
      stars: 0,
      accuracy: 0,
      warningLevel: "none",
      recommendedDifficulty: "easy",
      errorTypes: {},
      fatigueLevel: "low",
      hasRecord: false,
    };
  }

  return {
    stars: Number(result.stars || 0),
    accuracy: Number(result.accuracy || 0),
    warningLevel: result.warningLevel || "green",
    recommendedDifficulty: result.recommendedDifficulty || "normal",
    errorTypes: result.errorTypes || {},
    fatigueLevel: result.fatigueLevel || "low",
    hasRecord: true,
  };
};

const getAbilityRecommendation = (abilityId) => {
  const games = ABILITY_AREAS[abilityId].games;
  const stats = games.map((gameId) => ({
    gameId,
    ...getGameStats(gameId),
  }));

  const noRecordGame = stats.find((item) => !item.hasRecord);
  if (noRecordGame) {
    return {
      gameId: noRecordGame.gameId,
      difficulty: "easy",
      reason: "這個關卡還沒有練習紀錄，皮皮建議先從簡單開始熟悉規則。",
    };
  }

  const redGame = stats.find((item) => item.warningLevel === "red");
  if (redGame) {
    return {
      gameId: redGame.gameId,
      difficulty: "easy",
      reason: "這個關卡最近比較吃力，皮皮建議先降低難度並多一點提示。",
    };
  }

  const orangeGame = stats.find((item) => item.warningLevel === "orange");
  if (orangeGame) {
    return {
      gameId: orangeGame.gameId,
      difficulty: "normal",
      reason: "這個關卡有一些需要觀察的地方，皮皮建議維持普通難度穩定練習。",
    };
  }

  const lowestAccuracy = [...stats].sort((a, b) => a.accuracy - b.accuracy)[0];

  return {
    gameId: lowestAccuracy.gameId,
    difficulty: lowestAccuracy.recommendedDifficulty || "normal",
    reason: "皮皮會優先推薦目前比較需要加強的關卡，幫助孩子穩定進步。",
  };
};

const getUnlockedDifficulties = (gameId) => {
  const stats = getGameStats(gameId);
  const stars = stats.stars;

  return {
    easy: true,
    normal: stars >= 3,
    hard: stars >= 2,
  };
};

const warningClassMap = {
  none: "none",
  green: "green",
  orange: "orange",
  red: "red",
};

const warningTextMap = {
  none: "尚無紀錄",
  green: "穩定",
  orange: "觀察",
  red: "警示",
};

const TrainingMapPage = () => {
  const navigate = useNavigate();
  const currentChild = useMemo(() => getCurrentChild(), []);
  const [selectedAbility, setSelectedAbility] = useState("memory");
  const [selectedGameId, setSelectedGameId] = useState(null);

  const selectedArea = ABILITY_AREAS[selectedAbility];
  const recommendation = useMemo(
    () => getAbilityRecommendation(selectedAbility),
    [selectedAbility]
  );

  const recommendedGame = GAME_CONFIG[recommendation.gameId];

  const openDifficultyDialog = (gameId) => {
    setSelectedGameId(gameId);
  };

  const closeDifficultyDialog = () => {
    setSelectedGameId(null);
  };

  const startTraining = (difficulty) => {
    const game = GAME_CONFIG[selectedGameId];

    navigate(game.route, {
      state: {
        child: currentChild,
        currentChild,
        childId: currentChild?.childId || currentChild?.id || null,
        gameId: selectedGameId,
        difficulty,
        fromTrainingMap: true,
        forestPath: "/training-map",
      },
    });
  };

  const startRecommendedTraining = () => {
    const game = GAME_CONFIG[recommendation.gameId];

    navigate(game.route, {
      state: {
        child: currentChild,
        currentChild,
        childId: currentChild?.childId || currentChild?.id || null,
        gameId: recommendation.gameId,
        difficulty: recommendation.difficulty,
        fromTrainingMap: true,
        isRecommended: true,
        forestPath: "/training-map",
      },
    });
  };

  return (
    <main className="training-map-page">
      <section className="training-map-header">
        <div>
          <p className="training-map-label">森林訓練地圖</p>
          <h1>今天要去哪一片森林呢？</h1>
          <p>波波和皮皮會依照孩子的練習紀錄，推薦適合的森林任務。</p>
        </div>

        <button
          type="button"
          className="training-map-home-button"
          onClick={() => navigate("/game-menu")}
        >
          回主選單
        </button>
      </section>

      <section className="ability-tabs">
        {Object.entries(ABILITY_AREAS).map(([abilityId, area]) => (
          <button
            key={abilityId}
            type="button"
            className={selectedAbility === abilityId ? "active" : ""}
            onClick={() => setSelectedAbility(abilityId)}
          >
            <strong>{area.title}</strong>
            <span>{area.subtitle}</span>
          </button>
        ))}
      </section>

      <section className="training-map-content">
        <aside className="pipi-recommend-card">
          <div className="pipi-avatar-map">皮皮</div>

          <p className="pipi-small-title">皮皮小幫手推薦</p>

          <h2>{recommendedGame.name}</h2>

          <p className="pipi-reason">{recommendation.reason}</p>

          <div className="pipi-recommend-info">
            <span>建議難度</span>
            <strong>{translateDifficulty(recommendation.difficulty)}</strong>
          </div>

          <button
            type="button"
            className="start-recommend-button"
            onClick={startRecommendedTraining}
          >
            開始推薦訓練
          </button>
        </aside>

        <section className="forest-area-card">
          <div className="forest-area-title">
            <div>
              <h2>{selectedArea.title}</h2>
              <p>{selectedArea.story}</p>
            </div>
          </div>

          <div className="forest-path">
            {selectedArea.games.map((gameId, index) => {
              const game = GAME_CONFIG[gameId];
              const stats = getGameStats(gameId);
              const isRecommended = recommendation.gameId === gameId;

              return (
                <button
                  type="button"
                  key={gameId}
                  className={`forest-level-icon ${
                    isRecommended ? "recommended" : ""
                  } ${index % 2 === 0 ? "left" : "right"}`}
                  onClick={() => openDifficultyDialog(gameId)}
                >
                  <span className="forest-level-emoji">{game.icon}</span>
                  <strong>{game.name}</strong>
                  <small>{game.character}</small>

                  <div className="forest-level-stars">
                    {[1, 2, 3].map((star) => (
                      <span key={star} className={star <= stats.stars ? "active" : ""}>
                        ★
                      </span>
                    ))}
                  </div>

                  <em className={`warning-badge ${warningClassMap[stats.warningLevel]}`}>
                    {warningTextMap[stats.warningLevel]}
                  </em>

                  {isRecommended && <b className="recommend-ribbon">推薦</b>}
                </button>
              );
            })}
          </div>
        </section>
      </section>

      {selectedGameId && (
        <DifficultyDialog
          gameId={selectedGameId}
          onClose={closeDifficultyDialog}
          onStart={startTraining}
        />
      )}
    </main>
  );
};

const DifficultyDialog = ({ gameId, onClose, onStart }) => {
  const game = GAME_CONFIG[gameId];
  const unlocked = getUnlockedDifficulties(gameId);
  const stats = getGameStats(gameId);

  return (
    <section className="difficulty-overlay" role="dialog" aria-modal="true">
      <div className="difficulty-dialog">
        <button
          type="button"
          className="difficulty-close"
          onClick={onClose}
          aria-label="關閉"
        >
          ×
        </button>

        <div className="difficulty-game-icon">{game.icon}</div>

        <h2>{game.name}</h2>
        <p>{game.description}</p>

        <div className="difficulty-record">
          <span>目前星星</span>
          <strong>
            {[1, 2, 3].map((star) => (
              <b key={star} className={star <= stats.stars ? "active" : ""}>
                ★
              </b>
            ))}
          </strong>
        </div>

        <div className="difficulty-options">
          {DIFFICULTIES.map((difficulty) => {
            const isUnlocked = unlocked[difficulty.id];

            return (
              <button
                type="button"
                key={difficulty.id}
                disabled={!isUnlocked}
                className={!isUnlocked ? "locked" : ""}
                onClick={() => onStart(difficulty.id)}
              >
                <strong>{difficulty.label}</strong>
                <span>{difficulty.unlockText}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const translateDifficulty = (difficulty) => {
  const map = {
    easy: "簡單",
    normal: "普通",
    hard: "困難",
  };

  return map[difficulty] || difficulty;
};

export default TrainingMapPage;
