import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import homeBackground from "../asset/Home_background.webp";
import assistIcon from "../asset/assist.webp";
import { getResultsByPatientFromCloud } from "../lib/database";
import "../styles/ResultPage_PA.css";

/**
 * ResultPage_PA.jsx
 * 家長端結果頁
 *
 * 更新重點：
 * 1. 背景吃 Home_background.webp，視覺貼近主頁森林風格
 * 2. 上方顯示目前小孩名稱
 * 3. AI 小助手使用 assist.webp，固定左下角，點擊後開啟可連續輸入的對話式聊天室
 * 4. 上一頁使用瀏覽器歷史紀錄返回，不再固定跳回 HomePage
 * 5. 平板、電腦、小螢幕自動換行，不使用固定超大寬度避免跑版
 * 5. 保留家長摘要、錯誤說明、AI 建議與套用建議
 * 6. 新增讀取 Supabase game_results，讓家長可以看到該兒童的測驗 / 訓練歷史紀錄
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
  SRT: { name: "橡實反應任務", ability: "抑制控制", story: "幫小松鼠接住橡實" },
  PM: { name: "湖邊圖片記憶", ability: "工作記憶", story: "幫兔子妹妹找回物品" },
  CBT: { name: "石頭小橋記憶", ability: "工作記憶", story: "幫鹿先生通過石頭橋" },
  SSG: { name: "蒼蠅派對任務", ability: "抑制控制", story: "幫狐狸夫婦趕走蒼蠅" },
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
  green: { label: "表現穩定", text: "孩子本次表現穩定，可以維持目前訓練節奏。", status: "表現穩定" },
  orange: { label: "建議持續觀察", text: "孩子出現部分錯誤或反應變慢，建議先維持或稍微降低挑戰。", status: "需要持續觀察" },
  red: { label: "近期需要留意", text: "孩子本次表現較吃力，建議降低難度、增加提示，或休息後再練習。", status: "近期需要留意" },
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


const getCurrentChildFromStorage = () => {
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
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
};

const getCurrentChildIdFromStorage = () => {
  const directKeys = ["currentChildId", "selectedChildId", "currentPatientId", "selectedPatientId", "patientId", "childId"];

  for (const key of directKeys) {
    const value = safeGetStorageItem(localStorage, key) || safeGetStorageItem(sessionStorage, key);
    if (value) return value;
  }

  const child = getCurrentChildFromStorage();
  return child?.childId || child?.id || child?.patient_id || child?.patientId || null;
};

const getResultTime = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const formatResultDate = (value) => {
  const time = getResultTime(value);
  if (!time) return "尚無時間";

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
};

const modeLabelMap = {
  test: "測驗",
  training: "訓練",
};

const normalizeMode = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("train") || text.includes("訓練")) return "training";
  if (text.includes("test") || text.includes("測驗")) return "test";
  return text || "test";
};

const getPayloadObject = (value) => {
  if (!value) return {};
  if (typeof value === "string") return safeParse(value) || {};
  if (typeof value === "object") return value;
  return {};
};

const normalizeRecordPayloadToRawResult = (record = {}) => {
  const payload = getPayloadObject(record.payload || record.raw_payload || record.result_payload || record.resultData);
  const rawResult = getPayloadObject(payload.rawResult || payload.result || payload);
  const summary = getPayloadObject(payload.summary || rawResult.summary || record.summary);
  const metrics = getPayloadObject(payload.metrics || rawResult.metrics || record.metrics);
  const ai = getPayloadObject(payload.ai || rawResult.ai || record.ai);
  const game = getPayloadObject(payload.game || rawResult.game);
  const session = getPayloadObject(payload.session || rawResult.session);

  const gameId = normalizeGameId(record.game_id || record.gameId || game.gameId || rawResult.gameId || rawResult.taskCode) || "DEFAULT";
  const mode = normalizeMode(record.mode || session.mode || rawResult.mode || record.record_type);

  return {
    ...rawResult,
    gameId,
    mode,
    gameName: record.game_name || game.gameName || rawResult.gameName,
    accuracy: record.accuracy ?? summary.accuracy ?? rawResult.accuracy,
    avgReactionTime: record.avg_reaction_time ?? summary.avgReactionTime ?? rawResult.avgReactionTime ?? rawResult.avgRT,
    stars: record.stars ?? summary.stars ?? rawResult.stars,
    score: record.score ?? summary.score ?? rawResult.score,
    totalTrials: record.total_trials ?? summary.totalTrials ?? rawResult.totalTrials,
    correctCount: record.correct_count ?? summary.correctCount ?? rawResult.correctCount,
    errorCount: record.error_count ?? summary.errorCount ?? rawResult.errorCount,
    errorTypes: metrics.errorTypes || rawResult.errorTypes || {},
    fatigueLevel: metrics.fatigueLevel || rawResult.fatigueLevel,
    recommendedDifficulty: metrics.recommendedDifficulty || rawResult.recommendedDifficulty || ai.aiSummary?.recommendedDifficulty,
    parentSummary: ai.parentSummary || rawResult.parentSummary,
    warningLevel: ai.warningLevel || rawResult.warningLevel,
    createdAt: record.finished_at || record.created_at || payload.createdAt || rawResult.createdAt,
    finishedAt: record.finished_at || session.finishedAt || rawResult.finishedAt,
  };
};

const normalizeHistoryRecord = (record = {}, source = "cloud") => {
  const rawResult = normalizeRecordPayloadToRawResult(record);
  const gameId = normalizeGameId(rawResult.gameId) || "DEFAULT";
  const mode = normalizeMode(rawResult.mode);
  const date = record.finished_at || record.created_at || rawResult.finishedAt || rawResult.createdAt || new Date().toISOString();

  return {
    id: record.id || record.resultId || `${source}-${gameId}-${mode}-${date}`,
    source,
    gameId,
    mode,
    date,
    time: getResultTime(date),
    result: normalizeResult(rawResult),
  };
};

const getLocalUnifiedRecords = (childId) => {
  const localResults = safeParse(safeGetStorageItem(localStorage, "efGameResults"), []) || [];
  const normalizedChildId = childId ? String(childId) : "";

  return localResults
    .filter((item) => {
      if (!normalizedChildId) return true;
      const itemChildId = item?.child?.childId || item?.child?.id || item?.patient_id || item?.patientId || item?.childId;
      return !itemChildId || String(itemChildId) === normalizedChildId;
    })
    .map((item) =>
      normalizeHistoryRecord(
        {
          id: item.resultId,
          game_id: item.game?.gameId,
          game_name: item.game?.gameName,
          mode: item.session?.mode,
          score: item.summary?.score,
          stars: item.summary?.stars,
          accuracy: item.summary?.accuracy,
          avg_reaction_time: item.summary?.avgReactionTime,
          total_trials: item.summary?.totalTrials,
          correct_count: item.summary?.correctCount,
          error_count: item.summary?.errorCount,
          finished_at: item.session?.finishedAt || item.createdAt,
          created_at: item.createdAt,
          payload: item,
        },
        "local",
      ),
    );
};

const mergeHistoryRecords = (records = []) => {
  const seen = new Set();

  return records
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)
    .filter((record) => {
      const key = [record.id, record.gameId, record.mode, record.date, record.result?.accuracy].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

const normalizeChatText = (text = "") =>
  String(text)
    .trim()
    .toLowerCase();

const buildAssistantReply = ({ message, result, gameInfo, warningInfo, childName, assistantQuestions, selectedTermInfo }) => {
  const normalizedMessage = normalizeChatText(message);
  const dominantError = getDominantErrorKey(result.errorTypes);
  const dominantErrorLabel = dominantError === "none" ? "沒有明顯集中錯誤" : errorLabelMap[dominantError] || dominantError;
  const dominantErrorCount = dominantError === "none" ? 0 : Number(result.errorTypes[dominantError]) || 0;
  const accuracyText = `${Math.round(result.accuracy)}%`;
  const reactionText = result.avgReactionTime > 0 ? `${(result.avgReactionTime / 1000).toFixed(2)} 秒` : "尚無資料";
  const difficultyText = difficultyTextMap[result.recommendedDifficulty] || result.recommendedDifficulty || "普通";

  const matchedPreset = assistantQuestions.find((item) => normalizedMessage.includes(normalizeChatText(item.question)));
  if (matchedPreset) return matchedPreset.answer;

  if (!normalizedMessage) return "你可以直接輸入想問的問題，例如：孩子今天穩定嗎、錯誤代表什麼、下次怎麼練。";

  if (/(正確|準確|accuracy|答對|分數|幾分)/i.test(normalizedMessage)) {
    return `${childName} 這次正確率約 ${accuracyText}。${warningInfo.text} 如果想讓表現更穩，可以先維持「${difficultyText}」難度，觀察下一次是否也穩定。`;
  }

  if (/(反應|速度|時間|慢|快|reaction|rt)/i.test(normalizedMessage)) {
    return `${childName} 這次平均反應時間是 ${reactionText}。反應慢不一定代表不好，也可能是孩子比較謹慎；建議搭配正確率與錯誤型態一起看。`;
  }

  if (/(錯|錯誤|亂點|點錯|沒點|未及時|timeout|miss|卡)/i.test(normalizedMessage)) {
    if (dominantError === "none") return `${childName} 這次沒有明顯集中在某一種錯誤，可以繼續觀察正確率、反應時間與疲勞程度。`;
    return `本次最明顯的是「${dominantErrorLabel}」，共 ${dominantErrorCount} 次。${TERM_DICTIONARY[dominantError]?.text || "建議下次持續觀察。"} 下次可以採用「${getSupportSuggestion(result)}」。`;
  }

  if (/(難度|調整|太難|太簡單|level|下一次|下次|怎麼練|訓練|建議)/i.test(normalizedMessage)) {
    return `下次建議使用「${difficultyText}」難度，時間約 ${getRecommendedTrainingMinutes(result)} 分鐘。重點可以放在「${gameInfo.ability}」，並搭配「${getSupportSuggestion(result)}」。${getMainAdvice(result)}`;
  }

  if (/(累|疲勞|休息|不想玩|坐不住|情緒)/i.test(normalizedMessage)) {
    return result.fatigueLevel === "high"
      ? `${childName} 這次有比較明顯的疲勞訊號，建議先休息，下次縮短到 ${getRecommendedTrainingMinutes(result)} 分鐘左右。`
      : `${childName} 目前沒有明顯高疲勞訊號，但仍可以觀察孩子是否揉眼睛、坐不住、反應變慢或不想繼續。`;
  }

  if (/(能力|認知|工作記憶|彈性|抑制|注意)/i.test(normalizedMessage)) {
    return `這個任務主要觀察「${gameInfo.ability}」。以這次結果來看，建議下次觀察：${getObservationText(result)}`;
  }

  if (/(意思|代表|說明|看不懂|什麼是|名詞)/i.test(normalizedMessage)) {
    return `${selectedTermInfo.title}：${selectedTermInfo.text}`;
  }

  return `我先用這次結果回答：${childName} 目前狀態是「${warningInfo.status}」，正確率約 ${accuracyText}，平均反應時間 ${reactionText}，主要觀察重點是「${getObservationText(result)}」。你也可以再問我「錯誤代表什麼」、「下次怎麼練」或「要不要調整難度」。`;
};

const ResultPage_PA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [storageVersion, setStorageVersion] = useState(0);
  const [cloudRecords, setCloudRecords] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const refreshStorageSnapshot = () => setStorageVersion((version) => version + 1);

    window.addEventListener("storage", refreshStorageSnapshot);
    window.addEventListener("focus", refreshStorageSnapshot);

    return () => {
      window.removeEventListener("storage", refreshStorageSnapshot);
      window.removeEventListener("focus", refreshStorageSnapshot);
    };
  }, []);

  const currentChildId = useMemo(
    () => {
      void storageVersion;
      return (
      state.childId ||
      state.patientId ||
      state.resultData?.childId ||
      state.resultData?.patientId ||
      state.resultData?.child?.childId ||
      state.resultData?.child?.id ||
      getCurrentChildIdFromStorage()
      );
    },
    [state.childId, state.patientId, state.resultData, storageVersion],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchCloudRecords = async () => {
      if (!currentChildId) {
        setCloudRecords([]);
        setCloudError("");
        return;
      }

      try {
        setCloudLoading(true);
        setCloudError("");
        const records = await getResultsByPatientFromCloud(currentChildId);
        if (!isMounted) return;
        setCloudRecords((records || []).map((record) => normalizeHistoryRecord(record, "cloud")));
      } catch (error) {
        console.warn("[ResultPage_PA] 讀取雲端 game_results 失敗，改用本機紀錄：", error);
        if (!isMounted) return;
        setCloudRecords([]);
        setCloudError("暫時無法讀取雲端紀錄，已顯示本機紀錄。");
      } finally {
        if (isMounted) setCloudLoading(false);
      }
    };

    fetchCloudRecords();

    return () => {
      isMounted = false;
    };
  }, [currentChildId, storageVersion]);

  const localHistoryRecords = useMemo(() => {
    void storageVersion;
    return getLocalUnifiedRecords(currentChildId);
  }, [currentChildId, storageVersion]);
  const resultHistory = useMemo(
    () => mergeHistoryRecords([...cloudRecords, ...localHistoryRecords]),
    [cloudRecords, localHistoryRecords],
  );
  const preferredHistoryRecord = resultHistory[0] || null;

  const latestStored = useMemo(() => {
    void storageVersion;
    return getLatestResultFromStorage();
  }, [storageVersion]);
  const gameId =
    normalizeGameId(state.gameId) ||
    normalizeGameId(state.resultData?.gameId) ||
    preferredHistoryRecord?.gameId ||
    latestStored?.gameId ||
    "DEFAULT";

  const result = useMemo(() => {
    void storageVersion;
    const rawResult = state.resultData || preferredHistoryRecord?.result || getStoredResult(gameId) || latestStored?.result || {};
    return normalizeResult(rawResult);
  }, [state.resultData, preferredHistoryRecord, gameId, latestStored, storageVersion]);

  const childName =
    state.childName ||
    state.resultData?.childName ||
    result.childName ||
    result.nickname ||
    getChildNameFromStorage();

  const [selectedTerm, setSelectedTerm] = useState("accuracy");
  const [selectedQuestion, setSelectedQuestion] = useState("stable");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState(null);

  const gameInfo = GAME_LABELS[gameId] || GAME_LABELS.DEFAULT;
  const warningInfo = warningTextMap[result.warningLevel] || warningTextMap.green;
  const selectedTermInfo = TERM_DICTIONARY[selectedTerm] || TERM_DICTIONARY.accuracy;
  const assistantQuestions = getAssistantQuestions({ result, gameInfo, warningInfo, childName });
  const selectedAssistantAnswer =
    assistantQuestions.find((item) => item.id === selectedQuestion) || assistantQuestions[0];
  const recommendedConfig = getRecommendedConfig(gameId, gameInfo, result, childName);
  const topErrorEntries = useMemo(
    () =>
      Object.entries(result.errorTypes || {})
        .filter(([, value]) => Number(value) > 0)
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, 3),
    [result.errorTypes],
  );

  // 歷史紀錄只顯示最新有資料的單一天，避免長期累積後頁面過長。
  // 使用最新紀錄日期，而不是系統今天，這樣舊資料或示範資料仍能正常顯示。
  const latestHistoryDayKey = useMemo(() => {
    const latestTime = resultHistory[0]?.time || getResultTime(resultHistory[0]?.date);
    if (!latestTime) return "";
    const latestDate = new Date(latestTime);
    return `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, "0")}-${String(latestDate.getDate()).padStart(2, "0")}`;
  }, [resultHistory]);

  const dailyHistoryRecords = useMemo(() => {
    if (!latestHistoryDayKey) return [];

    return resultHistory.filter((record) => {
      const recordTime = record.time || getResultTime(record.date);
      if (!recordTime) return false;
      const recordDate = new Date(recordTime);
      const recordDayKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
      return recordDayKey === latestHistoryDayKey;
    });
  }, [latestHistoryDayKey, resultHistory]);

  const filteredHistoryRecords = useMemo(
    () => dailyHistoryRecords.filter((record) => historyFilter === "all" || record.mode === historyFilter),
    [dailyHistoryRecords, historyFilter],
  );

  const displayedHistoryDate = latestHistoryDayKey
    ? latestHistoryDayKey.replace(/-/g, "/")
    : "尚無紀錄";
  const testRecordCount = dailyHistoryRecords.filter((record) => record.mode === "test").length;
  const trainingRecordCount = dailyHistoryRecords.filter((record) => record.mode === "training").length;
  const activeMenuItems = useMemo(
    () => [
      { id: "overview", label: "今日總覽", helper: "先看結論" },
      { id: "metrics", label: "表現數據", helper: "詳細數值" },
      { id: "errors", label: "錯誤分析", helper: "卡住原因" },
      { id: "recommend", label: "訓練建議", helper: "下次怎麼練" },
      { id: "history", label: "歷史紀錄", helper: `${dailyHistoryRecords.length || 0} 筆紀錄` },
      { id: "assistant", label: "AI 小助手", helper: "直接詢問" },
    ],
    [dailyHistoryRecords.length],
  );

  useEffect(() => {
    setChatMessages([
      {
        id: "welcome",
        role: "assistant",
        text: `你好，我是 AI 小助手。你可以直接像聊天一樣問我 ${childName} 的結果、錯誤原因或下次訓練建議。`,
      },
    ]);
  }, [childName, gameId]);

  const stopAssistantVoice = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakAssistantAnswer = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    const latestAssistantMessage = [...chatMessages].reverse().find((message) => message.role === "assistant");
    const speechText = latestAssistantMessage?.text || selectedAssistantAnswer.answer;

    stopAssistantVoice();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "zh-TW";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [chatMessages, selectedAssistantAnswer.answer, stopAssistantVoice]);

  useEffect(() => {
    if (!isChatOpen) stopAssistantVoice();
    return () => stopAssistantVoice();
  }, [isChatOpen, selectedQuestion, stopAssistantVoice]);

  const addChatQuestion = useCallback(
    (questionText) => {
      const trimmedQuestion = String(questionText || "").trim();
      if (!trimmedQuestion) return;

      const replyText = buildAssistantReply({
        message: trimmedQuestion,
        result,
        gameInfo,
        warningInfo,
        childName,
        assistantQuestions,
        selectedTermInfo,
      });

      setChatMessages((messages) => [
        ...messages,
        { id: `user-${Date.now()}`, role: "user", text: trimmedQuestion },
        { id: `assistant-${Date.now() + 1}`, role: "assistant", text: replyText },
      ]);
      setSelectedQuestion(assistantQuestions.find((item) => item.question === trimmedQuestion)?.id || selectedQuestion);
      setChatInput("");
    },
    [assistantQuestions, childName, gameInfo, result, selectedQuestion, selectedTermInfo, warningInfo],
  );

  const handleChatSubmit = (event) => {
    event.preventDefault();
    addChatQuestion(chatInput);
  };

  const closeParentPage = () => {
    stopAssistantVoice();
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

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

  const renderActiveSection = () => {
    if (activeSection === "metrics") {
      return (
        <section className="active-section-content" aria-label="表現數據">
          <div className="section-heading-row compact">
            <div>
              <p className="eyebrow">表現數據</p>
              <h2>詳細數值</h2>
              <p>這裡只放家長需要判讀的關鍵數字，避免全部資料同時擠在首頁。</p>
            </div>
          </div>

          <section className="metric-card-grid menu-metric-grid" aria-label="本次數據摘要">
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
            <MetricCard
              label="完成狀況"
              value={result.totalErrors > 0 ? `${result.totalErrors} 次錯誤` : "順利完成"}
              helper="本次任務的整體完成情形"
            />
            <MetricCard
              label="疲勞程度"
              value={fatigueTextMap[result.fatigueLevel] || "低"}
              helper="依後半段表現估計"
            />
          </section>
        </section>
      );
    }

    if (activeSection === "errors") {
      return (
        <section className="active-section-content" aria-label="錯誤分析">
          <div className="section-heading-row compact">
            <div>
              <p className="eyebrow">錯誤分析</p>
              <h2>{childName} 主要卡在哪裡</h2>
              <p>首頁只提醒主要錯誤，完整錯誤類型集中放在這個選單中查看。</p>
            </div>
          </div>

          <div className="top-error-summary">
            {topErrorEntries.length > 0 ? (
              topErrorEntries.map(([key, value]) => (
                <button
                  type="button"
                  key={key}
                  className="top-error-card"
                  onClick={() => {
                    if (TERM_DICTIONARY[key]) setSelectedTerm(key);
                    setIsChatOpen(true);
                  }}
                >
                  <span>{errorLabelMap[key] || key}</span>
                  <strong>{Number(value) || 0} 次</strong>
                  <small>{TERM_DICTIONARY[key]?.text || "建議下次持續觀察。"}</small>
                </button>
              ))
            ) : (
              <article className="empty-soft-card">本次沒有明顯集中錯誤，可以維持目前訓練節奏。</article>
            )}
          </div>

          <div className="error-chip-grid detail-error-grid">
            {Object.entries(result.errorTypes).map(([key, value]) => (
              <button
                type="button"
                key={key}
                className={Number(value) > 0 ? "error-chip has-error" : "error-chip"}
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
        </section>
      );
    }

    if (activeSection === "recommend") {
      return (
        <section className="active-section-content" aria-label="訓練建議">
          <div className="recommend-box menu-recommend-box">
            <p className="eyebrow">下次建議</p>
            <h2>{difficultyTextMap[result.recommendedDifficulty] || result.recommendedDifficulty}難度</h2>
            <div className="recommend-grid">
              <article>
                <span>建議時間</span>
                <strong>{recommendedConfig.recommendedMinutes} 分鐘</strong>
              </article>
              <article>
                <span>提示方式</span>
                <strong>{recommendedConfig.supportSuggestion}</strong>
              </article>
              <article>
                <span>觀察重點</span>
                <strong>{recommendedConfig.observationFocus}</strong>
              </article>
            </div>
            <p>{getMainAdvice(result)}</p>
            <div className="apply-row">
              <button type="button" className="forest-primary-button small" onClick={applyAiRecommendation}>
                套用 AI 建議
              </button>
              {applyMessage && <span>{applyMessage}</span>}
            </div>
          </div>
        </section>
      );
    }

    if (activeSection === "history") {
      return (
        <section className="active-section-content history-card" aria-label="測驗與訓練歷史紀錄">
          <div className="section-heading-row history-heading">
            <div>
              <p className="eyebrow">歷史紀錄</p>
              <h2>測驗 / 訓練紀錄</h2>
            </div>
            <div className="history-filter-row" role="group" aria-label="紀錄篩選">
              <button type="button" className={historyFilter === "all" ? "active" : ""} onClick={() => setHistoryFilter("all")}>
                當日全部 {dailyHistoryRecords.length}
              </button>
              <button type="button" className={historyFilter === "test" ? "active" : ""} onClick={() => setHistoryFilter("test")}>
                測驗 {testRecordCount}
              </button>
              <button
                type="button"
                className={historyFilter === "training" ? "active" : ""}
                onClick={() => setHistoryFilter("training")}
              >
                訓練 {trainingRecordCount}
              </button>
            </div>
          </div>

          <div className="history-day-summary">
            <strong>{displayedHistoryDate}</strong>
            <span>目前只顯示此日期的紀錄，共 {dailyHistoryRecords.length} 筆</span>
          </div>

          {cloudLoading && <p className="history-status-text">正在讀取雲端紀錄...</p>}
          {cloudError && <p className="history-status-text warning">{cloudError}</p>}

          {filteredHistoryRecords.length > 0 ? (
            <div className="history-record-list compact-history-list">
              {filteredHistoryRecords.map((record) => (
                <HistoryRecordCard key={`${record.source}-${record.id}-${record.date}`} record={record} onOpen={() => setSelectedHistoryRecord(record)} />
              ))}
            </div>
          ) : (
            <p className="history-empty-text">此日期沒有符合目前分類的紀錄。</p>
          )}
        </section>
      );
    }

    if (activeSection === "assistant") {
      return (
        <section className="active-section-content" aria-label="AI 小助手">
          <div className="assistant-preview-card">
            <div>
              <p className="eyebrow">AI 小助手</p>
              <h2>想知道原因時再打開</h2>
              <p>AI 聊天室不再固定佔用主畫面，點擊後才會展開，讓結果頁保持乾淨。</p>
            </div>
            <button type="button" className="forest-primary-button small" onClick={() => setIsChatOpen(true)}>
              開啟 AI 小助手
            </button>
          </div>

          <div className="quick-question-list menu-question-list" aria-label="常見問題">
            {assistantQuestions.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedQuestion === item.id ? "active" : ""}
                onClick={() => {
                  setIsChatOpen(true);
                  addChatQuestion(item.question);
                }}
              >
                {item.question}
              </button>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="active-section-content" aria-label="今日總覽">
        <div className="section-heading-row compact">
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

        <div className="overview-mini-grid">
          <article>
            <span>主要錯誤</span>
            <strong>
              {topErrorEntries.length > 0
                ? `${errorLabelMap[topErrorEntries[0][0]] || topErrorEntries[0][0]} ${Number(topErrorEntries[0][1]) || 0} 次`
                : "沒有明顯集中錯誤"}
            </strong>
            <button type="button" onClick={() => setActiveSection("errors")}>查看錯誤分析</button>
          </article>
          <article>
            <span>下次建議</span>
            <strong>{difficultyTextMap[result.recommendedDifficulty] || result.recommendedDifficulty}難度</strong>
            <button type="button" onClick={() => setActiveSection("recommend")}>查看訓練建議</button>
          </article>
          <article>
            <span>今日紀錄</span>
            <strong>{dailyHistoryRecords.length} 筆</strong>
            <button type="button" onClick={() => setActiveSection("history")}>查看歷史紀錄</button>
          </article>
        </div>
      </section>
    );
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


      </header>

      <section className="result-pa-layout menu-style-layout">
        <aside className="result-pa-menu-panel" aria-label="結果頁選單">
          <div className="menu-profile-card">
            <p className="panel-kicker">家長觀察紀錄</p>
            <h1>{childName}</h1>
            <p className="panel-subtitle">{gameInfo.name}</p>
            <div className="profile-info-grid compact-profile-grid">
              <InfoTile label="任務故事" value={gameInfo.story} />
              <InfoTile label="主要能力" value={gameInfo.ability} />
            </div>
          </div>

          <nav className="result-section-menu" aria-label="結果內容切換">
            {activeMenuItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={activeSection === item.id ? "active" : ""}
                onClick={() => setActiveSection(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.helper}</span>
              </button>
            ))}
          </nav>

          <button type="button" className="forest-primary-button menu-home-button" onClick={goForest}>
            回到主頁
          </button>
        </aside>

        <section className="result-pa-content-panel menu-content-panel">
          <section className="forest-card hero-summary-card menu-hero-summary-card">
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

          <section className="forest-card active-panel-card">
            {renderActiveSection()}
          </section>

          <p className="safe-note">
            本頁結果僅作為家長觀察與訓練調整參考，不代表正式診斷。若長期出現明顯困難，建議與專業人員討論。
          </p>
        </section>
      </section>

      {selectedHistoryRecord && (
        <HistoryRecordDetail
          record={selectedHistoryRecord}
          onClose={() => setSelectedHistoryRecord(null)}
        />
      )}

      <button
        type="button"
        className={`assist-floating-button ${isChatOpen ? "open" : ""}`}
        onClick={() => setIsChatOpen(true)}
        aria-label="開啟 AI 小助手"
      >
        <img width={184} height={184} src={assistIcon} alt="AI 小助手" />
        <span>問 AI</span>
      </button>

      {isChatOpen && (
        <section className="ai-chat-window" aria-label="AI 小助手聊天室">
          <div className="chat-header">
            <div>
              <img width={184} height={184} loading="lazy" src={assistIcon} alt="AI 小助手" />
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
            <div className="chat-message-list">
              {chatMessages.map((message) => (
                <div key={message.id} className={`chat-message ${message.role}`}>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>

            <div className="quick-question-list" aria-label="常見問題">
              {assistantQuestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedQuestion === item.id ? "active" : ""}
                  onClick={() => addChatQuestion(item.question)}
                >
                  {item.question}
                </button>
              ))}
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

          <form className="chat-input-row" onSubmit={handleChatSubmit}>
            <input
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="輸入問題，例如：下次怎麼練？"
              aria-label="輸入想問 AI 小助手的問題"
            />
            <button type="submit">送出</button>
            <button type="button" className="voice-control-button" onClick={isSpeaking ? stopAssistantVoice : speakAssistantAnswer}>
              {isSpeaking ? "停止" : "朗讀"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
};

const HistoryRecordCard = ({ record, onOpen }) => {
  const info = GAME_LABELS[record.gameId] || GAME_LABELS.DEFAULT;
  const result = record.result || {};

  return (
    <button type="button" className="history-record-card" onClick={onOpen}>
      <div className="history-record-main">
        <span className={`history-mode-pill ${record.mode}`}>{modeLabelMap[record.mode] || "紀錄"}</span>
        <div>
          <strong>{info.name}</strong>
          <p>{formatResultDate(record.date)}</p>
        </div>
      </div>
      <div className="history-record-metrics">
        <span>正確率 {Math.round(Number(result.accuracy) || 0)}%</span>
        <span>{result.avgReactionTime > 0 ? `${(result.avgReactionTime / 1000).toFixed(2)} 秒` : "反應時間尚無"}</span>
        <span>{Number(result.totalErrors) > 0 ? `錯誤 ${Number(result.totalErrors)} 次` : "順利完成"}</span>
      </div>
      <span className="history-open-hint">查看詳情 →</span>
    </button>
  );
};

const HistoryRecordDetail = ({ record, onClose }) => {
  const info = GAME_LABELS[record.gameId] || GAME_LABELS.DEFAULT;
  const result = normalizeResult(record.result || {});
  const modeLabel = modeLabelMap[record.mode] || "紀錄";
  const difficultyLabel = difficultyTextMap[result.recommendedDifficulty] || "目前";

  return (
    <div className="history-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="history-detail-modal" role="dialog" aria-modal="true" aria-label={`${info.name} 詳細紀錄`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="history-detail-header">
          <div>
            <span className={`history-mode-pill ${record.mode}`}>{modeLabel}</span>
            <h2>{info.name}</h2>
            <p>{formatResultDate(record.date)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉詳細紀錄">×</button>
        </div>

        <div className="history-detail-summary">
          <article><span>主要能力</span><strong>{info.ability}</strong></article>
          <article><span>完成情形</span><strong>{result.totalErrors > 0 ? `出現 ${result.totalErrors} 次錯誤` : "順利完成"}</strong></article>
          <article><span>平均反應</span><strong>{result.avgReactionTime > 0 ? `${(result.avgReactionTime / 1000).toFixed(2)} 秒` : "未記錄"}</strong></article>
          <article><span>任務難度</span><strong>{difficultyLabel}難度</strong></article>
        </div>

        <div className="history-detail-section">
          <h3>當次表現摘要</h3>
          <p>{getObservationText(result)}</p>
        </div>

        <div className="history-detail-section">
          <h3>下次練習建議</h3>
          <p>{getMainAdvice(result)}</p>
        </div>

        <div className="history-detail-section">
          <h3>主要錯誤情形</h3>
          <div className="history-detail-errors">
            {Object.entries(result.errorTypes)
              .filter(([, value]) => Number(value) > 0)
              .map(([key, value]) => (
                <span key={key}>{errorLabelMap[key] || key}：{Number(value)} 次</span>
              ))}
            {Object.values(result.errorTypes).every((value) => Number(value) <= 0) && <span>本次未記錄明顯錯誤</span>}
          </div>
        </div>
      </section>
    </div>
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

.menu-style-layout {
  grid-template-columns: minmax(248px, 300px) minmax(0, 1fr);
}

.result-pa-menu-panel {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.menu-profile-card,
.result-section-menu,
.active-panel-card {
  background: rgba(255, 248, 216, 0.94);
  border: 4px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 0 rgba(133, 113, 55, 0.18), 0 18px 36px rgba(54, 76, 28, 0.18);
  backdrop-filter: blur(3px);
}

.menu-profile-card {
  border-radius: 32px;
  padding: 20px;
}

.menu-profile-card .panel-kicker {
  margin-top: 0;
}

.menu-profile-card h1 {
  margin: 0 0 6px;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  line-height: 1.08;
  word-break: break-word;
}

.compact-profile-grid {
  margin-top: 14px;
}

.result-section-menu {
  border-radius: 30px;
  padding: 12px;
  display: grid;
  gap: 10px;
}

.result-section-menu button {
  width: 100%;
  border: 2px solid rgba(235, 190, 83, 0.38);
  border-radius: 22px;
  background: rgba(255, 238, 171, 0.76);
  color: var(--brown);
  padding: 13px 14px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 3px;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}

.result-section-menu button:hover {
  transform: translateY(-1px);
  border-color: rgba(79, 163, 247, 0.48);
}

.result-section-menu button.active {
  background: linear-gradient(180deg, #5fb8ff, #377de4);
  color: white;
  border-color: rgba(255, 255, 255, 0.82);
  box-shadow: 0 7px 0 rgba(37, 89, 151, 0.26), 0 12px 20px rgba(37, 89, 151, 0.18);
}

.result-section-menu strong {
  font-size: 1.03rem;
  font-weight: 950;
}

.result-section-menu span {
  font-size: .88rem;
  font-weight: 850;
  opacity: .82;
}

.menu-home-button {
  margin-top: 0;
}

.menu-content-panel {
  gap: 16px;
}

.menu-hero-summary-card {
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
}

.active-panel-card {
  border-radius: 32px;
  padding: clamp(18px, 2vw, 28px);
  min-height: 360px;
}

.active-section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.active-section-content h2,
.assistant-preview-card h2,
.menu-recommend-box h2 {
  margin: 0 0 8px;
  font-size: clamp(1.45rem, 2.5vw, 2.05rem);
  line-height: 1.1;
}

.active-section-content p,
.assistant-preview-card p,
.top-error-card small,
.empty-soft-card {
  line-height: 1.7;
  font-weight: 750;
}

.overview-mini-grid,
.top-error-summary,
.recommend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.overview-mini-grid article,
.top-error-card,
.recommend-grid article,
.empty-soft-card,
.assistant-preview-card {
  border-radius: 24px;
  background: rgba(255, 238, 171, 0.72);
  border: 2px solid rgba(235, 190, 83, 0.5);
  padding: 16px;
  min-width: 0;
}

.overview-mini-grid span,
.recommend-grid span,
.top-error-card span {
  display: block;
  color: #7d6139;
  font-weight: 900;
  margin-bottom: 6px;
}

.overview-mini-grid strong,
.recommend-grid strong,
.top-error-card strong {
  display: block;
  color: var(--brown);
  font-size: 1.08rem;
  line-height: 1.35;
}

.overview-mini-grid button {
  margin-top: 12px;
  border: 0;
  border-radius: 999px;
  padding: 9px 12px;
  background: #4fa3f7;
  color: white;
  font-weight: 900;
  cursor: pointer;
}

.menu-metric-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.top-error-card {
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.top-error-card strong {
  color: #2d88c7;
  font-size: 1.35rem;
  margin-bottom: 8px;
}

.detail-error-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.error-chip.has-error {
  border-color: rgba(239, 126, 67, 0.62);
  background: rgba(255, 225, 179, 0.86);
}

.menu-recommend-box {
  padding: clamp(18px, 2vw, 24px);
}

.recommend-grid {
  margin: 12px 0;
}

.assistant-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.assistant-preview-card .forest-primary-button {
  flex: 0 0 auto;
}

.menu-question-list {
  margin: 0;
}

.compact-history-list {
  max-height: 520px;
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

.history-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.history-heading {
  align-items: center;
}

.history-filter-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.history-filter-row button {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: #fff0b8;
  color: #634720;
  font-weight: 950;
  cursor: pointer;
  white-space: nowrap;
}

.history-filter-row button.active {
  background: #4fa3f7;
  color: white;
}

.history-status-text,
.history-empty-text {
  margin: 0;
  line-height: 1.6;
  color: #7d6139;
  font-weight: 850;
}

.history-status-text.warning {
  color: #b06f11;
}

.history-day-summary {
  margin: 14px 0 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(79, 163, 247, 0.22);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #547086;
}

.history-day-summary strong {
  color: #267eb8;
  font-size: 1rem;
  white-space: nowrap;
}

.history-day-summary span {
  font-size: 0.9rem;
  font-weight: 800;
  text-align: right;
}

.history-record-list {
  display: grid;
  max-height: 620px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 6px;
  scrollbar-gutter: stable;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.history-record-card {
  min-width: 0;
  border-radius: 22px;
  padding: 14px;
  background: rgba(255, 238, 171, 0.72);
  border: 2px solid rgba(235, 190, 83, 0.5);
}

.history-record-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  min-width: 0;
}

.history-mode-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 7px 10px;
  color: white;
  background: #41b75d;
  font-size: 0.9rem;
  font-weight: 950;
}

.history-mode-pill.test {
  background: #4fa3f7;
}

.history-mode-pill.training {
  background: #41b75d;
}

.history-record-main strong,
.history-record-main p {
  display: block;
  margin: 0;
  min-width: 0;
}

.history-record-main strong {
  font-size: 1.05rem;
}

.history-record-main p {
  color: #7d6139;
  font-weight: 800;
}

.history-record-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.history-record-metrics span {
  border-radius: 999px;
  padding: 6px 9px;
  background: rgba(255, 248, 216, 0.88);
  color: #5a421f;
  font-size: 0.9rem;
  font-weight: 900;
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

.chat-message-list {
  display: flex;
  flex-direction: column;
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

.chat-input-row {
  flex: 0 0 auto;
  padding: 12px;
  border-top: 2px solid rgba(222, 177, 79, 0.35);
  background: rgba(255, 240, 184, 0.95);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}

.chat-input-row input {
  min-width: 0;
  min-height: 42px;
  border: 2px solid rgba(211, 163, 67, 0.45);
  border-radius: 999px;
  padding: 0 14px;
  color: var(--brown);
  font-weight: 800;
  outline: none;
  background: white;
}

.chat-input-row button,
.voice-control-button {
  border: 0;
  border-radius: 999px;
  padding: 0 13px;
  min-height: 42px;
  background: #4fa3f7;
  color: white;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.voice-control-button {
  background: #41b75d;
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
  .result-pa-layout,
  .menu-style-layout {
    grid-template-columns: 1fr;
  }

  .result-pa-menu-panel {
    position: relative;
    top: auto;
  }

  .menu-profile-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px 16px;
  }

  .menu-profile-card .panel-kicker,
  .menu-profile-card .panel-subtitle {
    margin: 0;
  }

  .menu-profile-card h1 {
    margin: 0;
  }

  .compact-profile-grid {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-section-menu {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .metric-card-grid,
  .history-record-list,
  .overview-mini-grid,
  .top-error-summary,
  .recommend-grid,
  .detail-error-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .history-day-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .history-day-summary span {
    text-align: left;
  }

  .history-record-list {
    max-height: 540px;
    padding-right: 3px;
  }
  .result-pa-profile-panel {
    grid-template-columns: 1fr;
  }

  .forest-status-badge,
  .result-pa-profile-panel .forest-primary-button {
    grid-row: auto;
  }

  .profile-info-grid,
  .compact-profile-grid,
  .result-section-menu,
  .overview-mini-grid,
  .top-error-summary,
  .recommend-grid,
  .detail-error-grid,
  .menu-metric-grid {
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
  .error-chip-grid,
  .history-record-list {
    grid-template-columns: 1fr;
  }

  .history-heading {
    align-items: stretch;
  }

  .history-filter-row {
    justify-content: flex-start;
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

  .chat-input-row {
    grid-template-columns: 1fr auto;
  }

  .chat-input-row .voice-control-button {
    grid-column: 1 / -1;
  }
}

.history-record-card {
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
}
.history-record-card:hover {
  transform: translateY(-2px);
  border-color: #7eb7df;
  box-shadow: 0 10px 22px rgba(39, 91, 133, 0.10);
}
.history-open-hint {
  position: absolute;
  right: 16px;
  bottom: 12px;
  color: #2d6f9f;
  font-size: .82rem;
  font-weight: 800;
}
.history-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(20, 42, 60, .46);
  display: grid;
  place-items: center;
  padding: 20px;
}
.history-detail-modal {
  width: min(760px, 100%);
  max-height: min(86vh, 760px);
  overflow-y: auto;
  background: #fff;
  border-radius: 24px;
  border: 1px solid #d8e4ec;
  box-shadow: 0 24px 70px rgba(24, 53, 73, .22);
  padding: 26px;
}
.history-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2eaf0;
}
.history-detail-header h2 { margin: 10px 0 4px; color: #173b56; }
.history-detail-header p { margin: 0; color: #6e8495; font-weight: 700; }
.history-detail-header > button {
  width: 42px; height: 42px; border: 0; border-radius: 12px;
  background: #edf4f8; color: #2a5f84; font-size: 1.7rem; cursor: pointer;
}
.history-detail-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
  margin: 20px 0;
}
.history-detail-summary article {
  background: #f5f9fc;
  border: 1px solid #dce8f0;
  border-radius: 16px;
  padding: 15px;
}
.history-detail-summary span, .history-detail-summary strong { display: block; }
.history-detail-summary span { color: #708494; font-size: .86rem; font-weight: 700; margin-bottom: 5px; }
.history-detail-summary strong { color: #173b56; }
.history-detail-section { margin-top: 18px; }
.history-detail-section h3 { margin: 0 0 8px; color: #245b80; }
.history-detail-section p { margin: 0; line-height: 1.75; color: #425d70; font-weight: 650; }
.history-detail-errors { display: flex; flex-wrap: wrap; gap: 8px; }
.history-detail-errors span {
  background: #edf4f8; color: #315d7a; border-radius: 999px; padding: 8px 12px; font-weight: 750;
}
@media (max-width: 620px) {
  .history-detail-summary { grid-template-columns: 1fr; }
  .history-detail-modal { padding: 20px; border-radius: 18px; }
}
`;

export default ResultPage_PA;
