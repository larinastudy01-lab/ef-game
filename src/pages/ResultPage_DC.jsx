import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/ResultPage_DC.css";

/**
 * ResultPage_DC.jsx
 * 醫療端共用結果頁
 *
 * 功能：
 * 1. 醫療端查看更詳細的遊戲結果與錯誤資料
 * 2. 顯示正確率、平均反應時間、錯誤類型、疲勞程度、AI 建議
 * 3. 支援讀取 Test / Training 存入 localStorage 或 sessionStorage 的結果
 * 4. 簡易權限檢查：只有 role === "doctor" / "dc" / "clinician" 才顯示
 *
 * 建議路由：
 * /result-dc
 */

const RESULT_STORAGE_KEYS = {
  SRT: ["srtTrainingResult", "srtTestResult"],
  PM: ["pmTrainingResult", "pmTestResult"],
  CBT: ["cbtTrainingResult", "cbtTestResult"],
  SSG: ["ssgTrainingResult", "ssgTestResult"],
  DCCS: ["dccsTrainingResult", "dccsTestResult", "DCCS_TRAINING_RESULT", "DCCS_RESULT"],
  LB: ["lbTrainingResult", "lbTestResult", "LB_TRAINING_RESULT", "LB_RESULT"],
};

const GAME_LABELS = {
  SRT: { name: "SRT 橡實反應任務", ability: "抑制控制" },
  PM: { name: "PM 圖片記憶任務", ability: "工作記憶" },
  CBT: { name: "CBT 石頭路徑記憶", ability: "工作記憶" },
  SSG: { name: "SSG 蒼蠅干擾任務", ability: "抑制控制" },
  DCCS: { name: "DCCS 規則分類任務", ability: "認知彈性" },
  LB: { name: "幫助迷路的綿羊奶奶", ability: "認知彈性" },
  DEFAULT: { name: "森林認知任務", ability: "綜合能力" },
};

const DEFAULT_ERROR_TYPES = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
};

const ERROR_LABELS = {
  miss: "Miss",
  randomClick: "亂點",
  wrongTarget: "點錯目標",
  repeatedClick: "重複點擊",
  timeout: "未及時反應",
  sequenceError: "順序錯誤",
  ruleSwitchError: "規則切換錯誤",
};

const DIFFICULTY_LABELS = {
  easy: "簡單",
  normal: "普通",
  hard: "困難",
};

const MODE_LABELS = {
  test: "測驗",
  training: "訓練",
};

const FATIGUE_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
};

const WARNING_LABELS = {
  green: "綠色｜表現穩定",
  orange: "橘色｜需要追蹤",
  red: "紅色｜需要介入觀察",
};

const DOCTOR_ROLES = ["doctor", "dc", "clinician", "medical"];

const getCurrentRole = () => {
  const directRole =
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("role");

  if (directRole) return String(directRole).toLowerCase();

  try {
    const user =
      JSON.parse(localStorage.getItem("currentUser") || "null") ||
      JSON.parse(sessionStorage.getItem("currentUser") || "null");

    return String(user?.role || "").toLowerCase();
  } catch {
    return "";
  }
};

const getStoredResult = (gameId) => {
  const keys = RESULT_STORAGE_KEYS[gameId] || [];

  for (const key of keys) {
    const localValue = localStorage.getItem(key);
    const sessionValue = sessionStorage.getItem(key);
    const rawValue = localValue || sessionValue;

    if (rawValue) {
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        console.warn(`ResultPage_DC: 無法解析 ${key}`, error);
      }
    }
  }

  return null;
};

const getLatestResultFromStorage = () => {
  const results = Object.keys(RESULT_STORAGE_KEYS)
    .map((gameId) => {
      const result = getStoredResult(gameId);
      if (!result) return null;

      return {
        gameId,
        result,
        time: new Date(result.createdAt || result.timestamp || Date.now()).getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time);

  return results[0] || null;
};

const normalizeGameId = (value) => {
  if (!value) return null;
  return String(value).toUpperCase();
};

const getWarningLevel = ({ accuracy, totalErrors, fatigueLevel }) => {
  if (accuracy < 60 || totalErrors >= 10 || fatigueLevel === "high") {
    return "red";
  }

  if (accuracy < 80 || totalErrors >= 5 || fatigueLevel === "medium") {
    return "orange";
  }

  return "green";
};

const normalizeResult = (rawResult = {}) => {
  const errorTypes = {
    ...DEFAULT_ERROR_TYPES,
    ...(rawResult.errorTypes || {}),
  };

  const accuracy = Number(rawResult.accuracy ?? rawResult.score ?? 0);
  const avgReactionTime = Number(rawResult.avgReactionTime ?? rawResult.avgRT ?? 0);
  const stars = Number(rawResult.stars ?? 1);
  const totalErrors =
    Number(rawResult.totalErrors) ||
    Object.values(errorTypes).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const fatigueLevel = rawResult.fatigueLevel || "low";

  const warningLevel =
    rawResult.warningLevel ||
    getWarningLevel({
      accuracy,
      totalErrors,
      fatigueLevel,
    });

  const trialData =
    rawResult.trialData ||
    rawResult.trials ||
    rawResult.trialRecords ||
    [];

  return {
    ...rawResult,
    accuracy,
    avgReactionTime,
    stars: Number.isNaN(stars) ? 1 : Math.max(1, Math.min(3, stars)),
    totalErrors,
    errorTypes,
    fatigueLevel,
    warningLevel,
    trialData,
    recommendedDifficulty:
      rawResult.recommendedDifficulty ||
      rawResult.aiRecommendation?.recommendedDifficulty ||
      "normal",
    createdAt: rawResult.createdAt || rawResult.timestamp || new Date().toISOString(),
  };
};

const getClinicalNotes = (result) => {
  const notes = [];

  if (result.accuracy < 60) {
    notes.push("正確率偏低，建議確認兒童是否理解規則，或降低任務難度。");
  }

  if (result.avgReactionTime > 2500) {
    notes.push("平均反應時間偏長，可觀察是否與注意力維持、視覺搜尋或操作速度有關。");
  }

  if (result.errorTypes.miss >= 3) {
    notes.push("Miss 次數偏多，可能與注意力不足、目標辨識困難或反應時間不足有關。");
  }

  if (result.errorTypes.randomClick >= 3 || result.errorTypes.repeatedClick >= 3) {
    notes.push("亂點或重複點擊偏多，可觀察衝動控制與任務等待能力。");
  }

  if (result.errorTypes.sequenceError >= 2) {
    notes.push("順序錯誤偏多，可追蹤工作記憶或序列處理表現。");
  }

  if (result.errorTypes.ruleSwitchError >= 2) {
    notes.push("規則切換錯誤偏多，可追蹤認知彈性與規則更新能力。");
  }

  if (result.fatigueLevel === "high") {
    notes.push("疲勞程度偏高，建議縮短單次訓練或提前加入休息。");
  }

  if (notes.length === 0) {
    notes.push("本次表現未出現明顯高風險指標，可持續追蹤長期趨勢。");
  }

  return notes;
};

const getRtLevel = (avgReactionTime) => {
  if (!avgReactionTime) return "尚無資料";
  if (avgReactionTime <= 1500) return "快速";
  if (avgReactionTime <= 2500) return "中等";
  return "偏慢";
};

const ResultPage_DC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const role = getCurrentRole();
  const hasDoctorAccess = DOCTOR_ROLES.includes(role);

  const state = location.state || {};
  const latestStored = useMemo(() => getLatestResultFromStorage(), []);

  const gameId =
    normalizeGameId(state.gameId) ||
    normalizeGameId(state.resultData?.gameId) ||
    latestStored?.gameId ||
    "DEFAULT";

  const result = useMemo(() => {
    const rawResult =
      state.resultData ||
      getStoredResult(gameId) ||
      latestStored?.result ||
      {};

    return normalizeResult(rawResult);
  }, [state.resultData, gameId, latestStored]);

  const gameInfo = GAME_LABELS[gameId] || GAME_LABELS.DEFAULT;
  const clinicalNotes = getClinicalNotes(result);

  if (!hasDoctorAccess) {
    return (
      <main className="result-dc-page">
        <section className="result-dc-access-card">
          <h1>醫療端資料</h1>
          <p>此頁面僅提供醫生或專業人員查看。</p>
          <p>目前帳號角色：{role || "未設定"}</p>
          <button type="button" onClick={() => navigate("/result-pa", { state: { gameId, resultData: result } })}>
            回到家長結果
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="result-dc-page">
      <section className="result-dc-shell">
        <header className="result-dc-header">
          <div>
            <p className="result-dc-label">醫療端詳細紀錄</p>
            <h1>{gameInfo.name}</h1>
            <p>
              能力面向：{gameInfo.ability}｜
              模式：{MODE_LABELS[result.mode] || result.mode || "未標記"}｜
              難度：{DIFFICULTY_LABELS[result.difficulty] || result.difficulty || "未標記"}
            </p>
          </div>

          <div className={`result-dc-warning ${result.warningLevel}`}>
            {WARNING_LABELS[result.warningLevel] || WARNING_LABELS.green}
          </div>
        </header>

        <section className="result-dc-grid">
          <MetricBox label="正確率" value={`${Math.round(result.accuracy)}%`} detail="Accuracy" />
          <MetricBox label="平均 RT" value={result.avgReactionTime ? `${result.avgReactionTime} ms` : "尚無"} detail={getRtLevel(result.avgReactionTime)} />
          <MetricBox label="總錯誤數" value={result.totalErrors} detail="Error count" />
          <MetricBox label="疲勞程度" value={FATIGUE_LABELS[result.fatigueLevel] || "低"} detail="Fatigue" />
          <MetricBox label="星級" value={`${result.stars} 星`} detail="Child-facing score" />
          <MetricBox label="AI 建議難度" value={DIFFICULTY_LABELS[result.recommendedDifficulty] || result.recommendedDifficulty} detail="Next difficulty" />
        </section>

        <section className="result-dc-panel">
          <div className="result-dc-panel-title">
            <h2>錯誤類型分析</h2>
            <p>用於區分注意、衝動控制、順序記憶與規則切換問題。</p>
          </div>

          <div className="result-dc-error-bars">
            {Object.entries(result.errorTypes).map(([key, value]) => (
              <div className="result-dc-error-row" key={key}>
                <span>{ERROR_LABELS[key] || key}</span>
                <div className="result-dc-bar">
                  <div
                    style={{
                      width: `${Math.min(100, (Number(value) || 0) * 12)}%`,
                    }}
                  />
                </div>
                <strong>{Number(value) || 0}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="result-dc-panel">
          <div className="result-dc-panel-title">
            <h2>臨床觀察提示</h2>
            <p>此區僅作為初步觀察與後續追蹤參考。</p>
          </div>

          <ul className="result-dc-notes">
            {clinicalNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="result-dc-panel">
          <div className="result-dc-panel-title">
            <h2>Trial 詳細資料</h2>
            <p>若遊戲頁有存 trialData，會在此顯示每一題的詳細紀錄。</p>
          </div>

          {result.trialData.length > 0 ? (
            <div className="result-dc-table-wrap">
              <table className="result-dc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Correct</th>
                    <th>RT</th>
                    <th>Error</th>
                    <th>Target</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trialData.slice(0, 30).map((trial, index) => (
                    <tr key={trial.id || index}>
                      <td>{index + 1}</td>
                      <td>{String(trial.correct ?? trial.isCorrect ?? "-")}</td>
                      <td>{trial.reactionTime || trial.rt || "-"}</td>
                      <td>{trial.errorType || trial.error || "-"}</td>
                      <td>{formatCell(trial.target)}</td>
                      <td>{formatCell(trial.response || trial.answer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="result-dc-empty">
              目前沒有 trialData。之後可以在各 TestPage / TrainingPage 中加入逐題紀錄。
            </p>
          )}
        </section>

        <section className="result-dc-panel">
          <div className="result-dc-panel-title">
            <h2>原始結果資料</h2>
            <p>方便除錯與確認各遊戲輸出的資料格式。</p>
          </div>

          <pre className="result-dc-json">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>

        <div className="result-dc-actions">
          <button
            type="button"
            className="result-dc-button primary"
            onClick={() => navigate("/result-pa", { state: { gameId, resultData: result } })}
          >
            回家長端
          </button>

          <button
            type="button"
            className="result-dc-button secondary"
            onClick={() => navigate("/training-map")}
          >
            回森林地圖
          </button>
        </div>
      </section>
    </main>
  );
};

const MetricBox = ({ label, value, detail }) => (
  <article className="result-dc-metric">
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
);

const formatCell = (value) => {
  if (value === null || value === undefined) return "-";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export default ResultPage_DC;
