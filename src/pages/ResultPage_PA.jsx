import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import homeBackground from "../asset/Home_background.png";
import assistIcon from "../asset/assist.png";
import "../styles/ResultPage_PA.css";

/**
 * ResultPage_PA.jsx
 * 家長端結果頁
 *
 * 更新重點：
 * 1. 背景吃 Home_background.png，視覺貼近主頁森林風格
 * 2. 上方顯示目前小孩名稱
 * 3. AI 小助手使用 assist.png，固定左下角，點擊後開啟聊天室窗
 * 4. 平板、電腦、小螢幕自動換行，不使用固定超大寬度避免跑版
 * 5. 保留家長摘要、錯誤說明、AI 建議與套用建議
 */

const RESULT_STORAGE_KEYS = {
  SRT: ["srtTrainingResult", "srtTestResult"],
  PM: ["pmTrainingResult", "pmTestResult"],
  CBT: ["cbtTrainingResult", "cbtTestResult"],
  DPT: ["dptTrainingResult", "dptTestResult"],
  DCCS: ["dccsTrainingResult", "dccsTestResult", "DCCS_TRAINING_RESULT", "DCCS_RESULT"],
  LB: ["lbTrainingResult", "lbTestResult", "LB_TRAINING_RESULT", "LB_RESULT"],
};

const GAME_LABELS = {
  SRT: { name: "橡實反應任務", ability: "抑制控制", story: "幫小松鼠接住橡實" },
  PM: { name: "湖邊圖片記憶", ability: "工作記憶", story: "幫兔子妹妹找回物品" },
  CBT: { name: "石頭小橋記憶", ability: "工作記憶", story: "幫鹿先生通過石頭橋" },
  DPT: { name: "蒼蠅派對任務", ability: "抑制控制", story: "幫狐狸夫婦趕走蒼蠅" },
  DCCS: { name: "孔雀服飾分類", ability: "認知彈性", story: "幫孔雀小姐整理服飾店" },
  LB: { name: "綿羊奶奶回家路", ability: "認知彈性", story: "幫綿羊奶奶照順序找到路" },
  DEFAULT: { name: "森林訓練任務", ability: "綜合能力", story: "波波與皮皮完成森林任務" },
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

const TERM_DICTIONARY = {
  accuracy: {
    title: "正確率",
    text: "正確率代表孩子這次任務中答對的比例。若偏低，可能是規則還不熟、任務太難，或當下注意力不足。",
  },
  avgReactionTime: {
    title: "平均反應時間",
    text: "平均反應時間是孩子看到目標後，到做出點擊反應所花的時間。時間較長不一定不好，也可能是孩子比較謹慎。",
  },
  miss: {
    title: "沒有點到",
    text: "孩子應該點擊目標，但沒有成功點到。可能是沒注意到、來不及反應，或目標太小。",
  },
  randomClick: {
    title: "亂點",
    text: "孩子點擊了非目標、空白處，或出現沒有依照規則的點擊。可以觀察衝動控制與規則理解。",
  },
  wrongTarget: {
    title: "點錯目標",
    text: "孩子有反應，但選到不符合規則的物件。可能是規則還不熟，或畫面干擾太多。",
  },
  repeatedClick: {
    title: "重複點擊",
    text: "孩子短時間內連續點同一個地方。可能是太急、想確認答案，或需要更清楚的回饋。",
  },
  timeout: {
    title: "未及時反應",
    text: "孩子在時間內沒有完成作答。可能是速度太快、目標不夠明顯，或孩子當下比較疲累。",
  },
  sequenceError: {
    title: "順序錯誤",
    text: "孩子在需要照順序完成的任務中，點擊順序不符合規則。可以觀察工作記憶與順序記憶。",
  },
  ruleSwitchError: {
    title: "換規則卡住",
    text: "孩子在任務規則改變後，仍使用舊規則作答。這與認知彈性有關。",
  },
  warningLevel: {
    title: "觀察標籤",
    text: "綠色代表穩定，橘色代表今天需要觀察，紅色代表本次比較吃力。這不是診斷結果，只是協助家長調整訓練。",
  },
  aiRecommendation: {
    title: "AI 建議",
    text: "AI 會綜合正確率、反應時間、錯誤類型與疲勞狀態，建議下一次比較適合的訓練難度、時間與提示方式。",
  },
};

const warningTextMap = {
  green: { label: "穩定小樹苗", text: "孩子本次表現穩定，可以維持目前訓練節奏。", status: "穩定" },
  orange: { label: "需要觀察", text: "孩子出現部分錯誤或反應變慢，建議先維持或稍微降低挑戰。", status: "需要觀察" },
  red: { label: "今天比較吃力", text: "孩子本次表現較吃力，建議降低難度、增加提示，或休息後再練習。", status: "比較吃力" },
};

const difficultyTextMap = { easy: "簡單", normal: "普通", hard: "困難" };
const difficultyCodeMap = { 1: "easy", 2: "normal", 3: "hard" };
const difficultyLevelMap = {
  easy: 1,
  normal: 2,
  medium: 2,
  hard: 3,
  simple: 1,
  low: 1,
  high: 3,
  簡單: 1,
  普通: 2,
  中等: 2,
  困難: 3,
};
const fatigueTextMap = { low: "低", medium: "中", high: "高" };

const errorLabelMap = {
  miss: "沒有點到",
  randomClick: "亂點",
  wrongTarget: "點錯目標",
  repeatedClick: "重複點擊",
  timeout: "未及時反應",
  sequenceError: "順序錯誤",
  ruleSwitchError: "換規則卡住",
};

const safeParse = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[ResultPage_PA] 忽略無法解析的快取資料：", error);
    return null;
  }
};

const safeGetStorageItem = (storage, key) => {
  try {
    return storage?.getItem(key) || null;
  } catch (error) {
    console.warn(`[ResultPage_PA] 讀取 ${key} 失敗：`, error);
    return null;
  }
};

const safeSetStorageItem = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[ResultPage_PA] 寫入 ${key} 失敗：`, error);
    return false;
  }
};

const clampNumber = (value, min, max, fallback) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const sanitizeDifficultyLevel = (value, fallback = 2) => {
  if (typeof value === "number") return clampNumber(value, 1, 3, fallback);

  const normalizedText = String(value ?? "")
    .trim()
    .toLowerCase();
  const matchedNumber = normalizedText.match(/\d+/)?.[0];

  if (matchedNumber) return clampNumber(matchedNumber, 1, 3, fallback);
  return difficultyLevelMap[normalizedText] || difficultyLevelMap[String(value ?? "").trim()] || fallback;
};

const normalizeDifficultyCode = (value, fallbackCode = "normal") => {
  const textValue = String(value ?? "").trim();
  const lowerValue = textValue.toLowerCase();
  if (["easy", "normal", "hard"].includes(lowerValue)) return lowerValue;
  return difficultyCodeMap[sanitizeDifficultyLevel(value, difficultyLevelMap[fallbackCode] || 2)] || fallbackCode;
};

const getStoredResult = (gameId) => {
  const keys = RESULT_STORAGE_KEYS[gameId] || [];

  for (const key of keys) {
    const rawValue = safeGetStorageItem(localStorage, key) || safeGetStorageItem(sessionStorage, key);
    const parsed = safeParse(rawValue);
    if (parsed) return parsed;
  }

  return null;
};

const getLatestResultFromStorage = () => {
  const gameIds = Object.keys(RESULT_STORAGE_KEYS);

  const results = gameIds
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
  if (accuracy < 60 || totalErrors >= 10 || fatigueLevel === "high") return "red";
  if (accuracy < 80 || totalErrors >= 5 || fatigueLevel === "medium") return "orange";
  return "green";
};

const normalizeResult = (rawResult = {}) => {
  const errorTypes = {
    ...DEFAULT_ERROR_TYPES,
    ...(rawResult.errorTypes || {}),
  };

  const accuracy = clampNumber(rawResult.accuracy ?? rawResult.score, 0, 100, 0);
  const avgReactionTime = clampNumber(rawResult.avgReactionTime ?? rawResult.avgRT, 0, Number.MAX_SAFE_INTEGER, 0);
  const stars = Number(rawResult.stars ?? 1);
  const recommendedDifficultyCode = normalizeDifficultyCode(
    rawResult.recommendedDifficulty || rawResult.aiRecommendation?.recommendedDifficulty,
  );
  const recommendedDifficultyLevel = sanitizeDifficultyLevel(
    rawResult.recommendedDifficultyLevel || rawResult.recommendedDifficulty || rawResult.aiRecommendation?.recommendedDifficulty,
    difficultyLevelMap[recommendedDifficultyCode] || 2,
  );
  const totalErrors =
    Number(rawResult.totalErrors) ||
    Object.values(errorTypes).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const fatigueLevel = rawResult.fatigueLevel || "low";
  const warningLevel = rawResult.warningLevel || getWarningLevel({ accuracy, totalErrors, fatigueLevel });

  return {
    ...rawResult,
    accuracy,
    avgReactionTime,
    stars: Number.isNaN(stars) ? 1 : Math.max(1, Math.min(3, stars)),
    totalErrors,
    errorTypes,
    warningLevel,
    recommendedDifficulty: recommendedDifficultyCode,
    recommendedDifficultyLevel,
    parentSummary:
      rawResult.parentSummary || "本次已完成森林任務，可參考下方資料了解孩子的表現狀態。",
    fatigueLevel,
  };
};

const getChildNameFromStorage = () => {
  const keys = [
    "currentChild",
    "selectedChild",
    "childProfile",
    "currentPatient",
    "selectedPatient",
    "patientProfile",
  ];

  for (const key of keys) {
    const parsed = safeParse(safeGetStorageItem(localStorage, key) || safeGetStorageItem(sessionStorage, key));
    if (parsed?.nickname) return parsed.nickname;
    if (parsed?.name) return parsed.name;
    if (parsed?.childName) return parsed.childName;
  }

  return "孩子";
};

const getDominantErrorKey = (errorTypes = {}) => {
  const entries = Object.entries(errorTypes).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  const [key, value] = entries[0] || ["", 0];
  return Number(value) > 0 ? key : "none";
};

const getObservationText = (result) => {
  const dominantError = getDominantErrorKey(result.errorTypes);

  if (result.fatigueLevel === "high") return "後段可能較疲累，建議下次縮短時間或先休息。";
  if (dominantError === "miss" || dominantError === "timeout") return "反應速度或注意目標需要再觀察。";
  if (dominantError === "randomClick" || dominantError === "repeatedClick") return "容易急著點擊，建議降低干擾並給明確回饋。";
  if (dominantError === "sequenceError") return "順序記憶需要練習，可以先用短序列暖身。";
  if (dominantError === "ruleSwitchError") return "換規則時較容易卡住，可以先用簡單規則暖身。";
  if (result.accuracy >= 85) return "整體表現穩定，可以維持節奏或小幅增加挑戰。";
  return "已完成任務，建議下次持續觀察正確率與反應速度。";
};

const getMainAdvice = (result) => {
  const { accuracy, errorTypes, fatigueLevel, recommendedDifficulty } = result;

  if (fatigueLevel === "high") return "AI 建議先休息一下，下一次可以縮短訓練時間。";
  if (errorTypes.miss >= 3 || errorTypes.timeout >= 3) return "AI 發現沒有點到或未及時反應較多，下一次可以放大目標、降低速度或縮短訓練時間。";
  if (errorTypes.randomClick >= 3 || errorTypes.repeatedClick >= 3) return "AI 發現亂點或連點較多，下一次可以降低干擾物並增加簡短提示。";
  if (errorTypes.ruleSwitchError >= 2) return "AI 發現規則切換比較吃力，下一次可以先從簡單規則暖身。";
  if (errorTypes.sequenceError >= 2) return "AI 發現順序錯誤較多，下一次可以先從較短序列開始。";
  if (accuracy >= 85 && recommendedDifficulty === "hard") return "AI 覺得孩子已經很穩定，可以嘗試更有挑戰的任務。";
  return "AI 建議依照目前難度繼續練習，並觀察下一次是否更穩定。";
};

const getRecommendedTrainingMinutes = (result) => {
  if (result.warningLevel === "red" || result.fatigueLevel === "high") return 8;
  if (result.warningLevel === "orange" || result.totalErrors >= 5) return 12;
  return 15;
};

const getSupportSuggestion = (result) => {
  const dominantError = getDominantErrorKey(result.errorTypes);

  if (dominantError === "miss" || dominantError === "timeout") return "放大目標、放慢速度";
  if (dominantError === "randomClick" || dominantError === "repeatedClick") return "降低干擾、增加明確回饋";
  if (dominantError === "sequenceError") return "先從短序列暖身";
  if (dominantError === "ruleSwitchError") return "先做簡單規則提醒";
  if (result.warningLevel === "green") return "維持目前提示量";
  return "少量提示，避免一次給太多指令";
};

const getRecommendedConfig = (gameId, gameInfo, result, childName) => {
  const recommendedDifficultyLevel = sanitizeDifficultyLevel(result.recommendedDifficultyLevel || result.recommendedDifficulty, 2);
  const recommendedDifficultyCode = difficultyCodeMap[recommendedDifficultyLevel] || "normal";

  return {
    source: "ResultPage_PA",
    childName,
    gameId,
    ability: gameInfo.ability,
    recommendedDifficulty: recommendedDifficultyLevel,
    recommendedDifficultyLevel,
    recommendedDifficultyCode,
    recommendedDifficultyLabel: difficultyTextMap[recommendedDifficultyCode],
    recommendedMinutes: getRecommendedTrainingMinutes(result),
    supportSuggestion: getSupportSuggestion(result),
    observationFocus: getObservationText(result),
    createdAt: new Date().toISOString(),
  };
};

const getAssistantQuestions = ({ result, gameInfo, warningInfo, childName }) => [
  {
    id: "stable",
    question: "今天表現算穩定嗎？",
    answer:
      result.warningLevel === "green"
        ? `${childName} 今天整體屬於${warningInfo.status}。正確率約 ${Math.round(result.accuracy)}%，可以維持目前訓練節奏。`
        : `${childName} 今天屬於「${warningInfo.status}」。這不代表能力不好，可能是任務難度、疲累或注意力狀態影響，建議下次先降低負擔再觀察。`,
  },
  {
    id: "error",
    question: "最多的錯誤代表什麼？",
    answer: (() => {
      const dominantError = getDominantErrorKey(result.errorTypes);
      if (dominantError === "none") return "本次沒有明顯錯誤集中，可以繼續觀察正確率與反應速度。";
      const count = Number(result.errorTypes[dominantError]) || 0;
      return `本次較常出現「${errorLabelMap[dominantError] || dominantError}」（${count} 次）。${TERM_DICTIONARY[dominantError]?.text || "建議下次持續觀察。"}`;
    })(),
  },
  {
    id: "nextAbility",
    question: "下次要練什麼能力？",
    answer: `建議下次優先延續「${gameInfo.ability}」相關訓練，並觀察：${getObservationText(result)}`,
  },
  {
    id: "difficulty",
    question: "要不要調整難度？",
    answer: `下次建議難度為「${difficultyTextMap[result.recommendedDifficulty] || result.recommendedDifficulty}」。${getMainAdvice(result)}`,
  },
  {
    id: "tired",
    question: "孩子是不是累了？",
    answer:
      result.fatigueLevel === "high"
        ? "本次後段表現可能受到疲累影響。建議下次縮短時間、先休息，或把任務拆成較短回合。"
        : "目前沒有明顯高疲勞訊號，但仍建議家長觀察孩子是否有揉眼睛、坐不住、反應變慢或不想繼續玩的情況。",
  },
];

const ResultPage_PA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [storageVersion, setStorageVersion] = useState(0);

  useEffect(() => {
    const refreshStorageSnapshot = () => setStorageVersion((version) => version + 1);

    window.addEventListener("storage", refreshStorageSnapshot);
    window.addEventListener("focus", refreshStorageSnapshot);

    return () => {
      window.removeEventListener("storage", refreshStorageSnapshot);
      window.removeEventListener("focus", refreshStorageSnapshot);
    };
  }, []);

  const latestStored = useMemo(() => getLatestResultFromStorage(), [storageVersion]);
  const gameId =
    normalizeGameId(state.gameId) ||
    normalizeGameId(state.resultData?.gameId) ||
    latestStored?.gameId ||
    "DEFAULT";

  const result = useMemo(() => {
    const rawResult = state.resultData || getStoredResult(gameId) || latestStored?.result || {};
    return normalizeResult(rawResult);
  }, [state.resultData, gameId, latestStored, storageVersion]);

  const childName =
    state.childName ||
    state.resultData?.childName ||
    result.childName ||
    result.nickname ||
    getChildNameFromStorage();

  const [selectedTerm, setSelectedTerm] = useState("accuracy");
  const [selectedQuestion, setSelectedQuestion] = useState("stable");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");

  const gameInfo = GAME_LABELS[gameId] || GAME_LABELS.DEFAULT;
  const warningInfo = warningTextMap[result.warningLevel] || warningTextMap.green;
  const selectedTermInfo = TERM_DICTIONARY[selectedTerm] || TERM_DICTIONARY.accuracy;
  const assistantQuestions = getAssistantQuestions({ result, gameInfo, warningInfo, childName });
  const selectedAssistantAnswer =
    assistantQuestions.find((item) => item.id === selectedQuestion) || assistantQuestions[0];
  const recommendedConfig = getRecommendedConfig(gameId, gameInfo, result, childName);

  const stopAssistantVoice = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakAssistantAnswer = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    stopAssistantVoice();
    const utterance = new SpeechSynthesisUtterance(selectedAssistantAnswer.answer);
    utterance.lang = "zh-TW";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [selectedAssistantAnswer.answer, stopAssistantVoice]);

  useEffect(() => {
    if (!isChatOpen) stopAssistantVoice();
    return () => stopAssistantVoice();
  }, [isChatOpen, selectedQuestion, stopAssistantVoice]);

  const closeParentPage = () => {
    navigate("/result-ch", { state: { gameId, resultData: result, childName } });
  };

  const goForest = () => {
    navigate("/game-menu", { state: { childName } });
  };

  const applyAiRecommendation = () => {
    const safeRecommendedConfig = {
      ...recommendedConfig,
      recommendedDifficulty: sanitizeDifficultyLevel(recommendedConfig.recommendedDifficulty, 2),
      recommendedDifficultyLevel: sanitizeDifficultyLevel(recommendedConfig.recommendedDifficultyLevel, 2),
    };
    const payload = JSON.stringify(safeRecommendedConfig);
    const savedConfig = safeSetStorageItem(localStorage, "recommendedTrainingConfig", payload);
    const savedPreference = safeSetStorageItem(localStorage, "parentTrainingPreference", payload);

    if (savedConfig && savedPreference) {
      setStorageVersion((version) => version + 1);
      setApplyMessage("已套用到下次訓練建議");
    } else {
      setApplyMessage("套用失敗，請稍後再試");
    }
  };

  return (
    <main className="result-pa-home-page" style={{ backgroundImage: `url(${homeBackground})` }}>
      <style>{resultPageStyle}</style>

      <header className="result-pa-topbar">
        <button type="button" className="forest-pill-button" onClick={closeParentPage}>
          ← 返回
        </button>

        <section className="child-title-chip" aria-label="目前兒童">
          <span>正在查看</span>
          <strong>{childName} 的結果</strong>
        </section>

        <div className="forest-score-pill" aria-label="本次星星">
          <span>★</span>
          <strong>{result.stars}</strong>
          <em>/ 3</em>
        </div>
      </header>

      <section className="result-pa-layout">
        <aside className="result-pa-profile-panel">
          <div className={`forest-status-badge ${result.warningLevel}`}>{warningInfo.label}</div>
          <p className="panel-kicker">家長觀察紀錄</p>
          <h1>{childName}</h1>
          <p className="panel-subtitle">{gameInfo.name}</p>

          <div className="profile-info-grid">
            <InfoTile label="任務故事" value={gameInfo.story} />
            <InfoTile label="主要能力" value={gameInfo.ability} />
          </div>

          <button type="button" className="forest-primary-button" onClick={goForest}>
            回到主頁
          </button>
        </aside>

        <section className="result-pa-content-panel">
          <section className="forest-card hero-summary-card">
            <div>
              <p className="eyebrow">今天表現</p>
              <h2>{childName} 今天{warningInfo.status}</h2>
              <p>{warningInfo.text}</p>
            </div>

            <div className="hero-summary-grid">
              <SummaryBubble label="正確率" value={`${Math.round(result.accuracy)}%`} />
              <SummaryBubble
                label="反應時間"
                value={result.avgReactionTime > 0 ? `${(result.avgReactionTime / 1000).toFixed(2)}秒` : "尚無"}
              />
              <SummaryBubble label="錯誤數" value={`${result.totalErrors}次`} />
            </div>
          </section>

          <section className="forest-card observation-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">AI 觀察</p>
                <h2>今天主要需要觀察</h2>
              </div>
              <button type="button" onClick={() => setIsChatOpen(true)}>
                問 AI
              </button>
            </div>
            <p className="large-text">{getObservationText(result)}</p>
            <p>{result.parentSummary}</p>
          </section>

          <section className="metric-card-grid" aria-label="本次數據摘要">
            <MetricCard
              label="正確率"
              value={`${Math.round(result.accuracy)}%`}
              helper="完成任務的答對比例"
              onHelp={() => {
                setSelectedTerm("accuracy");
                setIsChatOpen(true);
              }}
            />
            <MetricCard
              label="平均反應時間"
              value={result.avgReactionTime > 0 ? `${(result.avgReactionTime / 1000).toFixed(2)} 秒` : "尚無資料"}
              helper="看到目標到點擊的時間"
              onHelp={() => {
                setSelectedTerm("avgReactionTime");
                setIsChatOpen(true);
              }}
            />
            <MetricCard label="星級" value={`${result.stars} 星`} helper="兒童端看到的鼓勵結果" />
            <MetricCard label="疲勞程度" value={fatigueTextMap[result.fatigueLevel] || "低"} helper="依後半段表現估計" />
          </section>

          <section className="forest-card result-two-column">
            <div>
              <div className="section-heading-row compact">
                <div>
                  <p className="eyebrow">錯誤行為</p>
                  <h2>{childName} 卡在哪裡</h2>
                </div>
              </div>

              <div className="error-chip-grid">
                {Object.entries(result.errorTypes).map(([key, value]) => (
                  <button
                    type="button"
                    key={key}
                    className="error-chip"
                    onClick={() => {
                      if (TERM_DICTIONARY[key]) setSelectedTerm(key);
                      setIsChatOpen(true);
                    }}
                  >
                    <span>{errorLabelMap[key] || key}</span>
                    <strong>{Number(value) || 0}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="recommend-box">
              <p className="eyebrow">下次建議</p>
              <h2>{difficultyTextMap[result.recommendedDifficulty] || result.recommendedDifficulty}難度</h2>
              <ul>
                <li>時間：{recommendedConfig.recommendedMinutes} 分鐘</li>
                <li>提示：{recommendedConfig.supportSuggestion}</li>
                <li>觀察：{recommendedConfig.observationFocus}</li>
              </ul>
              <p>{getMainAdvice(result)}</p>
              <div className="apply-row">
                <button type="button" className="forest-primary-button small" onClick={applyAiRecommendation}>
                  套用 AI 建議
                </button>
                {applyMessage && <span>{applyMessage}</span>}
              </div>
            </div>
          </section>

          <p className="safe-note">
            本頁結果僅作為家長觀察與訓練調整參考，不代表正式診斷。若長期出現明顯困難，建議與專業人員討論。
          </p>
        </section>
      </section>

      <button
        type="button"
        className={`assist-floating-button ${isChatOpen ? "open" : ""}`}
        onClick={() => setIsChatOpen(true)}
        aria-label="開啟 AI 小助手"
      >
        <img src={assistIcon} alt="AI 小助手" />
        <span>問 AI</span>
      </button>

      {isChatOpen && (
        <section className="ai-chat-window" aria-label="AI 小助手聊天室">
          <div className="chat-header">
            <div>
              <img src={assistIcon} alt="AI 小助手" />
              <div>
                <strong>AI 小助手</strong>
                <span>{childName} 的結果說明</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                stopAssistantVoice();
                setIsChatOpen(false);
              }}
              aria-label="關閉 AI 小助手"
            >
              ×
            </button>
          </div>

          <div className="chat-body">
            <div className="chat-message assistant">
              <p>我可以幫你用家長看得懂的方式解釋 {childName} 的結果，也可以建議下次怎麼訓練。</p>
            </div>

            <div className="quick-question-list">
              {assistantQuestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedQuestion === item.id ? "active" : ""}
                  onClick={() => setSelectedQuestion(item.id)}
                >
                  {item.question}
                </button>
              ))}
            </div>

            <div className="chat-message user">
              <p>{selectedAssistantAnswer.question}</p>
            </div>
            <div className="chat-message assistant">
              <p>{selectedAssistantAnswer.answer}</p>
              <button type="button" className="voice-control-button" onClick={isSpeaking ? stopAssistantVoice : speakAssistantAnswer}>
                {isSpeaking ? "停止朗讀" : "朗讀說明"}
              </button>
            </div>

            <div className="chat-term-card">
              <div className="term-title-row">
                <strong>{selectedTermInfo.title}</strong>
                <select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)}>
                  {Object.entries(TERM_DICTIONARY).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
              <p>{selectedTermInfo.text}</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

const InfoTile = ({ label, value }) => (
  <article className="profile-info-tile">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);

const SummaryBubble = ({ label, value }) => (
  <article className="summary-bubble">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);

const MetricCard = ({ label, value, helper, onHelp }) => {
  return (
    <article className="metric-soft-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
      {onHelp && (
        <button type="button" onClick={onHelp} aria-label={`說明 ${label}`}>
          ?
        </button>
      )}
    </article>
  );
};

const resultPageStyle = `
.result-pa-home-page {
  --cream: #fff8d8;
  --cream-2: #fff0b8;
  --brown: #4b341d;
  --soft-brown: #7d6139;
  --green: #3ea94f;
  --blue: #4fa3f7;
  --orange: #ffa94d;
  --red: #ef6b5b;
  min-height: 100vh;
  width: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: var(--brown);
  padding: 16px clamp(12px, 2vw, 32px) 30px;
  position: relative;
  overflow-x: hidden;
}

.result-pa-home-page * {
  box-sizing: border-box;
}

.result-pa-home-page button {
  font-family: inherit;
}

.result-pa-topbar {
  width: min(1240px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 5;
}

.forest-pill-button {
  border: 0;
  min-height: 52px;
  padding: 0 22px;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff8cf, #ffe7a0);
  color: #5a421f;
  font-weight: 900;
  font-size: 1rem;
  box-shadow: 0 7px 0 rgba(112, 88, 35, 0.18), 0 10px 22px rgba(50, 40, 20, 0.15);
  cursor: pointer;
  white-space: nowrap;
}

.child-title-chip {
  justify-self: center;
  min-height: 56px;
  min-width: 0;
  max-width: 100%;
  padding: 8px 22px;
  border-radius: 999px;
  background: rgba(255, 248, 216, 0.94);
  border: 3px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 0 rgba(133, 113, 55, 0.16), 0 14px 26px rgba(54, 76, 28, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  overflow: hidden;
}

.child-title-chip span {
  color: #2d88c7;
  font-weight: 950;
  white-space: nowrap;
}

.child-title-chip strong {
  font-size: clamp(1.05rem, 2vw, 1.38rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forest-score-pill {
  min-height: 58px;
  padding: 0 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: linear-gradient(180deg, #55c96b, #2f9c49);
  color: white;
  box-shadow: 0 7px 0 rgba(16, 113, 50, 0.35), 0 12px 22px rgba(13, 91, 41, 0.2);
  white-space: nowrap;
}

.forest-score-pill span {
  color: #ffe36d;
  font-size: 1.2rem;
}

.forest-score-pill strong {
  font-size: 1.45rem;
  line-height: 1;
}

.forest-score-pill em {
  font-style: normal;
  opacity: 0.9;
  font-weight: 800;
}

.result-pa-layout {
  width: min(1240px, 100%);
  margin: clamp(16px, 2.8vw, 34px) auto 0;
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: clamp(16px, 2.3vw, 28px);
  align-items: start;
}

.result-pa-profile-panel,
.forest-card,
.metric-soft-card {
  background: rgba(255, 248, 216, 0.94);
  border: 4px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 0 rgba(133, 113, 55, 0.18), 0 18px 36px rgba(54, 76, 28, 0.18);
  backdrop-filter: blur(3px);
}

.result-pa-profile-panel {
  border-radius: 34px;
  padding: 24px;
  position: sticky;
  top: 16px;
  min-width: 0;
}

.forest-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 15px;
  border-radius: 999px;
  font-weight: 900;
  color: white;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.1);
}

.forest-status-badge.green { background: #41b75d; }
.forest-status-badge.orange { background: #f2a33a; }
.forest-status-badge.red { background: #eb6a5e; }

.panel-kicker {
  margin: 18px 0 4px;
  color: #2d88c7;
  font-weight: 950;
}

.result-pa-profile-panel h1 {
  margin: 0 0 6px;
  font-size: clamp(2rem, 4vw, 2.8rem);
  line-height: 1.05;
  word-break: break-word;
}

.panel-subtitle {
  margin: 0 0 18px;
  color: var(--soft-brown);
  font-weight: 850;
}

.profile-info-grid {
  display: grid;
  gap: 12px;
}

.profile-info-tile {
  border-radius: 22px;
  background: rgba(255, 238, 171, 0.88);
  border: 2px solid rgba(244, 203, 108, 0.65);
  padding: 15px;
}

.profile-info-tile span,
.summary-bubble span,
.recommend-box li,
.metric-soft-card span {
  color: #7d6139;
  font-weight: 800;
}

.profile-info-tile strong {
  display: block;
  margin-top: 4px;
  font-size: 1.08rem;
  line-height: 1.35;
}

.forest-primary-button {
  border: 0;
  border-radius: 999px;
  padding: 15px 22px;
  color: white;
  background: linear-gradient(180deg, #5fb8ff, #377de4);
  font-weight: 950;
  font-size: 1rem;
  box-shadow: 0 7px 0 rgba(37, 89, 151, 0.36), 0 12px 22px rgba(37, 89, 151, 0.2);
  cursor: pointer;
  width: 100%;
  margin-top: 16px;
}

.forest-primary-button.small {
  width: auto;
  min-height: 42px;
  padding: 10px 16px;
  margin-top: 0;
  box-shadow: 0 5px 0 rgba(37, 89, 151, 0.28);
}

.result-pa-content-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.forest-card {
  border-radius: 32px;
  padding: clamp(18px, 2vw, 26px);
  min-width: 0;
}

.hero-summary-card {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 18px;
  align-items: center;
}

.eyebrow {
  margin: 0 0 7px;
  color: #2d88c7;
  font-weight: 950;
  letter-spacing: 0.03em;
}

.hero-summary-card h2,
.observation-card h2,
.result-two-column h2 {
  margin: 0 0 8px;
  font-size: clamp(1.45rem, 2.5vw, 2.05rem);
  line-height: 1.1;
}

.hero-summary-card p,
.observation-card p,
.recommend-box p,
.safe-note,
.chat-message p,
.chat-term-card p {
  line-height: 1.65;
  font-weight: 750;
}

.hero-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-bubble {
  min-height: 108px;
  border-radius: 26px;
  background: linear-gradient(180deg, #fff3bd, #ffe39a);
  border: 2px solid rgba(235, 190, 83, 0.68);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-width: 0;
}

.summary-bubble strong {
  margin-top: 5px;
  font-size: clamp(1.2rem, 2vw, 1.65rem);
}

.section-heading-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-heading-row.compact {
  margin-bottom: 14px;
}

.section-heading-row button {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  color: white;
  background: #4fa3f7;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.large-text {
  font-size: 1.18rem;
  color: #3d5f25;
}

.metric-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-soft-card {
  min-height: 152px;
  border-radius: 28px;
  padding: 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.metric-soft-card p {
  margin: 0 0 8px;
  color: #2d88c7;
  font-weight: 950;
}

.metric-soft-card strong {
  display: block;
  font-size: clamp(1.35rem, 2.2vw, 2rem);
  margin-bottom: 7px;
  word-break: break-word;
}

.metric-soft-card button {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: #ffcf57;
  color: #6b4b12;
  font-weight: 950;
  cursor: pointer;
}

.result-two-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.85fr);
  gap: 22px;
}

.error-chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.error-chip {
  border: 2px solid rgba(235, 190, 83, 0.68);
  background: rgba(255, 238, 171, 0.78);
  border-radius: 18px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: var(--brown);
  cursor: pointer;
  min-width: 0;
}

.error-chip span {
  font-weight: 900;
  min-width: 0;
}

.error-chip strong {
  flex: 0 0 auto;
  min-width: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff8d8;
  color: #2d88c7;
  font-size: 1.15rem;
}

.recommend-box {
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(226, 248, 199, 0.95), rgba(255, 246, 199, 0.92));
  border: 2px solid rgba(113, 180, 75, 0.28);
  padding: 18px;
  min-width: 0;
}

.recommend-box ul {
  margin: 10px 0 12px;
  padding-left: 20px;
}

.apply-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.apply-row span {
  color: #2f8e43;
  font-weight: 950;
}

.safe-note {
  margin: 0;
  padding: 14px 18px;
  border-radius: 22px;
  background: rgba(255, 248, 216, 0.86);
  border: 2px solid rgba(255, 255, 255, 0.8);
  color: #6d5633;
}

.assist-floating-button {
  position: fixed;
  left: clamp(16px, 3vw, 34px);
  bottom: clamp(16px, 3vw, 34px);
  z-index: 30;
  border: 4px solid rgba(255, 255, 255, 0.94);
  border-radius: 28px;
  background: linear-gradient(180deg, #fff8d8, #ffe9a9);
  padding: 9px 15px 9px 9px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--brown);
  font-weight: 950;
  box-shadow: 0 10px 0 rgba(138, 105, 35, 0.22), 0 18px 34px rgba(52, 73, 29, 0.26);
  cursor: pointer;
}

.assist-floating-button img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  border-radius: 18px;
  background: white;
}

.assist-floating-button.open {
  transform: translateY(4px);
  box-shadow: 0 6px 0 rgba(138, 105, 35, 0.22), 0 14px 28px rgba(52, 73, 29, 0.22);
}

.ai-chat-window {
  position: fixed;
  left: clamp(16px, 3vw, 34px);
  bottom: 118px;
  width: min(430px, calc(100vw - 32px));
  max-height: min(680px, calc(100vh - 150px));
  z-index: 35;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 30px;
  background: rgba(255, 248, 216, 0.98);
  border: 4px solid rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 46px rgba(36, 57, 26, 0.32);
}

.chat-header {
  flex: 0 0 auto;
  padding: 14px 16px;
  background: linear-gradient(180deg, #fff0b8, #ffe29a);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 2px solid rgba(222, 177, 79, 0.35);
}

.chat-header > div {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.chat-header img {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 16px;
  background: white;
}

.chat-header strong,
.chat-header span {
  display: block;
}

.chat-header strong {
  font-size: 1.1rem;
}

.chat-header span {
  color: #7d6139;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px;
}

.chat-header button {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: #fff8d8;
  color: #7a5526;
  font-size: 1.6rem;
  font-weight: 900;
  cursor: pointer;
}

.chat-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.chat-message {
  max-width: 92%;
  padding: 12px 14px;
  margin-bottom: 10px;
  border-radius: 20px;
}

.chat-message p {
  margin: 0;
}

.chat-message.assistant {
  background: #ffffff;
  border-bottom-left-radius: 8px;
  border: 2px solid rgba(239, 207, 124, 0.48);
}

.chat-message.user {
  margin-left: auto;
  background: #dff2ff;
  border-bottom-right-radius: 8px;
  border: 2px solid rgba(89, 166, 229, 0.34);
}

.quick-question-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.quick-question-list button {
  border: 0;
  border-radius: 999px;
  padding: 9px 12px;
  background: #fff0b8;
  color: #634720;
  font-weight: 850;
  cursor: pointer;
}

.quick-question-list button.active {
  background: #4fa3f7;
  color: white;
}

.chat-term-card {
  margin-top: 14px;
  padding: 14px;
  border-radius: 22px;
  background: rgba(255, 238, 171, 0.72);
  border: 2px solid rgba(235, 190, 83, 0.5);
}

.term-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.term-title-row strong {
  font-size: 1.05rem;
}

.term-title-row select {
  min-width: 120px;
  max-width: 180px;
  border: 2px solid rgba(211, 163, 67, 0.45);
  border-radius: 999px;
  padding: 8px 10px;
  background: white;
  color: var(--brown);
  font-weight: 800;
}

@media (max-width: 1180px) {
  .result-pa-layout {
    grid-template-columns: 1fr;
  }

  .result-pa-profile-panel {
    position: relative;
    top: auto;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px 18px;
  }

  .forest-status-badge {
    grid-row: span 2;
  }

  .panel-kicker,
  .panel-subtitle {
    margin: 0;
  }

  .result-pa-profile-panel h1 {
    margin: 0;
  }

  .profile-info-grid {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-pa-profile-panel .forest-primary-button {
    width: auto;
    margin-top: 0;
    grid-row: span 2;
  }
}

@media (max-width: 960px) {
  .result-pa-topbar {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .forest-score-pill {
    grid-column: 2;
    justify-self: end;
  }

  .child-title-chip {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: stretch;
  }

  .hero-summary-card,
  .result-two-column {
    grid-template-columns: 1fr;
  }

  .metric-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .result-pa-profile-panel {
    grid-template-columns: 1fr;
  }

  .forest-status-badge,
  .result-pa-profile-panel .forest-primary-button {
    grid-row: auto;
  }

  .profile-info-grid {
    grid-template-columns: 1fr;
  }

  .hero-summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .result-pa-home-page {
    padding: 12px 10px 22px;
  }

  .result-pa-topbar {
    gap: 10px;
  }

  .forest-score-pill,
  .forest-pill-button {
    min-height: 46px;
    padding: 0 15px;
  }

  .child-title-chip {
    min-height: 50px;
    padding: 8px 14px;
    gap: 6px;
    flex-direction: column;
  }

  .child-title-chip span,
  .child-title-chip strong {
    line-height: 1.1;
  }

  .result-pa-profile-panel,
  .forest-card {
    border-radius: 26px;
    padding: 16px;
  }

  .metric-card-grid,
  .error-chip-grid {
    grid-template-columns: 1fr;
  }

  .summary-bubble {
    min-height: 82px;
  }

  .section-heading-row,
  .term-title-row {
    flex-direction: column;
    align-items: stretch;
  }

  .term-title-row select {
    max-width: 100%;
  }

  .assist-floating-button {
    left: 12px;
    bottom: 12px;
    padding: 7px 12px 7px 7px;
  }

  .assist-floating-button img {
    width: 50px;
    height: 50px;
  }

  .ai-chat-window {
    left: 10px;
    right: 10px;
    bottom: 86px;
    width: auto;
    max-height: calc(100vh - 108px);
    border-radius: 24px;
  }

  .chat-header span {
    max-width: 170px;
  }
}
`;

export default ResultPage_PA;
