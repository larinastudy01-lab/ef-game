// src/pages/ResultPage_LB.jsx

import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import calculateLBScore from "../utils/lbScoring";
import "../styles/GamePage_LB.css";

import backgroundImg from "../asset/LB/LB_background.webp";
import sheepImg from "../asset/LB/blowing_bubbles.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeAgainBtn from "../asset/home/again.webp";

/*
  =========================================================
  ResultPage_LB.jsx
  Linking Balloons｜氣球小路結果頁

  呈現：
  - 家長端：能力雷達圖、能力條、練習建議

  支援：
  - navigate("/result-lb", { state: resultPayload })
  - sessionStorage.setItem("LB_RESULT", JSON.stringify(resultPayload))
  =========================================================
*/

const MENU_ROUTE = "/game-menu";
const TEST_MAP_ROUTE = "/test-map";
const TEST_ROUTE = "/test-lb";
const TRAINING_ROUTE = "/training-lb";
const SESSION_KEY = "LB_RESULT";
const CLICK_SOUND_SRC = "/sounds/click.mp3";
const HAT_GAME_ROUTE = "/hat-sticker-game";
const HAT_SCHEDULER_KEY = "hatRewardScheduler";
const HAT_MIN_INTERVAL = 5;
const HAT_MAX_INTERVAL = 8;

const DEFAULT_SUMMARY_DATA = {
  completedTrials: 0,
  totalTrials: 0,
  reason: "completed",
  unlockStatus: {},
  unlockedLevels: {},
  unlockInfo: {},
  nextUnlock: {},
};

const DEFAULT_PARENT_METRICS = {
  ruleUnderstanding: 0,
  cognitiveFlexibility: 0,
  processingSpeed: 0,
  attentionStability: 0,
  interferenceControl: 0,
};

const DEFAULT_CLINICIAN_METRICS = {
  totalTrials: 0,
  correctTrials: 0,
  wrongTrials: 0,
  timeoutTrials: 0,
  accuracy: 0,
  switchAccuracy: 0,
  avgReactionTime: 0,
  rtStd: 0,
  maxConsecutiveErrors: 0,
  interferenceErrors: 0,
  interferenceRate: 0,
  ruleBreakdown: {},
  trialLogs: [],
};


function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createRandomHatInterval() {
  return (
    Math.floor(Math.random() * (HAT_MAX_INTERVAL - HAT_MIN_INTERVAL + 1)) +
    HAT_MIN_INTERVAL
  );
}

function resolveChildId(payload) {
  return (
    payload?.childId ||
    payload?.profile?.childId ||
    payload?.result?.childId ||
    payload?.lbResult?.childId ||
    localStorage.getItem("currentChildId") ||
    localStorage.getItem("selectedChildId") ||
    "guest"
  );
}

function getHatSchedulerStorageKey(childId) {
  return `${HAT_SCHEDULER_KEY}_${childId || "guest"}`;
}

function evaluateHatReward({ childId, resultId }) {
  const storageKey = getHatSchedulerStorageKey(childId);
  const stored = safeJsonParse(localStorage.getItem(storageKey), {});

  if (stored?.lastResultId === resultId) {
    return Boolean(stored?.lastDecision);
  }

  const currentCount = Math.max(0, safeNumber(stored?.completedGameCount, 0)) + 1;
  const targetCount = Math.max(
    HAT_MIN_INTERVAL,
    safeNumber(stored?.targetGameCount, createRandomHatInterval())
  );
  const shouldTrigger = currentCount >= targetCount;

  const nextState = shouldTrigger
    ? {
        completedGameCount: 0,
        targetGameCount: createRandomHatInterval(),
        lastResultId: resultId,
        lastDecision: true,
        updatedAt: new Date().toISOString(),
      }
    : {
        completedGameCount: currentCount,
        targetGameCount: targetCount,
        lastResultId: resultId,
        lastDecision: false,
        updatedAt: new Date().toISOString(),
      };

  localStorage.setItem(storageKey, JSON.stringify(nextState));
  return shouldTrigger;
}

function createRewardSessionId(childId) {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `lb-${childId || "guest"}-${Date.now()}-${randomPart}`;
}

function safeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function normalizePayload(rawPayload) {
  const payload = safeObject(rawPayload, {});
  const summaryData = {
    ...DEFAULT_SUMMARY_DATA,
    ...safeObject(payload.summaryData, {}),
  };

  return {
    ...payload,
    summaryData,
    unlockStatus: {
      ...safeObject(summaryData.unlockStatus, {}),
      ...safeObject(payload.unlockStatus, {}),
    },
    unlockedLevels: {
      ...safeObject(summaryData.unlockedLevels, {}),
      ...safeObject(payload.unlockedLevels, {}),
    },
    unlockInfo: {
      ...safeObject(summaryData.unlockInfo, {}),
      ...safeObject(payload.unlockInfo, {}),
    },
    nextUnlock: {
      ...safeObject(summaryData.nextUnlock, {}),
      ...safeObject(payload.nextUnlock, {}),
    },
  };
}

const RULE_LABELS = {
  color: "顏色規則",
  shape: "形狀規則",
  colorShape: "顏色＋形狀規則",
  compound: "複合規則",
  rule_color: "顏色規則",
  rule_shape: "形狀規則",
  rule_colorShape: "顏色＋形狀規則",
  unknown: "未標記規則",
  "未分類規則": "未分類規則",
};

const STAGE_LABELS = {
  single: "單一線索",
  switch: "規則切換",
  mixed: "混合線索",
  compound: "複合線索",
  easy: "簡單",
  normal: "普通",
  hard: "困難",
  test: "測驗",
  practice: "練習",
  unknown: "未標記",
};

const FINISH_REASON_LABELS = {
  completed: "完成全部題目",
  too_many_errors: "連續錯誤達上限",
  timeout: "逾時結束",
  manual: "手動結束",
};

const WRONG_TYPE_LABELS = {
  timeout: "逾時",
  color_error: "顏色判斷錯誤",
  shape_error: "形狀判斷錯誤",
  color_shape_error: "顏色＋形狀整合錯誤",
  partial_match_or_compound_error: "只符合部分線索",
  previous_rule_interference: "受到上一個規則影響",
  rule_switch_interference: "規則切換干擾",
  other_error: "其他錯誤",
  unknown: "未標記",
};

function readSessionResult() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("LB_RESULT sessionStorage 解析失敗：", error);
    return null;
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function percent(value) {
  const number = safeNumber(value, 0);
  if (number <= 1 && number >= 0) return Math.round(number * 100);
  return Math.round(number);
}

function formatPercent(value) {
  return `${percent(value)}%`;
}

function formatMs(value) {
  const number = safeNumber(value, 0);
  if (number <= 0) return "資料不足";
  return `${Math.round(number)} ms`;
}

function getTrialLogsFromPayload(payload) {
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.trialLogs)) return payload.trialLogs;
  if (Array.isArray(payload?.lbTrialLogs)) return payload.lbTrialLogs;
  if (Array.isArray(payload?.lbHistory)) return payload.lbHistory;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.trials)) return payload.trials;
  if (Array.isArray(payload?.records)) return payload.records;

  if (Array.isArray(payload?.result?.clinicianMetrics?.trialLogs)) {
    return payload.result.clinicianMetrics.trialLogs;
  }

  if (Array.isArray(payload?.lbResult?.clinicianMetrics?.trialLogs)) {
    return payload.lbResult.clinicianMetrics.trialLogs;
  }

  return [];
}

function normalizeResult(result) {
  const safeResult = safeObject(result, {});

  return {
    ...safeResult,
    stars: clamp(safeNumber(safeResult.stars, 1), 1, 3),
    finalScore: clamp(safeNumber(safeResult.finalScore, 0), 0, 100),
    parentSummary:
      safeResult.parentSummary || "目前資料不足，建議重新測驗一次。",
    parentMetrics: {
      ...DEFAULT_PARENT_METRICS,
      ...safeObject(safeResult.parentMetrics, {}),
    },
    clinicianMetrics: {
      ...DEFAULT_CLINICIAN_METRICS,
      ...safeObject(safeResult.clinicianMetrics, {}),
    },
  };
}

function getResultFromPayload(payload, trialLogs) {
  const existingResult =
    payload?.lbResult ||
    payload?.result ||
    payload?.scoreResult ||
    payload?.score ||
    payload?.summaryData?.result;

  if (existingResult?.parentMetrics || existingResult?.clinicianMetrics) {
    return normalizeResult(existingResult);
  }

  try {
    return normalizeResult(
      calculateLBScore(Array.isArray(trialLogs) ? trialLogs : [], {
        mode: payload?.config?.mode || payload?.mode || "test",
        difficulty:
          payload?.config?.difficulty || payload?.difficulty || "normal",
        childAge: payload?.childAge || payload?.profile?.childAge || null,
      })
    );
  } catch (error) {
    console.warn("LB 分數計算失敗，已使用安全預設結果：", error);
    return normalizeResult({});
  }
}

function getRuleKey(log) {
  return (
    log?.ruleType ||
    log?.rule ||
    log?.targetRule ||
    log?.activeRule ||
    log?.condition ||
    "unknown"
  );
}

function getRuleLabel(value) {
  if (!value) return "-";
  return RULE_LABELS[value] || value;
}

function getStageLabel(value) {
  if (!value) return "-";
  return STAGE_LABELS[value] || value;
}

function getWrongTypeLabel(value) {
  if (!value) return "-";
  return WRONG_TYPE_LABELS[value] || value;
}

function formatTrialResult(log) {
  if (
    log?.isTimeout ||
    log?.timeout ||
    log?.result === "timeout" ||
    log?.status === "timeout"
  ) {
    return "逾時";
  }

  if (
    log?.isCorrect ||
    log?.correct ||
    log?.result === "correct" ||
    log?.status === "correct"
  ) {
    return "正確";
  }

  return "錯誤";
}

function normalizeRuleBreakdown(ruleBreakdown) {
  if (!ruleBreakdown) return [];

  if (Array.isArray(ruleBreakdown)) {
    return ruleBreakdown.map((item) => ({
      rule: item.rule || item.ruleType || item.label || "unknown",
      total: safeNumber(item.total, 0),
      correct: safeNumber(item.correct, 0),
      wrong: safeNumber(item.wrong, 0),
      timeout: safeNumber(item.timeout, 0),
      accuracy: safeNumber(item.accuracy, 0),
      avgReactionTime: safeNumber(item.avgReactionTime, 0),
    }));
  }

  return Object.entries(ruleBreakdown).map(([rule, item]) => ({
    rule,
    total: safeNumber(item?.total, 0),
    correct: safeNumber(item?.correct, 0),
    wrong: safeNumber(item?.wrong, 0),
    timeout: safeNumber(item?.timeout, 0),
    accuracy: safeNumber(item?.accuracy, 0),
    avgReactionTime: safeNumber(item?.avgReactionTime, 0),
  }));
}

function getParentSuggestion(result, clinician) {
  const stars = safeNumber(result?.stars, 1);
  const accuracy = safeNumber(clinician?.accuracy, 0);
  const switchAccuracy = safeNumber(clinician?.switchAccuracy, 0);
  const avgReactionTime = safeNumber(clinician?.avgReactionTime, 0);
  const interferenceRate = safeNumber(clinician?.interferenceRate, 0);

  if (stars >= 3) {
    return "孩子能穩定理解線索並完成規則切換，可進一步增加混合線索或干擾氣球練習。";
  }

  if (accuracy < 50) {
    return "建議先回到簡單訓練，讓孩子只看一個線索，例如只看顏色或只看形狀。";
  }

  if (switchAccuracy < 60) {
    return "建議加強規則切換練習，每次換規則時先口頭提醒孩子：現在要看新的線索。";
  }

  if (interferenceRate >= 40) {
    return "孩子可能容易被相似氣球干擾，建議練習「同時看顏色和形狀」的題型。";
  }

  if (avgReactionTime > 3500) {
    return "孩子可能需要較多時間確認線索，建議訓練時不要催促，先建立穩定判斷再提升速度。";
  }

  return "孩子已有基本規則理解能力，後續可透過普通模式持續練習穩定度與反應速度。";
}

function getParentSummaryCards(clinician, parentMetrics) {
  return [
    {
      label: "規則理解",
      value: parentMetrics.ruleUnderstanding || 0,
      note: `整體正確率 ${formatPercent(clinician?.accuracy)}`,
    },
    {
      label: "規則切換",
      value: parentMetrics.cognitiveFlexibility || 0,
      note: `切換題正確率 ${formatPercent(clinician?.switchAccuracy)}`,
    },
    {
      label: "反應速度",
      value: parentMetrics.processingSpeed || 0,
      note: `平均反應時間 ${formatMs(clinician?.avgReactionTime)}`,
    },
    {
      label: "作答穩定度",
      value: parentMetrics.attentionStability || 0,
      note: `RT 標準差 ${formatMs(clinician?.rtStd)}`,
    },
    {
      label: "抗干擾能力",
      value: parentMetrics.interferenceControl || 0,
      note: `干擾錯誤 ${safeNumber(clinician?.interferenceErrors, 0)} 次`,
    },
  ];
}

function getLBDetailedStars(result = {}) {
  const stars = safeNumber(result?.stars, 0);
  if (stars > 0) return clamp(stars, 1, 3);

  const finalScore = safeNumber(result?.finalScore, 0);
  if (finalScore >= 80) return 3;
  if (finalScore >= 55) return 2;
  return 1;
}

function getLBDetailedLevelInfo(payload = {}, trialLogs = []) {
  const rawLevel =
    payload?.config?.difficultyLevel ??
    payload?.difficultyLevel ??
    payload?.summaryData?.difficultyLevel ??
    payload?.analysis?.difficultyLevel ??
    payload?.result?.difficultyLevel ??
    payload?.lbResult?.difficultyLevel;
  const numericLevel = Number(rawLevel);

  const recordLevels = Array.isArray(trialLogs)
    ? trialLogs
        .map((log) =>
          Number(
            log?.difficultyLevel ??
              log?.levelIndex ??
              log?.level ??
              log?.trainingLevel
          )
        )
        .filter((level) => Number.isFinite(level) && level > 0)
    : [];

  const level = Number.isFinite(numericLevel) && numericLevel > 0
    ? Math.round(numericLevel)
    : recordLevels.length > 0
    ? Math.max(...recordLevels)
    : 3;

  const label =
    payload?.config?.difficultyLabel ||
    payload?.difficultyLabel ||
    payload?.summaryData?.difficultyLabel ||
    (level <= 1
      ? "非常簡單"
      : level === 2
      ? "簡單"
      : level === 3
      ? "普通"
      : level === 4
      ? "困難"
      : "非常困難");

  if (level >= 4) {
    return {
      level,
      group: "advanced",
      label,
      title: "進階規則切換層級",
      meaning:
        "這一層會提高規則切換與干擾控制的負荷，孩子需要在看見線索後快速判斷現在該依照哪一個規則行動。",
    };
  }

  if (level >= 3) {
    return {
      level,
      group: "middle",
      label,
      title: "穩定規則判斷層級",
      meaning:
        "這一層開始要求孩子不只看懂單一規則，也要在規則變化時保持彈性，重點是判斷品質與反應穩定度。",
    };
  }

  return {
    level,
    group: "basic",
    label,
    title: "基礎規則理解層級",
    meaning:
      "這一層主要在建立「看清楚規則，再做出對應選擇」的流程，先讓孩子熟悉分類線索與作答節奏。",
  };
}

function getLBDetailedStarInfo(stars) {
  if (stars >= 3) {
    return {
      title: "目前層級表現穩定",
      meaning:
        "孩子在目前規則負荷下能穩定理解並執行任務，可以觀察是否準備好接受更高層級或更多規則切換。",
    };
  }

  if (stars === 2) {
    return {
      title: "規則能力正在出現，但還需要穩定",
      meaning:
        "孩子已能掌握一部分規則，但遇到切換、干擾或連續作答時，表現可能會有起伏。",
    };
  }

  return {
    title: "仍需要較多支持與熟悉",
    meaning:
      "孩子目前可能還在適應規則判斷流程，建議先降低切換壓力，用短回合累積成功經驗。",
  };
}

function countLBHintTrials(trialLogs = []) {
  return (Array.isArray(trialLogs) ? trialLogs : []).filter(
    (log) =>
      log?.hintShown === true ||
      log?.hintUsed === true ||
      safeNumber(log?.hintCount, 0) > 0
  ).length;
}

function getLBDetailedProfile({ clinician = {}, parentMetrics = {}, trialLogs = [] } = {}) {
  const totalTrials = Math.max(1, safeNumber(clinician?.totalTrials, trialLogs.length));
  const accuracy = percent(clinician?.accuracy);
  const switchAccuracy = percent(clinician?.switchAccuracy);
  const interferenceControl = safeNumber(
    parentMetrics?.interferenceControl,
    percent(clinician?.interferenceAccuracy ?? clinician?.interferenceRate)
  );
  const timeoutRate =
    (safeNumber(clinician?.timeoutTrials, 0) / totalTrials) * 100;
  const wrongRate =
    (safeNumber(clinician?.wrongTrials, 0) / totalTrials) * 100;
  const hintTrials = countLBHintTrials(trialLogs);
  const hintRate = (hintTrials / totalTrials) * 100;
  const avgReactionTime = safeNumber(clinician?.avgReactionTime, 0);
  const rtStd = safeNumber(clinician?.rtStd, 0);
  const maxConsecutiveErrors = safeNumber(clinician?.maxConsecutiveErrors, 0);
  const interferenceErrors = safeNumber(clinician?.interferenceErrors, 0);

  if (totalTrials <= 1 && safeNumber(clinician?.totalTrials, 0) <= 0) {
    return {
      key: "no_data",
      badge: "資料",
      tone: "normal",
      title: "這次還沒有足夠練習資料",
      meaning: "目前題數不足，還不適合判斷規則理解或切換能力。",
      observation: "建議再完成一次完整練習，讓結果更能代表孩子的狀態。",
      advice: "下一次先用基礎層級確認孩子理解玩法，再開始正式紀錄。",
    };
  }

  if (accuracy < 50) {
    return {
      key: "rule_understanding_low",
      badge: "規則",
      tone: "watch",
      title: "規則理解還在建立中",
      meaning:
        "孩子可能還沒穩定掌握目前要依照哪個線索分類，因此整體正確率較低。",
      observation:
        "家長可以觀察孩子是否需要先被提醒「現在看顏色」或「現在看形狀」才比較能作答。",
      advice:
        "下一次建議降低一階或維持基礎層級，先用單一規則練到穩定，再加入規則切換。",
    };
  }

  if (switchAccuracy < 60) {
    return {
      key: "switching_difficulty",
      badge: "切換",
      tone: "watch",
      title: "規則一切換時比較容易卡住",
      meaning:
        "孩子理解單一規則的能力可能已經出現，但在規則改變時，還需要時間放下前一個規則。",
      observation:
        "家長可以留意孩子是否會沿用上一題的規則，或在切換提示出現後反應變慢。",
      advice:
        "下一次建議維持目前層級，先練習少量、明確的切換題，並在切換前給一句簡短提示。",
    };
  }

  if (interferenceControl < 60 || interferenceErrors >= 3) {
    return {
      key: "interference_sensitive",
      badge: "干擾",
      tone: "watch",
      title: "遇到干擾線索時比較容易被帶走",
      meaning:
        "孩子可能知道規則，但當顏色、形狀或相似線索同時出現時，容易被不相關的線索影響。",
      observation:
        "家長可以觀察孩子是否在相似氣球或混合規則題中特別容易出錯。",
      advice:
        "下一次先維持層級，練習「先說出規則，再選答案」，幫助孩子把注意力放回正確線索。",
    };
  }

  if (maxConsecutiveErrors >= 3 || wrongRate >= 45) {
    return {
      key: "error_chain",
      badge: "連錯",
      tone: "watch",
      title: "錯誤容易連續出現",
      meaning:
        "孩子一旦出錯，可能比較難馬上修正策略，後面幾題容易被前面的錯誤影響。",
      observation:
        "家長可以觀察孩子出錯後是否變急、變慢，或需要重新確認規則才能回到任務。",
      advice:
        "下一次可以在錯誤後安排短暫停頓，讓孩子重新說一次規則，再繼續下一題。",
    };
  }

  if (timeoutRate >= 25) {
    return {
      key: "timeout_high",
      badge: "逾時",
      tone: "normal",
      title: "知道要判斷，但作答時間比較吃緊",
      meaning:
        "孩子可能正在思考規則，只是需要較多時間確認，因此出現逾時或慢半拍。",
      observation:
        "家長可以看孩子是卡在看線索、選答案，還是切換規則後需要重新整理。",
      advice:
        "下一次可維持目前層級，但先不催快，重點放在看清楚規則後穩定完成。",
    };
  }

  if (hintRate >= 40) {
    return {
      key: "hint_needed",
      badge: "提示",
      tone: "normal",
      title: "有提示時比較能穩定完成",
      meaning:
        "孩子在外部提醒後比較能接上任務，代表提示目前可以作為理解規則的橋梁。",
      observation:
        "家長可以觀察孩子需要的是開頭提示、切換提示，還是錯誤後重新提醒。",
      advice:
        "下一次先保留簡短提示，等孩子連續穩定後再慢慢減少提示。",
    };
  }

  if (avgReactionTime > 3500 || rtStd > 1800) {
    return {
      key: "slow_or_unstable",
      badge: "速度",
      tone: "normal",
      title: "反應較慢或忽快忽慢",
      meaning:
        "孩子能完成部分規則判斷，但反應速度或穩定度仍在建立，可能受題型與注意力波動影響。",
      observation:
        "家長可以觀察是否特定規則、切換題或干擾題會讓孩子明顯慢下來。",
      advice:
        "下一次建議維持層級，先把答題節奏穩定下來，再逐步提高速度要求。",
    };
  }

  return {
    key: "balanced",
    badge: "穩定",
    tone: "good",
    title: "規則理解、切換與作答穩定度較平衡",
    meaning:
      "孩子在目前層級能理解規則，也能在多數題目中維持正確作答與穩定反應。",
    observation:
      "家長可以觀察孩子是否能在沒有太多提醒下完成，且遇到規則變化時仍能跟上。",
    advice:
      "下一次可以維持同層級再確認一次；若仍穩定，就可以小幅提高層級或增加切換題比例。",
  };
}

function buildDetailedLBTrainingOverview({ result, clinician, parentMetrics, payload, trialLogs }) {
  const stars = getLBDetailedStars(result);
  const levelInfo = getLBDetailedLevelInfo(payload, trialLogs);
  const starInfo = getLBDetailedStarInfo(stars);
  const profile = getLBDetailedProfile({ clinician, parentMetrics, trialLogs });
  const totalTrials = safeNumber(clinician?.totalTrials, trialLogs.length);

  if (totalTrials <= 0) {
    return {
      title: profile.title,
      message: profile.meaning,
    };
  }

  return {
    title: `${levelInfo.title}，${stars} 星：${profile.title}`,
    message:
      `這次屬於「${levelInfo.label}」訓練。${levelInfo.meaning} ` +
      `本次完成 ${totalTrials} 題，整體正確率 ${formatPercent(clinician?.accuracy)}，切換題正確率 ${formatPercent(clinician?.switchAccuracy)}。` +
      ` ${starInfo.meaning} 主要型態是「${profile.title}」：${profile.meaning}`,
  };
}

function buildDetailedLBTrainingCards({ result, clinician, parentMetrics, payload, trialLogs }) {
  const stars = getLBDetailedStars(result);
  const levelInfo = getLBDetailedLevelInfo(payload, trialLogs);
  const starInfo = getLBDetailedStarInfo(stars);
  const profile = getLBDetailedProfile({ clinician, parentMetrics, trialLogs });
  const hintTrials = countLBHintTrials(trialLogs);
  const totalTrials = Math.max(1, safeNumber(clinician?.totalTrials, trialLogs.length));
  const hintRate = Math.round((hintTrials / totalTrials) * 100);

  return [
    {
      label: levelInfo.title,
      value: levelInfo.group === "advanced" ? 85 : levelInfo.group === "middle" ? 70 : 55,
      note: `目前層級：${levelInfo.label}`,
      meaning: levelInfo.meaning,
    },
    {
      label: starInfo.title,
      value: stars >= 3 ? 90 : stars === 2 ? 68 : 42,
      note: `${stars} 星代表本層級完成品質`,
      meaning: starInfo.meaning,
    },
    {
      label: profile.title,
      value: profile.tone === "good" ? 88 : profile.tone === "normal" ? 66 : 44,
      note: profile.observation,
      meaning: profile.meaning,
    },
    {
      label: "規則理解",
      value: parentMetrics.ruleUnderstanding || percent(clinician?.accuracy),
      note: `整體正確率 ${formatPercent(clinician?.accuracy)}`,
      meaning:
        "這裡看孩子是否能依照目前規則完成分類，是 LB 最基礎也最重要的觀察點。",
    },
    {
      label: "規則切換",
      value: parentMetrics.cognitiveFlexibility || percent(clinician?.switchAccuracy),
      note: `切換題正確率 ${formatPercent(clinician?.switchAccuracy)}`,
      meaning:
        "這裡看孩子能不能放下前一個規則，跟上新的分類方式。",
    },
    {
      label: "提示需求",
      value: clamp(100 - hintRate, 0, 100),
      note: `本次提示比例約 ${hintRate}%`,
      meaning:
        hintRate >= 40
          ? "提示比例偏高時，代表孩子仍需要外部線索協助回到規則。"
          : "提示需求不高，代表孩子多半能自己維持任務方向。",
    },
  ];
}

function buildDetailedLBTrainingSuggestion({ result, clinician, parentMetrics, payload, trialLogs }) {
  const stars = getLBDetailedStars(result);
  const levelInfo = getLBDetailedLevelInfo(payload, trialLogs);
  const profile = getLBDetailedProfile({ clinician, parentMetrics, trialLogs });
  const nextLabel =
    payload?.analysis?.nextDifficultyLabel ||
    payload?.nextDifficultyLabel ||
    payload?.summaryData?.nextDifficultyLabel ||
    "";

  if (profile.key === "balanced" && stars >= 3) {
    return `孩子在「${levelInfo.label}」表現穩定。下一次可以先維持同層級確認一次；若仍穩定，再小幅提高層級或增加規則切換題。`;
  }

  if (stars <= 1 || profile.tone === "watch") {
    return `${profile.advice} 先不要急著提高難度，讓孩子在目前或低一階層級累積成功經驗會更穩。`;
  }

  if (nextLabel) {
    return `${profile.advice} 系統下一次建議可參考「${nextLabel}」，但仍以孩子是否能穩定說出規則為優先。`;
  }

  return `${profile.advice} 建議累積 2 到 3 次同層級結果後，再判斷是否提高層級。`;
}

export default function ResultPage_LB() {
  const location = useLocation();
  const navigate = useNavigate();
  const payload = useMemo(() => {
    const routeState = safeObject(location.state, {});
    const sessionState = safeObject(readSessionResult(), {});
    const selectedPayload =
      Object.keys(routeState).length > 0 ? routeState : sessionState;

    return normalizePayload(selectedPayload);
  }, [location.state]);

  const clickAudioRef = useRef(null);

  useEffect(() => {
    if (typeof Audio === "undefined") return undefined;

    const audio = new Audio(CLICK_SOUND_SRC);
    audio.preload = "auto";
    clickAudioRef.current = audio;

    return () => {
      if (!clickAudioRef.current) return;
      clickAudioRef.current.pause();
      clickAudioRef.current.removeAttribute("src");
      clickAudioRef.current.load();
      clickAudioRef.current = null;
    };
  }, []);

  const playClickSound = () => {
    const audio = clickAudioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (error) {
      console.warn("LB 按鈕音效播放失敗：", error);
    }
  };

  const handleNavigate = (route, { clearCache = false } = {}) => {
    playClickSound();

    if (clearCache) {
      sessionStorage.removeItem(SESSION_KEY);
    }

    navigate(route);
  };

  const trialLogs = useMemo(() => getTrialLogsFromPayload(payload), [payload]);

  const result = useMemo(
    () => getResultFromPayload(payload, trialLogs),
    [payload, trialLogs]
  );

  const clinician = useMemo(
    () => result?.clinicianMetrics || {},
    [result?.clinicianMetrics]
  );
  const parentMetrics = useMemo(
    () => result?.parentMetrics || {},
    [result?.parentMetrics]
  );

  const completedTrials = safeNumber(
    payload?.completedTrials ?? payload?.summaryData?.completedTrials,
    safeNumber(clinician?.totalTrials, trialLogs.length)
  );

  const totalTrials = safeNumber(
    payload?.totalTrials ?? payload?.summaryData?.totalTrials,
    safeNumber(clinician?.totalTrials, trialLogs.length)
  );

  const rawFinishReason = payload?.reason ?? payload?.summaryData?.reason;
  const finishReason =
    FINISH_REASON_LABELS[rawFinishReason] || rawFinishReason || "測驗完成";

  const mode = payload?.config?.mode || payload?.mode || "test";
  const retryRoute = mode === "training" ? TRAINING_ROUTE : TEST_ROUTE;
  const detailedTrainingOverview = useMemo(
    () =>
      mode === "training"
        ? buildDetailedLBTrainingOverview({
            result,
            clinician,
            parentMetrics,
            payload,
            trialLogs,
          })
        : null,
    [mode, result, clinician, parentMetrics, payload, trialLogs]
  );
  const detailedTrainingCards = useMemo(
    () =>
      mode === "training"
        ? buildDetailedLBTrainingCards({
            result,
            clinician,
            parentMetrics,
            payload,
            trialLogs,
          })
        : null,
    [mode, result, clinician, parentMetrics, payload, trialLogs]
  );
  const detailedTrainingSuggestion = useMemo(
    () =>
      mode === "training"
        ? buildDetailedLBTrainingSuggestion({
            result,
            clinician,
            parentMetrics,
            payload,
            trialLogs,
          })
        : "",
    [mode, result, clinician, parentMetrics, payload, trialLogs]
  );

  const handleBackToForest = () => {
    playClickSound();

    const childId = resolveChildId(payload);
    const resultId =
      payload?.resultId ||
      payload?.sessionId ||
      payload?.completedAt ||
      payload?.timestamp ||
      `${location.key || "lb"}-${mode}-${completedTrials}-${result?.finalScore}-${result?.stars}`;

    const shouldOpenHatGame = evaluateHatReward({ childId, resultId });

    sessionStorage.removeItem(SESSION_KEY);

    if (shouldOpenHatGame) {
      const rewardSessionId = createRewardSessionId(childId);

      navigate(HAT_GAME_ROUTE, {
        replace: true,
        state: {
          childId,
          rewardSessionId,
          sessionId: rewardSessionId,
          sourceGameId: "LB",
          sourceMode: mode,
          returnRoute: MENU_ROUTE,
        },
      });
      return;
    }

    navigate(mode === "training" ? MENU_ROUTE : TEST_MAP_ROUTE);
  };

  return (
    <div style={styles.page(backgroundImg)}>
      <div style={styles.overlay}>
        <main style={styles.mainCard}>
          <header style={styles.header}>
            <p style={styles.modeTag}>{mode === "training" ? "練習結果" : "測驗結果"}</p>
            <h1 style={styles.title}>氣球小路結果</h1>
            <p style={styles.subtitle}>
              這一頁用白話方式幫家長了解：孩子有沒有看懂規則、切換規則，以及作答時是否穩定。
            </p>
          </header>

          <section style={styles.parentPanel}>
            <section style={styles.heroCard}>
              <div style={styles.heroLeft}>
                <div style={styles.characterBadge}>
                  <img width={1024} height={1024} src={sheepImg} alt="小羊" style={styles.characterImg} draggable="false" />
                </div>

                <div>
                  <p style={styles.heroEyebrow}>本次整體狀態</p>
                  <h2 style={styles.heroTitle}>
                    {detailedTrainingOverview?.title || getLBOverviewTitle(result?.stars)}
                  </h2>
                  <p style={styles.heroText}>
                    {detailedTrainingOverview?.message ||
                      result?.parentSummary ||
                      "目前資料不足，建議重新測驗一次。"}
                  </p>
                </div>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.starRow} aria-label={`${result?.stars || 0} 顆星`}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <span
                      key={index}
                      style={{
                        ...styles.star,
                        ...(index < safeNumber(result?.stars, 0)
                          ? styles.starActive
                          : styles.starEmpty),
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <p style={styles.parentScoreNote}>星星代表本次完成表現</p>
                <p style={styles.starHint}>請搭配下方觀察重點一起看，不是單一次診斷。</p>
              </div>
            </section>

            <section style={styles.quickStats}>
              <StatCard label="完成題數" value={`${completedTrials}/${totalTrials}`} helper="孩子完成了多少題" />
              <StatCard label="結束原因" value={finishReason} helper="本次任務如何結束" />
              <StatCard label="整體正確率" value={formatPercent(clinician?.accuracy)} helper="作答是否看對規則" />
              <StatCard label="平均反應" value={formatMs(clinician?.avgReactionTime)} helper="作答速度參考" />
            </section>

            <ParentView
              result={result}
              clinician={clinician}
              parentMetrics={parentMetrics}
              summaryCards={detailedTrainingCards}
              suggestion={detailedTrainingSuggestion}
            />

            <section style={styles.noteBox}>
              <h3 style={styles.noteTitle}>給家長的小提醒</h3>
              <p style={styles.noteText}>
                這份結果是本次遊戲中的觀察紀錄，可幫助了解孩子在「看線索、切換規則、穩定作答」時的狀況；不代表醫療診斷，建議搭配多次練習或其他任務一起觀察。
              </p>
            </section>
          </section>

          <footer style={styles.buttonRow}>
            <button
              type="button"
              style={styles.resultImageButton}
              onClick={handleBackToForest}
              aria-label="回到森林"
            >
              <img width={1024} height={341} loading="lazy" src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
            </button>

            {mode === "training" && (
              <button
                type="button"
                style={styles.resultImageButton}
                onClick={() => handleNavigate(retryRoute, { clearCache: true })}
                aria-label="play again"
              >
                <img width={1024} height={341} loading="lazy" src={homeAgainBtn} alt="play again" style={styles.imageButtonImg} />
              </button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

function ParentView({ result, clinician, parentMetrics, summaryCards: providedSummaryCards, suggestion }) {
  const summaryCards = Array.isArray(providedSummaryCards)
    ? providedSummaryCards
    : getParentSummaryCards(clinician, parentMetrics);

  return (
    <>
      <section style={styles.panel}>
        <div style={styles.sectionHeaderRow}>
          <div>
            <h2 style={styles.sectionTitle}>家長可以這樣看</h2>
            <p style={styles.parentIntro}>
              不需要先懂專有名詞，只要看每張卡片的「孩子在做什麼」和「代表什麼」。
            </p>
          </div>
        </div>

        <div style={styles.abilityGrid}>
          {summaryCards.map((item) => (
            <AbilityCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section style={styles.suggestionPanel}>
        <h2 style={styles.sectionTitle}>下一步建議</h2>
        <div style={styles.suggestionItem}>
          <span style={styles.suggestionIcon}>🌱</span>
          <p style={styles.suggestionText}>
            {suggestion || getParentSuggestion(result, clinician)}
          </p>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statHelper}>{helper}</p>
    </div>
  );
}

function AbilityCard({ item }) {
  const finalValue = clamp(safeNumber(item.value, 0), 0, 100);
  const tone = finalValue >= 80 ? "good" : finalValue >= 55 ? "normal" : "watch";

  return (
    <article style={styles.abilityCard}>
      <div style={styles.abilityTop}>
        <div style={styles.abilityHeading}>
          <p style={styles.abilityLabel}>{item.label}</p>
          <p style={styles.abilityQuestion}>{item.note}</p>
        </div>
      </div>

      <div style={styles.statusPill(tone)}>
        {finalValue >= 80 ? "表現穩定" : finalValue >= 55 ? "可持續觀察" : "建議加強"}
      </div>

      <p style={styles.abilityDescription}>目前指標約 {Math.round(finalValue)}%。</p>
      <p style={styles.abilityMeaning}>
        {item.meaning || getAbilityMeaning(item.label, finalValue)}
      </p>
    </article>
  );
}

function getAbilityMeaning(label, value) {
  if (value >= 80) return `${label}目前很穩定，可以逐步增加混合線索或更高難度。`;
  if (value >= 55) return `${label}已有基礎，建議用短時間、多次練習維持穩定度。`;
  return `${label}需要更多圖像化提示，先從簡單規則開始練習。`;
}

function getLBOverviewTitle(stars) {
  const finalStars = safeNumber(stars, 0);
  if (finalStars >= 3) return "小羊順利找到氣球路線！";
  if (finalStars >= 2) return "已經能掌握部分線索";
  return "可以先從簡單線索慢慢練習";
}

// eslint-disable-next-line no-unused-vars
function ClinicalView({ clinician, trialLogs, result }) {
  const normalizedLogs = Array.isArray(clinician?.trialLogs)
    ? clinician.trialLogs
    : trialLogs;

  const ruleRows = normalizeRuleBreakdown(clinician?.ruleBreakdown);

  return (
    <section className="lb-result-clinical-layout">
      <div className="lb-result-card-section">
        <h2>核心指標</h2>

        <div className="lb-result-kpi-grid">
          <Kpi label="總題數" value={safeNumber(clinician?.totalTrials, 0)} />
          <Kpi label="正確題數" value={safeNumber(clinician?.correctTrials, 0)} />
          <Kpi label="錯誤題數" value={safeNumber(clinician?.wrongTrials, 0)} />
          <Kpi label="Timeout" value={safeNumber(clinician?.timeoutTrials, 0)} />
          <Kpi label="正確率" value={formatPercent(clinician?.accuracy)} />
          <Kpi label="切換正確率" value={formatPercent(clinician?.switchAccuracy)} />
          <Kpi label="平均 RT" value={formatMs(clinician?.avgReactionTime)} />
          <Kpi label="RT 標準差" value={formatMs(clinician?.rtStd)} />
          <Kpi
            label="最長連錯"
            value={`${safeNumber(clinician?.maxConsecutiveErrors, 0)} 題`}
          />
          <Kpi
            label="干擾錯誤"
            value={`${safeNumber(clinician?.interferenceErrors, 0)} 次`}
          />
          <Kpi label="干擾率" value={formatPercent(clinician?.interferenceRate)} />
          <Kpi label="綜合分數" value={`${safeNumber(result?.finalScore, 0)} / 100`} />
        </div>

        <div className="lb-result-note-box">
          <p>
            <strong>任務解讀：</strong>
            LB 主要觀察幼兒是否能依據線索完成規則理解、規則切換、舊規則抑制與穩定作答。
          </p>
          <p>
            <strong>提醒：</strong>
            星級不只看速度，主要依據正確率、切換題表現與整體穩定度。
          </p>
        </div>
      </div>

      <div className="lb-result-card-section">
        <h2>分規則表現</h2>

        {ruleRows.length === 0 ? (
          <p className="lb-result-empty-text">目前沒有分規則資料。</p>
        ) : (
          <div className="lb-result-table-wrap">
            <table className="lb-result-table">
              <thead>
                <tr>
                  <th>規則</th>
                  <th>題數</th>
                  <th>正確</th>
                  <th>錯誤</th>
                  <th>Timeout</th>
                  <th>正確率</th>
                  <th>平均 RT</th>
                </tr>
              </thead>

              <tbody>
                {ruleRows.map((item) => (
                  <tr key={item.rule}>
                    <td>{getRuleLabel(item.rule)}</td>
                    <td>{item.total}</td>
                    <td>{item.correct}</td>
                    <td>{item.wrong}</td>
                    <td>{item.timeout}</td>
                    <td>{formatPercent(item.accuracy)}</td>
                    <td>{formatMs(item.avgReactionTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="lb-result-card-section lb-result-full-section">
        <h2>Trial-level 紀錄</h2>

        {normalizedLogs.length === 0 ? (
          <p className="lb-result-empty-text">
            目前沒有收到逐題資料。請確認 TestPage_LB.jsx 結束時有把 logs 或 trialLogs
            存入 location.state 或 sessionStorage 的 LB_RESULT。
          </p>
        ) : (
          <div className="lb-result-table-wrap">
            <table className="lb-result-table">
              <thead>
                <tr>
                  <th>題次</th>
                  <th>階段</th>
                  <th>規則</th>
                  <th>是否切換</th>
                  <th>結果</th>
                  <th>反應時間</th>
                  <th>錯誤類型</th>
                </tr>
              </thead>

              <tbody>
                {normalizedLogs.map((log, index) => (
                  <tr key={`${log.trialId || index}-${getRuleKey(log)}`}>
                    <td>{log.trialNumber || index + 1}</td>
                    <td>{getStageLabel(log.stage)}</td>
                    <td>{getRuleLabel(getRuleKey(log))}</td>
                    <td>{log.isRuleSwitch || log.isSwitch || log.switchTrial ? "是" : "否"}</td>
                    <td>{formatTrialResult(log)}</td>
                    <td>{formatMs(log.reactionTime || log.rt || log.responseTime)}</td>
                    <td>{getWrongTypeLabel(log.wrongType || log.errorType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// eslint-disable-next-line no-unused-vars
function MetaPill({ label, value }) {
  return (
    <div className="lb-result-meta-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="lb-result-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function AbilityBar({ label, value, note }) {
  const finalValue = clamp(safeNumber(value, 0), 0, 100);

  return (
    <div className="lb-result-ability-block">
      <div className="lb-result-ability-top">
        <span>{label}</span>
        <strong>{Math.round(finalValue)}%</strong>
      </div>

      <div className="lb-result-ability-track">
        <div
          className="lb-result-ability-fill"
          style={{ width: `${finalValue}%` }}
        />
      </div>

      {note && <p>{note}</p>}
    </div>
  );
}

const toneStyles = {
  good: {
    borderColor: "#8fcf8f",
    backgroundColor: "#f0fff0",
    color: "#3f7c3f",
  },
  normal: {
    borderColor: "#f4c27a",
    backgroundColor: "#fff8ed",
    color: "#9a6324",
  },
  watch: {
    borderColor: "#f2a6a6",
    backgroundColor: "#fff0f0",
    color: "#a84d4d",
  },
};

const styles = {
  page: (bgImage) => ({
    height: "100dvh",
    width: "100%",
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    overflow: "hidden",
  }),

  overlay: {
    height: "100dvh",
    width: "100%",
    background: "rgba(255,255,255,0.22)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  mainCard: {
    width: "min(1040px, 96vw)",
    maxHeight: "calc(100dvh - 40px)",
    backgroundColor: "rgba(255, 248, 235, 0.97)",
    borderRadius: "34px",
    padding: "24px 34px 26px",
    boxShadow: "0 16px 36px rgba(0,0,0,0.14)",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    textAlign: "center",
    marginBottom: "14px",
    flexShrink: 0,
  },

  modeTag: {
    display: "inline-block",
    backgroundColor: "#fff3e8",
    color: "#a75f28",
    border: "2px solid #f4a261",
    borderRadius: "999px",
    padding: "6px 16px",
    fontSize: "16px",
    fontWeight: "900",
    margin: "0 0 8px",
  },

  title: {
    fontSize: "38px",
    fontWeight: "900",
    color: "#5c4033",
    textShadow: "2px 2px 0 #ffffff",
    margin: "0 0 6px",
  },

  subtitle: {
    maxWidth: "760px",
    margin: "0 auto",
    fontSize: "18px",
    color: "#7a4f2b",
    fontWeight: "800",
    lineHeight: 1.55,
  },

  parentPanel: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "6px",
    marginBottom: "18px",
  },

  heroCard: {
    backgroundColor: "#fff3e8",
    borderRadius: "28px",
    padding: "20px 24px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: "20px",
    marginBottom: "16px",
  },

  heroLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    textAlign: "left",
    flex: 1,
  },

  characterBadge: {
    width: "92px",
    height: "92px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.1)",
    flexShrink: 0,
    overflow: "hidden",
  },

  characterImg: {
    width: "92%",
    height: "92%",
    objectFit: "contain",
  },

  heroEyebrow: {
    color: "#a75f28",
    fontSize: "16px",
    fontWeight: "900",
    margin: "0 0 5px",
  },

  heroTitle: {
    fontSize: "28px",
    fontWeight: "900",
    color: "#5c4033",
    margin: "0 0 8px",
  },

  heroText: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#7a4f2b",
    margin: 0,
    lineHeight: 1.65,
  },

  heroRight: {
    width: "220px",
    textAlign: "center",
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    padding: "16px 14px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    flexShrink: 0,
  },

  starRow: {
    display: "flex",
    justifyContent: "center",
    gap: "6px",
    marginBottom: "8px",
  },

  star: {
    fontSize: "46px",
    lineHeight: 1,
  },

  starActive: {
    color: "#f6c945",
    textShadow: "0 4px 8px rgba(0,0,0,0.18)",
  },

  starEmpty: {
    color: "#e6d8c8",
  },

  parentScoreNote: {
    fontSize: "17px",
    color: "#5c4033",
    fontWeight: "900",
    margin: "0 0 6px",
  },

  starHint: {
    fontSize: "13px",
    color: "#8b5e3c",
    fontWeight: "800",
    lineHeight: 1.45,
    margin: 0,
  },

  quickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    padding: "14px 12px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.07)",
  },

  statLabel: {
    fontSize: "15px",
    color: "#8b5e3c",
    fontWeight: "900",
    margin: "0 0 5px",
  },

  statValue: {
    fontSize: "25px",
    color: "#5c4033",
    fontWeight: "900",
    margin: "0 0 4px",
  },

  statHelper: {
    fontSize: "12px",
    color: "#8b5e3c",
    fontWeight: "750",
    lineHeight: 1.35,
    margin: 0,
  },

  panel: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: "28px",
    padding: "24px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
    marginBottom: "16px",
  },

  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },

  sectionTitle: {
    fontSize: "26px",
    fontWeight: "900",
    color: "#5c4033",
    margin: "0 0 10px",
  },

  parentIntro: {
    fontSize: "17px",
    lineHeight: 1.7,
    color: "#4d3b2f",
    fontWeight: "800",
    margin: "0 0 18px",
  },

  abilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  abilityCard: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    padding: "16px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.07)",
  },

  abilityTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },

  abilityHeading: {
    flex: 1,
  },

  abilityLabel: {
    fontSize: "19px",
    color: "#5c4033",
    fontWeight: "900",
    margin: "0 0 3px",
  },

  abilityQuestion: {
    fontSize: "14px",
    color: "#8b5e3c",
    fontWeight: "800",
    margin: 0,
    lineHeight: 1.4,
  },

  statusPill: (tone) => ({
    display: "inline-block",
    borderRadius: "999px",
    border: `2px solid ${toneStyles[tone]?.borderColor || toneStyles.normal.borderColor}`,
    backgroundColor: toneStyles[tone]?.backgroundColor || toneStyles.normal.backgroundColor,
    color: toneStyles[tone]?.color || toneStyles.normal.color,
    padding: "5px 12px",
    fontSize: "15px",
    fontWeight: "900",
    marginBottom: "10px",
  }),

  abilityDescription: {
    fontSize: "16px",
    color: "#4d3b2f",
    fontWeight: "850",
    lineHeight: 1.6,
    margin: "0 0 7px",
  },

  abilityMeaning: {
    fontSize: "15px",
    color: "#6e5140",
    fontWeight: "700",
    lineHeight: 1.6,
    margin: 0,
  },

  suggestionPanel: {
    backgroundColor: "#fff3e8",
    borderRadius: "28px",
    padding: "22px 24px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
    marginBottom: "16px",
  },

  suggestionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    padding: "12px 14px",
  },

  suggestionIcon: {
    fontSize: "22px",
    lineHeight: 1.3,
    flexShrink: 0,
  },

  suggestionText: {
    fontSize: "16px",
    color: "#4d3b2f",
    fontWeight: "800",
    lineHeight: 1.6,
    margin: 0,
  },

  noteBox: {
    backgroundColor: "#fff8ed",
    borderRadius: "22px",
    padding: "18px",
    border: "2px solid #f1d4b2",
  },

  noteTitle: {
    fontSize: "21px",
    color: "#5c4033",
    fontWeight: "900",
    margin: "0 0 10px",
  },

  noteText: {
    fontSize: "16px",
    color: "#4d3b2f",
    fontWeight: "750",
    lineHeight: 1.75,
    margin: 0,
  },

  buttonRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    flexShrink: 0,
  },

  resultImageButton: {
    position: "relative",
    zIndex: 2,
    width: "clamp(168px, 16vw, 232px)",
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: "none",
    outline: "none",
    borderRadius: "18px",
    background: "transparent",
    boxShadow: "none",
    lineHeight: 0,
    cursor: "pointer",
    overflow: "visible",
    transition: "transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease",
    touchAction: "manipulation",
  },

  imageButtonImg: {
    width: "100%",
    height: "auto",
    display: "block",
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserDrag: "none",
    filter: "drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22))",
  },
};

// eslint-disable-next-line no-unused-vars
function RadarChart({ data }) {
  const size = 310;
  const center = size / 2;
  const maxRadius = 98;
  const levels = [0.25, 0.5, 0.75, 1];

  const safeData =
    Array.isArray(data) && data.length > 0
      ? data.map((item, index) => ({
          label: item?.label || `能力 ${index + 1}`,
          value: clamp(safeNumber(item?.value, 0), 0, 100),
        }))
      : [
          { label: "規則理解", value: 0 },
          { label: "規則切換", value: 0 },
          { label: "反應速度", value: 0 },
          { label: "穩定度", value: 0 },
          { label: "抗干擾", value: 0 },
        ];

  const getAngle = (index) =>
    -Math.PI / 2 + (index * 2 * Math.PI) / safeData.length;

  const getPoint = (radius, angle) => ({
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  });

  const points = safeData.map((item, index) => {
    const angle = getAngle(index);
    const radius = (maxRadius * item.value) / 100;
    const valuePoint = getPoint(radius, angle);
    const axisPoint = getPoint(maxRadius, angle);
    const labelPoint = getPoint(maxRadius + 40, angle);

    return {
      x: safeNumber(valuePoint.x, center),
      y: safeNumber(valuePoint.y, center),
      axisX: safeNumber(axisPoint.x, center),
      axisY: safeNumber(axisPoint.y, center),
      labelX: safeNumber(labelPoint.x, center),
      labelY: safeNumber(labelPoint.y, center),
      label: item.label,
    };
  });

  const polygonPoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="lb-result-radar-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="LB 能力雷達圖"
      >
        {levels.map((level) => {
          const levelPoints = safeData
            .map((_, index) => {
              const angle = getAngle(index);
              const radius = maxRadius * level;
              const point = getPoint(radius, angle);

              return `${safeNumber(point.x, center)},${safeNumber(
                point.y,
                center
              )}`;
            })
            .join(" ");

          return (
            <polygon
              key={level}
              points={levelPoints}
              fill="none"
              stroke="rgba(93, 64, 55, 0.22)"
              strokeWidth="1.2"
            />
          );
        })}

        {points.map((point) => (
          <line
            key={point.label}
            x1={center}
            y1={center}
            x2={point.axisX}
            y2={point.axisY}
            stroke="rgba(93, 64, 55, 0.22)"
            strokeWidth="1"
          />
        ))}

        <polygon
          points={polygonPoints}
          fill="rgba(255, 184, 77, 0.38)"
          stroke="#f59e0b"
          strokeWidth="3"
        />

        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#f59e0b" />
            <text
              x={point.labelX}
              y={point.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="900"
              fill="#5d4037"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
