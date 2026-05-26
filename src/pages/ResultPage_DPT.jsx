// src/pages/ResultPage_DPT.jsx

import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_DPT.css";

/* ========= 圖片素材 ========= */

import backgroundImg from "../asset/DPT_testbackground.png";

/* ========= 路由 ========= */

const MENU_ROUTE = "/game-menu";
const TEST_ROUTE = "/test-dpt";
const TRAINING_ROUTE = "/training-dpt";

/* ========= 小工具 ========= */

function safeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value, min, max, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || Number.isNaN(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function formatMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "資料不足";
  return `${value} ms`;
}

function normalizeResult(rawResult) {
  const source = rawResult || {};
  const errors = source.errors || {};
  const fatigue = source.fatigue || {};

  return {
    ...source,
    errors,
    fatigue,
    commissionErrorCount: safeNumber(
      source.commissionErrorCount ??
        source.commissionErrors ??
        source.beeErrorCount ??
        errors.commissionErrorCount ??
        errors.commissionErrors ??
        errors.beeErrorCount,
      0
    ),
    omissionErrorCount: safeNumber(
      source.omissionErrorCount ?? source.timeoutCount ?? errors.omissionErrorCount,
      0
    ),
    fatigueLevel: source.fatigueLevel ?? fatigue.fatigueLevel ?? "unknown",
  };
}

function readSavedResult() {
  const savedTest = localStorage.getItem("dptTestResult");
  if (savedTest) return JSON.parse(savedTest);

  const savedTraining = localStorage.getItem("dptTrainingResult");
  if (savedTraining) return JSON.parse(savedTraining);

  return null;
}

function getAccuracy(result) {
  if (typeof result?.accuracy === "number" && Number.isFinite(result.accuracy)) {
    return result.accuracy;
  }

  if (typeof result?.accuracyPercent === "number" && Number.isFinite(result.accuracyPercent)) {
    return result.accuracyPercent;
  }

  const totalTrials = safeNumber(result?.totalTrials, 0);
  const correctCount = safeNumber(result?.correctCount, 0);

  if (totalTrials <= 0) return 0;

  return Math.round((correctCount / totalTrials) * 100);
}

function getReactionScore(avgReactionTime) {
  if (typeof avgReactionTime !== "number" || !Number.isFinite(avgReactionTime)) return 0;

  if (avgReactionTime <= 800) return 100;
  if (avgReactionTime <= 1100) return 85;
  if (avgReactionTime <= 1500) return 70;
  if (avgReactionTime <= 2000) return 55;

  return 40;
}

function getInterferenceScore(interferenceEffect) {
  if (typeof interferenceEffect !== "number" || !Number.isFinite(interferenceEffect)) return 60;

  const absEffect = Math.abs(interferenceEffect);

  if (absEffect <= 100) return 100;
  if (absEffect <= 200) return 85;
  if (absEffect <= 350) return 70;
  if (absEffect <= 500) return 55;

  return 40;
}

function getStabilityScore(timeoutCount, totalTrials) {
  if (!Number.isFinite(totalTrials) || totalTrials <= 0) return 0;

  const timeoutRate = timeoutCount / totalTrials;

  if (timeoutRate === 0) return 100;
  if (timeoutRate <= 0.1) return 85;
  if (timeoutRate <= 0.2) return 70;
  if (timeoutRate <= 0.35) return 55;

  return 40;
}

function getParentSummary(result) {
  const safeResult = normalizeResult(result);
  const { errors = {}, fatigue = {} } = safeResult || {};

  const accuracy = getAccuracy(safeResult);
  const avgReactionTime = safeResult.avgReactionTime;
  const interferenceEffect = safeResult.interferenceEffect;
  const timeoutCount = safeNumber(safeResult.timeoutCount, 0);
  const commissionErrorCount = safeNumber(
    safeResult.commissionErrorCount ?? errors.commissionErrorCount,
    0
  );
  const fatigueLevel = safeResult.fatigueLevel ?? fatigue.fatigueLevel ?? "unknown";

  let attentionText =
    "孩子已能完成基本作答，但仍可觀察是否容易被旁邊較吸引人的物品分散注意。";

  if (accuracy >= 85 && timeoutCount === 0 && commissionErrorCount === 0) {
    attentionText =
      "孩子能穩定找到蒼蠅位置，也能抑制誤觸蜜蜂的衝動，選擇性注意與作答穩定度表現良好。";
  } else if (accuracy >= 65 && commissionErrorCount <= 2) {
    attentionText =
      "孩子大多能找到蒼蠅位置，但在有干擾物時可能需要更多時間確認，偶爾仍會受到蜜蜂吸引。";
  } else if (commissionErrorCount >= 3) {
    attentionText =
      "孩子可能較容易被蜜蜂等干擾物吸引而誤觸，建議先用訓練模式練習『看到目標再點』與等待確認。";
  } else {
    attentionText =
      "孩子在找目標時可能較容易分心，建議先使用訓練模式降低速度與干擾程度。";
  }

  let speedText = "反應速度資料不足，建議確認是否完成足夠題數。";

  if (typeof avgReactionTime === "number" && Number.isFinite(avgReactionTime)) {
    if (avgReactionTime <= 900) {
      speedText = "反應速度快，能在蒼蠅出現後迅速做出選擇。";
    } else if (avgReactionTime <= 1500) {
      speedText = "反應速度中等，可以完成任務，但仍有提升空間。";
    } else {
      speedText = "反應速度偏慢，可能需要較多時間搜尋目標或排除干擾。";
    }
  }

  let interferenceText =
    "干擾影響資料不足，建議確認一致與不一致題型都有有效反應。";

  if (typeof interferenceEffect === "number" && Number.isFinite(interferenceEffect)) {
    if (Math.abs(interferenceEffect) <= 100 && commissionErrorCount === 0) {
      interferenceText =
        "一致與不一致題型的反應差異小，且沒有明顯誤觸蜜蜂，表示孩子較能維持穩定注意與抑制衝動。";
    } else if (interferenceEffect > 100 || commissionErrorCount >= 3) {
      interferenceText =
        "不一致題型或蜜蜂干擾下較容易出現延遲或誤觸，表示孩子可能需要更多練習來忽略吸引注意的刺激。";
    } else {
      interferenceText =
        "不一致題型沒有明顯變慢，表示孩子可能能快速忽略干擾，但仍可搭配誤觸次數一起觀察。";
    }
  }

  let impulseText = "誤觸蜜蜂資料不足，建議確認遊戲是否有紀錄 Commission Error。";

  if (commissionErrorCount === 0) {
    impulseText = "沒有誤觸蜜蜂，代表孩子能較好地停下來確認目標後再作答。";
  } else if (commissionErrorCount <= 2) {
    impulseText = `有 ${commissionErrorCount} 次誤觸蜜蜂，屬於可觀察範圍，可提醒孩子先看清楚再點。`;
  } else {
    impulseText = `有 ${commissionErrorCount} 次誤觸蜜蜂，顯示孩子在抑制衝動或排除干擾上需要更多練習。`;
  }

  if (fatigueLevel === "high") {
    impulseText += " 另外，本次疲勞指標偏高，建議下次縮短單次測驗時間或安排休息。";
  }

  return {
    attentionText,
    speedText,
    interferenceText,
    impulseText,
  };
}

function getAbilityScores(result) {
  const safeResult = normalizeResult(result);
  const { errors = {} } = safeResult || {};

  const accuracy = getAccuracy(safeResult);
  const avgReactionTime = safeResult.avgReactionTime;
  const interferenceEffect = safeResult.interferenceEffect;
  const timeoutCount = safeNumber(safeResult.timeoutCount, 0);
  const totalTrials = safeNumber(safeResult.totalTrials, 0);
  const commissionErrorCount = safeNumber(
    safeResult.commissionErrorCount ?? errors.commissionErrorCount,
    0
  );
  const commissionPenalty = totalTrials > 0 ? (commissionErrorCount / totalTrials) * 100 : 0;
  const inhibitionScore = clamp(100 - commissionPenalty * 1.5, 0, 100);

  return {
    selectiveAttention: clamp(accuracy, 0, 100),
    reactionSpeed: clamp(getReactionScore(avgReactionTime), 0, 100),
    interferenceControl: clamp(
      getInterferenceScore(interferenceEffect) * 0.7 + inhibitionScore * 0.3,
      0,
      100
    ),
    responseStability: clamp(
      getStabilityScore(timeoutCount, totalTrials) * 0.8 + inhibitionScore * 0.2,
      0,
      100
    ),
  };
}

function getResultModeText(mode) {
  if (mode === "training") return "訓練";
  return "測驗";
}

/* ========= 小元件 ========= */

function MetricCard({ label, value, note }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      {note && <div style={styles.metricNote}>{note}</div>}
    </div>
  );
}

function AbilityBar({ label, value }) {
  const safeValue = Math.round(clamp(value, 0, 100));

  return (
    <div style={styles.abilityRow}>
      <div style={styles.abilityLabel}>{label}</div>

      <div style={styles.abilityTrack}>
        <div
          style={{
            ...styles.abilityFill,
            width: `${safeValue}%`,
          }}
        />
      </div>

      <div style={styles.abilityValue}>{safeValue}</div>
    </div>
  );
}

/* ========= 主頁面 ========= */

export default function ResultPage_DPT() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const result = useMemo(() => {
    if (location.state) return normalizeResult(location.state);

    try {
      const savedResult = readSavedResult();
      return savedResult ? normalizeResult(savedResult) : null;
    } catch (error) {
      console.error("Failed to parse DPT result:", error);
      return null;
    }
  }, [location.state]);

  const handleNavigate = (route) => {
    if (isNavigating) return;

    setIsNavigating(true);
    navigate(route);
  };

  if (!result) {
    return (
      <div
        className="dpt-page"
        style={{ "--dpt-bg": `url(${backgroundImg})` }}
      >
        <div className="dpt-card dpt-card--small">
          <h1 className="dpt-title">找不到結果</h1>

          <p className="dpt-text">目前沒有 DPT 資料，請先完成一次測驗或訓練。</p>

          <div className="dpt-button-row">
            <button
              type="button"
              className="dpt-main-button"
              disabled={isNavigating}
              onClick={() => handleNavigate(TEST_ROUTE)}
            >
              重新測驗
            </button>

            <button
              type="button"
              className="dpt-secondary-button"
              disabled={isNavigating}
              onClick={() => handleNavigate(TRAINING_ROUTE)}
            >
              前往訓練
            </button>

            <button
              type="button"
              className="dpt-secondary-button"
              disabled={isNavigating}
              onClick={() => handleNavigate(MENU_ROUTE)}
            >
              返回主頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  const accuracy = getAccuracy(result);
  const parentSummary = getParentSummary(result);
  const abilityScores = getAbilityScores(result);

  const isTraining = result.mode === "training";
  const modeText = getResultModeText(result.mode);

  return (
    <div
      className="dpt-page"
      style={{ "--dpt-bg": `url(${backgroundImg})` }}
    >
      <div className="dpt-card dpt-card--wide" style={styles.resultCard}>
        <h1 className="dpt-title">趕蒼蠅任務完成！</h1>

        <div style={styles.section}>
          <h2 style={styles.panelTitle}>家長觀察摘要</h2>

          <div style={styles.metricGrid}>
            <MetricCard
              label="模式"
              value={modeText}
              note={isTraining ? result.difficultyTitle || "訓練模式" : "正式測驗"}
            />

            <MetricCard
              label="趕走蒼蠅"
              value={`${safeNumber(result.correctCount)} / ${safeNumber(
                result.totalTrials
              )}`}
              note="孩子正確找到蒼蠅停的位置"
            />

            <MetricCard
              label="正確率"
              value={`${accuracy}%`}
              note="整體選擇性注意表現"
            />

            <MetricCard
              label="平均反應"
              value={formatMs(result.avgReactionTime)}
              note="只計算答對題目的反應時間"
            />

            <MetricCard
              label="沒有作答"
              value={`${safeNumber(result.timeoutCount)} 題`}
              note="蒼蠅出現後沒有在時間內點擊"
            />

            <MetricCard
              label="誤觸蜜蜂"
              value={`${safeNumber(result.commissionErrorCount)} 次`}
              note="Commission Error，代表點到干擾物的次數"
            />

            {isTraining && (
              <MetricCard
                label="最高連續答對"
                value={`${safeNumber(result.bestStreak)} 次`}
                note="訓練中的連續成功表現"
              />
            )}
          </div>

          <div style={styles.parentTextBox}>
            <p>
              <strong>注意力表現：</strong>
              {parentSummary.attentionText}
            </p>

            <p>
              <strong>反應速度：</strong>
              {parentSummary.speedText}
            </p>

            <p>
              <strong>抗干擾表現：</strong>
              {parentSummary.interferenceText}
            </p>

            <p>
              <strong>衝動抑制：</strong>
              {parentSummary.impulseText}
            </p>
          </div>

          <div style={styles.abilityBox}>
            <h3 style={styles.smallTitle}>能力指標</h3>

            <AbilityBar
              label="選擇性注意"
              value={abilityScores.selectiveAttention}
            />

            <AbilityBar
              label="反應速度"
              value={abilityScores.reactionSpeed}
            />

            <AbilityBar
              label="抗干擾能力"
              value={abilityScores.interferenceControl}
            />

            <AbilityBar
              label="作答穩定度"
              value={abilityScores.responseStability}
            />
          </div>
        </div>

        <div className="dpt-button-row">
          <button
            type="button"
            className="dpt-main-button"
            disabled={isNavigating}
            onClick={() => handleNavigate(TEST_ROUTE)}
          >
            重新測驗
          </button>

          <button
            type="button"
            className="dpt-secondary-button"
            disabled={isNavigating}
            onClick={() => handleNavigate(TRAINING_ROUTE)}
          >
            前往訓練
          </button>

          <button
            type="button"
            className="dpt-secondary-button"
            disabled={isNavigating}
            onClick={() => handleNavigate(MENU_ROUTE)}
          >
            返回主頁
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========= ResultPage 專用樣式 ========= */

const styles = {
  resultCard: {
    maxHeight: "92vh",
    overflowY: "auto",
  },

  section: {
    width: "100%",
    marginTop: 18,
  },

  panelTitle: {
    margin: "8px 0 22px",
    fontSize: 30,
    fontWeight: 900,
    color: "#7a471e",
  },

  smallTitle: {
    margin: "0 0 16px",
    fontSize: 24,
    fontWeight: 900,
    color: "#7a471e",
  },

  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
    margin: "12px 0 22px",
  },

  metricCard: {
    background: "rgba(255,255,255,0.86)",
    borderRadius: 22,
    padding: "18px 16px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
    textAlign: "center",
  },

  metricLabel: {
    fontSize: 17,
    fontWeight: 900,
    color: "#8b5e3c",
    marginBottom: 8,
  },

  metricValue: {
    fontSize: 28,
    fontWeight: 900,
    color: "#5c4033",
  },

  metricNote: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
    color: "#9a6a3a",
  },

  parentTextBox: {
    background: "rgba(255, 243, 232, 0.9)",
    borderRadius: 24,
    padding: "22px 26px",
    textAlign: "left",
    fontSize: 19,
    lineHeight: 1.8,
    color: "#4a2b1c",
    fontWeight: 600,
    marginTop: 18,
  },

  abilityBox: {
    marginTop: 22,
    background: "rgba(255,255,255,0.78)",
    borderRadius: 24,
    padding: "22px 24px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
  },

  abilityRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 48px",
    alignItems: "center",
    gap: 12,
    margin: "14px 0",
  },

  abilityLabel: {
    fontSize: 17,
    fontWeight: 900,
    color: "#7a4f2b",
    textAlign: "right",
  },

  abilityTrack: {
    height: 18,
    borderRadius: 999,
    background: "rgba(122,79,43,0.16)",
    overflow: "hidden",
  },

  abilityFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #f4a261, #ffd166)",
  },

  abilityValue: {
    fontSize: 17,
    fontWeight: 900,
    color: "#5c4033",
  },
};