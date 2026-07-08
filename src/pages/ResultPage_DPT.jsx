// src/pages/ResultPage_DPT.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { calculateDptScore, getStoredDptResult } from "../utils/dptScoring";

/* ========= 圖片素材 ========= */
import backgroundImg from "../asset/DPT_testbackground.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";

/* ========= 路由 ========= */
const MENU_ROUTE = "/game-menu";
const TEST_MAP_ROUTE = "/test-map";
const TRAINING_ROUTE = "/training-dpt";
const HAT_GAME_ROUTE = "/hat-sticker-game";

/* ========= 帽子遊戲排程 =========
 * 只有 training 結果會進入排程。
 * TestPage_DPT / test 結果不會累計，也不會觸發帽子遊戲。
 */
const HAT_MIN_INTERVAL = 5;
const HAT_MAX_INTERVAL = 8;

/* ========= 小工具 ========= */

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function resolveChildId(result) {
  const directChildId =
    result?.childId ||
    result?.child?.id ||
    result?.currentChild?.id;

  if (directChildId) return String(directChildId);

  for (const key of ["currentChildId", "selectedChildId", "activeChildId", "childId"]) {
    const value = localStorage.getItem(key);
    if (value && value !== "null" && value !== "undefined") return String(value);
  }

  for (const key of ["currentChild", "selectedChild", "activeChild"]) {
    const parsed = safeJsonParse(localStorage.getItem(key));
    if (parsed?.id) return String(parsed.id);
  }

  return "guest";
}

function createHatTarget() {
  return (
    HAT_MIN_INTERVAL +
    Math.floor(Math.random() * (HAT_MAX_INTERVAL - HAT_MIN_INTERVAL + 1))
  );
}

function getDptResultSessionId(result) {
  return String(
    result?.sessionId ||
    result?.resultId ||
    result?.finishedAt ||
    result?.generatedAt ||
    result?.completedAt ||
    ""
  );
}

/**
 * 登記一次 DPT 訓練完成紀錄，並回傳這次是否取得帽子遊戲資格。
 * 同一份結果即使重新整理，也不會重複累計。
 */
function registerDptHatReward(result) {
  if (!result || result.mode !== "training") return null;

  const childId = resolveChildId(result);
  const resultSessionId = getDptResultSessionId(result);
  if (!resultSessionId) return null;

  const scheduleKey = `hatRewardSchedule_${childId}`;
  const processedKey = `hatRewardProcessed_DPT_${childId}`;
  const processed = safeJsonParse(localStorage.getItem(processedKey), []);
  const processedIds = Array.isArray(processed) ? processed : [];

  // 已處理過的結果：若先前已排定帽子遊戲，仍回傳該場次，避免重新整理後消失。
  if (processedIds.includes(resultSessionId)) {
    const pending = safeJsonParse(
      sessionStorage.getItem(`pendingHatReward_DPT_${childId}`),
      null
    );
    return pending?.resultSessionId === resultSessionId ? pending : null;
  }

  const previous = safeJsonParse(localStorage.getItem(scheduleKey), {});
  const completedCount = Math.max(0, Number(previous?.completedCount) || 0) + 1;
  const target = Math.max(
    HAT_MIN_INTERVAL,
    Math.min(HAT_MAX_INTERVAL, Number(previous?.target) || createHatTarget())
  );

  const nextProcessed = [...processedIds.slice(-49), resultSessionId];
  localStorage.setItem(processedKey, JSON.stringify(nextProcessed));

  if (completedCount < target) {
    localStorage.setItem(
      scheduleKey,
      JSON.stringify({ completedCount, target, updatedAt: new Date().toISOString() })
    );
    return null;
  }

  const rewardSessionId = `DPT-${childId}-${resultSessionId}`;
  const reward = {
    childId,
    gameId: "DPT",
    sourceMode: "training",
    resultSessionId,
    rewardSessionId,
  };

  // 觸發後重新抽下一個 5～8 次的間隔。
  localStorage.setItem(
    scheduleKey,
    JSON.stringify({
      completedCount: 0,
      target: createHatTarget(),
      updatedAt: new Date().toISOString(),
    })
  );
  sessionStorage.setItem(`pendingHatReward_DPT_${childId}`, JSON.stringify(reward));
  return reward;
}

function safeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value, min = 0, max = 100, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(Math.max(numericValue, min), max);
}

function formatMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "--";
  return `${(value / 1000).toFixed(2)} 秒`;
}

function readSavedResult() {
  try {
    return getStoredDptResult();
  } catch (error) {
    console.error("讀取 DPT 結果失敗：", error);
    return null;
  }
}

function getScoring(rawResult) {
  if (rawResult?.scoring && typeof rawResult.scoring === "object") {
    return rawResult.scoring;
  }

  if (!Array.isArray(rawResult?.records)) return null;

  return calculateDptScore(rawResult.records, {
    mode: rawResult.mode,
    difficulty: rawResult.difficulty || rawResult.difficultyKey,
    plannedTotalRounds:
      rawResult.expectedTrials ||
      rawResult.totalTrials ||
      rawResult.records.length,
  });
}

function normalizeResult(rawResult) {
  const source = rawResult || {};
  const scoring = getScoring(source);
  const summary = scoring?.summary || source.summary || {};
  const aiAnalysis = source.aiAnalysis || source.dptAnalysis || {};

  return {
    ...source,
    scoring,
    summary,
    aiAnalysis,
    mode: source.mode || scoring?.mode || "test",
    difficulty: source.difficulty || source.difficultyKey || scoring?.difficulty || "normal",
    totalTrials: safeNumber(summary.totalTrials ?? source.totalTrials, 0),
    correctCount: safeNumber(summary.correctCount ?? source.correctCount, 0),
    wrongCount: safeNumber(summary.wrongCount ?? source.wrongCount, 0),
    timeoutCount: safeNumber(summary.timeoutCount ?? source.timeoutCount, 0),
    anticipationCount: safeNumber(summary.anticipationCount ?? source.anticipationCount, 0),
    sameAnimalErrorCount: safeNumber(summary.sameAnimalErrorCount ?? source.sameAnimalErrorCount, 0),
    accuracyPercent: safeNumber(summary.accuracyPercent ?? source.accuracyPercent ?? source.accuracy, 0),
    avgReactionTime: summary.avgReactionTime ?? source.avgReactionTime ?? aiAnalysis.avgReactionTime ?? null,
    representativeReactionTime:
      summary.representativeReactionTime ??
      source.representativeReactionTime ??
      aiAnalysis.representativeReactionTime ??
      null,
    timeoutRate: safeNumber(summary.timeoutRate ?? source.timeoutRate ?? aiAnalysis.timeoutRate, 0),
    anticipationRate: safeNumber(summary.anticipationRate ?? source.anticipationRate ?? aiAnalysis.anticipationRate, 0),
    sameAnimalErrorRate: safeNumber(
      summary.sameAnimalErrorRate ?? source.sameAnimalErrorRate ?? aiAnalysis.sameAnimalErrorRate,
      0
    ),
    catSoundAccuracy: safeNumber(summary.catSoundAccuracy ?? aiAnalysis.catSoundAccuracy, 0),
    dogSoundAccuracy: safeNumber(summary.dogSoundAccuracy ?? aiAnalysis.dogSoundAccuracy, 0),
    hasReliableSoundComparison: Boolean(
      summary.hasReliableSoundComparison ?? aiAnalysis.hasReliableSoundComparison
    ),
    attentionDrop: summary.attentionDrop ?? aiAnalysis.attentionDrop ?? null,
    hasReliableHalfComparison: Boolean(
      summary.hasReliableHalfComparison ?? aiAnalysis.hasReliableHalfComparison
    ),
    recommendedDifficulty:
      source.recommendedDifficulty ?? aiAnalysis.recommendedDifficulty ?? source.difficulty ?? "normal",
    recommendedHintLevel:
      source.recommendedHintLevel ?? aiAnalysis.recommendedHintLevel ?? "neutral",
    parentSummary:
      source.parentSummary ??
      scoring?.parentView?.plainLanguageSummary ??
      aiAnalysis.parentSummary ??
      "",
    suggestedAction:
      source.suggestedAction ??
      aiAnalysis.suggestedAction ??
      "建議持續練習「貓叫選狗、狗叫選貓」的相反規則。",
  };
}

function getResultModeText(mode) {
  return mode === "training" ? "練習結果" : "測驗結果";
}

function getDisplayScore(result) {
  return Math.round(
    safeNumber(result?.scoring?.totalScore ?? result?.totalScore ?? result?.score, 0)
  );
}

function getStars(result, displayScore) {
  const stars = result?.scoring?.stars ?? result?.stars;
  if (Number.isFinite(Number(stars))) return clamp(Number(stars), 0, 3, 0);
  if (displayScore >= 80) return 3;
  if (displayScore >= 60) return 2;
  return displayScore > 0 ? 1 : 0;
}

function getChildShortLabel(result, displayScore) {
  return (
    result?.scoring?.childView?.shortLabel ||
    (displayScore >= 80 ? "表現很棒" : displayScore >= 60 ? "表現不錯" : "繼續加油")
  );
}

function getDetailedDptStars(result = {}, displayScore = 0) {
  const stars = result?.scoring?.stars ?? result?.stars;
  if (Number.isFinite(Number(stars))) return clamp(Number(stars), 1, 3, 1);
  if (displayScore >= 80) return 3;
  if (displayScore >= 60) return 2;
  return 1;
}

function getDetailedDptLevelInfo(result = {}) {
  const rawDifficulty = String(
    result?.difficulty ||
      result?.difficultyKey ||
      result?.summary?.difficulty ||
      result?.aiAnalysis?.difficulty ||
      "normal"
  ).toLowerCase();
  const label =
    result?.difficultyLabel ||
    result?.aiAnalysis?.difficultyLabel ||
    result?.scoring?.difficultyLabel ||
    (rawDifficulty.includes("hard")
      ? "困難"
      : rawDifficulty.includes("easy")
      ? "簡單"
      : "普通");

  if (rawDifficulty.includes("hard")) {
    return {
      group: "hard",
      label,
      title: "進階等待與抑制層級",
      meaning:
        "這一層會提高等待、聽聲音判斷與抑制直覺反應的負荷，孩子需要先聽清楚，再選相反的動物。",
    };
  }

  if (rawDifficulty.includes("easy")) {
    return {
      group: "easy",
      label,
      title: "基礎聲音規則層級",
      meaning:
        "這一層主要建立「先聽聲音，再選相反動物」的基本流程，重點是理解規則與願意等待。",
    };
  }

  return {
    group: "normal",
    label,
    title: "穩定聲音規則層級",
    meaning:
      "這一層開始要求孩子在等待聲音、抑制直覺與維持反應速度之間取得平衡。",
  };
}

function getDetailedDptStarInfo(stars) {
  if (stars >= 3) {
    return {
      title: "目前層級表現穩定",
      meaning:
        "孩子在這個層級已能穩定等待聲音、理解相反規則並完成反應，可以觀察是否準備好接受更高挑戰。",
    };
  }

  if (stars === 2) {
    return {
      title: "能力正在出現，但還需要穩定",
      meaning:
        "孩子已能完成一部分任務，但遇到等待時間、聲音差異或直覺反應時，表現可能會有起伏。",
    };
  }

  return {
    title: "仍需要較多支持與熟悉",
    meaning:
      "孩子目前可能還在適應先等待、再依聲音做相反選擇的流程，建議先降低速度壓力。",
  };
}

function getDetailedDptProfile(result = {}) {
  const totalTrials = safeNumber(result.totalTrials, 0);
  const accuracy = safeNumber(result.accuracyPercent, 0);
  const timeoutRate = safeNumber(result.timeoutRate, 0);
  const anticipationRate = safeNumber(result.anticipationRate, 0);
  const sameAnimalErrorRate = safeNumber(result.sameAnimalErrorRate, 0);
  const attentionDrop = Number.isFinite(Number(result.attentionDrop))
    ? Number(result.attentionDrop)
    : null;
  const rt = safeNumber(result.representativeReactionTime || result.avgReactionTime, 0);
  const soundDifference = Math.abs(
    safeNumber(result.catSoundAccuracy, 0) - safeNumber(result.dogSoundAccuracy, 0)
  );
  const validRtCount = safeNumber(result.summary?.validRtCount, 0);
  const rtStd = safeNumber(result.summary?.rtStd ?? result.summary?.reactionTimeStd, 0);
  const attentionProfile = result.aiAnalysis?.attentionProfile;

  if (totalTrials <= 0) {
    return {
      key: "no_data",
      badge: "資料",
      tone: "neutral",
      title: "這次還沒有足夠練習資料",
      meaning: "目前題數不足，還不適合判斷等待、抑制或聲音規則表現。",
      observation: "建議再完成一次完整練習，讓結果更能代表孩子的狀態。",
      advice: "下一次先用簡單層級確認孩子理解玩法，再開始正式紀錄。",
    };
  }

  if (anticipationRate >= 20 || result.anticipationCount >= 3 || attentionProfile === "impulsive") {
    return {
      key: "impulsive",
      badge: "太快",
      tone: "alert",
      title: "反應意願高，但容易太早按",
      meaning:
        "孩子很想趕快完成任務，但有時會在聲音或規則確認前就先反應，抑制等待仍需要練習。",
      observation:
        "家長可以觀察孩子是否一看到畫面就想按，或還沒聽清楚聲音就已經出手。",
      advice:
        "下一次先維持或降低一階，練習聽到聲音後停一下再選，重點放在等待，不是更快。",
    };
  }

  if (sameAnimalErrorRate >= 25 || result.sameAnimalErrorCount >= 3) {
    return {
      key: "rule_inhibition",
      badge: "規則",
      tone: "watch",
      title: "相反規則容易被直覺答案影響",
      meaning:
        "孩子可能聽懂聲音，但在選答案時容易選到和聲音相同的動物，代表相反規則還需要更穩。",
      observation:
        "家長可以觀察孩子是否會自然選聲音對應的動物，而不是題目要求的相反動物。",
      advice:
        "下一次可以先口頭提醒「聽到貓，要找狗；聽到狗，要找貓」，再逐漸減少提示。",
    };
  }

  if (timeoutRate >= 30 || (rt > 0 && rt >= 2200 && accuracy < 70)) {
    return {
      key: "slow_start",
      badge: "較慢",
      tone: "watch",
      title: "知道要判斷，但啟動反應比較慢",
      meaning:
        "孩子可能正在思考聲音和相反規則，只是需要較多時間把規則轉成動作。",
      observation:
        "家長可以留意孩子是卡在聽聲音、想相反答案，還是找到答案後才慢慢點選。",
      advice:
        "下一次先不催快，維持目前層級練習穩定完成，再逐步縮短反應時間。",
    };
  }

  if (accuracy < 55) {
    return {
      key: "rule_understanding",
      badge: "理解",
      tone: "watch",
      title: "聲音規則理解仍在建立",
      meaning:
        "整體正確率偏低時，孩子可能還沒有穩定掌握聲音和相反選擇之間的關係。",
      observation:
        "家長可以觀察孩子是否需要示範或提示後，才知道要選哪一邊。",
      advice:
        "下一次建議使用簡單層級，先用慢速示範建立規則，再進入正式練習。",
    };
  }

  if (
    result.hasReliableHalfComparison &&
    attentionDrop !== null &&
    attentionDrop >= 25
  ) {
    return {
      key: "fatigue",
      badge: "後段",
      tone: "watch",
      title: "前段能投入，後段注意力較容易下滑",
      meaning:
        "孩子一開始能跟上任務，但練習拉長後，正確率或反應品質可能下降。",
      observation:
        "家長可以看孩子是否越到後面越慢、越容易按錯，或需要更多提醒。",
      advice:
        "下一次可以縮短回合，中間安排明確休息，再逐步拉長練習時間。",
    };
  }

  if (result.hasReliableSoundComparison && soundDifference >= 30) {
    return {
      key: "sound_asymmetry",
      badge: "聲音",
      tone: "normal",
      title: "不同聲音規則表現不平均",
      meaning:
        "孩子對其中一種聲音比較穩，另一種聲音比較容易混淆，可能需要針對弱的一側多練習。",
      observation:
        "家長可以觀察孩子是聽到貓聲比較穩，還是聽到狗聲比較穩。",
      advice:
        "下一次可以針對較不穩的聲音多做幾題，並搭配簡短口訣協助轉換。",
    };
  }

  if ((validRtCount >= 3 && rtStd >= 700) || attentionProfile === "unstable") {
    return {
      key: "unstable",
      badge: "起伏",
      tone: "normal",
      title: "反應忽快忽慢，穩定度仍在建立",
      meaning:
        "孩子有時能很快完成，有時會突然慢下來，代表能力已出現，但還需要穩定維持。",
      observation:
        "家長可以觀察是否特定聲音、等待時間或情緒興奮程度讓反應起伏變大。",
      advice:
        "下一次先維持目前層級，練習固定節奏：聽聲音、停一下、再選答案。",
    };
  }

  if (accuracy >= 82 && timeoutRate <= 12 && sameAnimalErrorRate <= 12 && anticipationRate <= 12) {
    return {
      key: "balanced",
      badge: "穩定",
      tone: "good",
      title: "等待、判斷與抑制表現較平衡",
      meaning:
        "孩子在目前層級能等待聲音、理解相反規則，也能避免太早按或選直覺答案。",
      observation:
        "家長可以觀察孩子是否能在沒有太多提醒下，穩定完成整個回合。",
      advice:
        "下一次可以維持層級再確認一次；若仍穩定，就可以小幅提高難度。",
    };
  }

  return {
    key: "developing",
    badge: "練習",
    tone: "neutral",
    title: "聲音規則能力正在累積",
    meaning:
      "這次沒有單一特別突出的錯誤型態，孩子可能正在熟悉等待、聽聲音與做相反選擇的流程。",
    observation:
      "家長可以持續觀察孩子在不同日期是否呈現相似狀況，而不是只看單次表現。",
    advice:
      "下一次先維持目前層級，累積 2 到 3 次結果後再判斷是否調整。",
  };
}

function buildDetailedDptTrainingOneSentence(result = {}, stars = 1) {
  const levelInfo = getDetailedDptLevelInfo(result);
  const profile = getDetailedDptProfile(result);
  return `${levelInfo.title}，${stars} 星：${profile.title}。`;
}

function buildDetailedDptTrainingSummary(result = {}, stars = 1) {
  if (result?.aiAnalysis?.parentSummary) return result.aiAnalysis.parentSummary;

  const levelInfo = getDetailedDptLevelInfo(result);
  const starInfo = getDetailedDptStarInfo(stars);
  const profile = getDetailedDptProfile(result);
  const rt = result.representativeReactionTime || result.avgReactionTime;
  const rtText = rt ? `代表反應時間約 ${(rt / 1000).toFixed(2)} 秒` : "反應時間資料不足";

  return `這次訓練屬於「${levelInfo.label}」的${levelInfo.title}。${levelInfo.meaning} 本次拿到 ${stars} 星，代表${starInfo.meaning} 主要觀察到的型態是「${profile.title}」：${profile.meaning} 數據上，孩子完成 ${result.totalTrials} 題、正確 ${result.correctCount} 題，正確率約 ${Math.round(result.accuracyPercent)}%，太早按 ${result.anticipationCount} 次，相同動物錯誤率約 ${Math.round(result.sameAnimalErrorRate)}%，${rtText}。${profile.observation}`;
}

function buildDetailedDptTrainingHighlights(result = {}, stars = 1) {
  const levelInfo = getDetailedDptLevelInfo(result);
  const starInfo = getDetailedDptStarInfo(stars);
  const profile = getDetailedDptProfile(result);

  return [
    {
      badge: levelInfo.group === "hard" ? "高" : levelInfo.group === "easy" ? "基" : "中",
      tone: "neutral",
      title: levelInfo.title,
      text: levelInfo.meaning,
    },
    {
      badge: `${stars}星`,
      tone: stars >= 3 ? "good" : stars === 2 ? "watch" : "alert",
      title: starInfo.title,
      text: starInfo.meaning,
    },
    {
      badge: profile.badge,
      tone: profile.tone,
      title: profile.title,
      text: profile.meaning,
    },
    {
      badge: result.anticipationRate >= 20 ? "太快" : "等待",
      tone: result.anticipationRate >= 20 ? "alert" : "good",
      title: "等待聲音後再反應",
      text:
        result.anticipationRate >= 20
          ? `孩子太早按的比例約 ${Math.round(result.anticipationRate)}%，下一次可把重點放在「聽完再選」。`
          : "孩子大多能等待聲音後再反應，等待控制表現相對穩定。",
    },
    {
      badge: result.sameAnimalErrorRate >= 25 ? "直覺" : "相反",
      tone: result.sameAnimalErrorRate >= 25 ? "watch" : "good",
      title: "相反規則掌握",
      text:
        result.sameAnimalErrorRate >= 25
          ? `相同動物錯誤率約 ${Math.round(result.sameAnimalErrorRate)}%，代表相反規則仍需要練習。`
          : "孩子多半能抑制直覺答案，依照相反規則完成選擇。",
    },
    {
      badge: result.timeoutRate >= 30 ? "較慢" : "完成",
      tone: result.timeoutRate >= 30 ? "watch" : "good",
      title: "作答時間",
      text:
        result.timeoutRate >= 30
          ? `逾時比例約 ${Math.round(result.timeoutRate)}%，孩子可能需要更多時間把聲音規則轉成動作。`
          : "逾時比例不高，代表孩子大多能在時間內完成反應。",
    },
  ];
}

function buildDetailedDptTrainingIndicators(result = {}) {
  const rt = result.representativeReactionTime || result.avgReactionTime;
  const profile = getDetailedDptProfile(result);
  const soundDifference = Math.abs(result.catSoundAccuracy - result.dogSoundAccuracy);

  return [
    {
      key: "accuracy",
      title: "聲音規則正確率",
      value: clamp(result.accuracyPercent),
      status: result.accuracyPercent >= 80 ? "穩定" : result.accuracyPercent >= 60 ? "建立中" : "需支持",
      description: `本次正確率約 ${Math.round(result.accuracyPercent)}%。`,
      advice: result.accuracyPercent >= 80
        ? "孩子大多能依聲音完成相反選擇。"
        : "建議先確認孩子是否理解「聽到哪個聲音，要選相反動物」。",
    },
    {
      key: "profile",
      title: profile.title,
      value: profile.tone === "good" ? 88 : profile.tone === "normal" ? 66 : 44,
      status: profile.badge,
      description: profile.meaning,
      advice: profile.observation,
    },
    {
      key: "responseControl",
      title: "等待與衝動控制",
      value: clamp(100 - result.anticipationRate),
      status: result.anticipationRate >= 20 ? "偏快" : "穩定",
      description: `太早按比例約 ${Math.round(result.anticipationRate)}%。`,
      advice: result.anticipationRate >= 20
        ? "練習時先提醒孩子聽到聲音後停一下再選。"
        : "孩子大多能等待聲音後再反應。",
    },
    {
      key: "ruleInhibition",
      title: "相反規則抑制",
      value: clamp(100 - result.sameAnimalErrorRate),
      status: result.sameAnimalErrorRate >= 25 ? "需練習" : "穩定",
      description: `相同動物錯誤率約 ${Math.round(result.sameAnimalErrorRate)}%。`,
      advice: result.sameAnimalErrorRate >= 25
        ? "可用口訣協助：聽到貓找狗、聽到狗找貓。"
        : "孩子多半能壓住直覺答案，改選相反動物。",
    },
    {
      key: "speed",
      title: "反應啟動速度",
      value: rt ? clamp(100 - Math.max(0, (rt - 900) / 18)) : 0,
      status: rt ? formatMs(rt) : "資料不足",
      description: rt ? `代表反應時間約 ${(rt / 1000).toFixed(2)} 秒。` : "目前反應時間資料不足。",
      advice: rt && rt > 2200
        ? "可以先讓孩子穩定正確，再慢慢提高速度。"
        : "反應速度目前可持續觀察。",
    },
    {
      key: "soundBalance",
      title: "不同聲音的穩定度",
      value: result.hasReliableSoundComparison ? clamp(100 - soundDifference) : 50,
      status: result.hasReliableSoundComparison ? `${Math.round(soundDifference)}%差距` : "資料不足",
      description: result.hasReliableSoundComparison
        ? `貓聲與狗聲的正確率差距約 ${Math.round(soundDifference)}%。`
        : "兩種聲音的題數還不足，暫不做強烈判斷。",
      advice: soundDifference >= 30
        ? "可針對較不穩的聲音多做幾題。"
        : "兩種聲音表現差異不大。",
    },
  ];
}

function buildDetailedDptTrainingNextSuggestion(result = {}) {
  const profile = getDetailedDptProfile(result);
  const levelInfo = getDetailedDptLevelInfo(result);
  const nextLabel =
    result.aiAnalysis?.recommendedDifficultyLabel ||
    result.recommendedDifficulty ||
    levelInfo.label;

  if (profile.key === "balanced") {
    return {
      title: "可以小幅提高挑戰",
      text: `孩子在「${levelInfo.label}」表現穩定。下一次可以先維持同層級確認一次；若仍穩定，再小幅提高到「${nextLabel}」。`,
    };
  }

  if (profile.tone === "alert" || profile.tone === "watch") {
    return {
      title: "先穩定主要型態，不急著升級",
      text: `${profile.advice} 若連續兩次仍出現同樣狀況，可以降低一階，先讓孩子重新建立成功經驗。`,
    };
  }

  return {
    title: "維持目前層級，針對主要型態練習",
    text: `${profile.advice} 建議累積 2 到 3 次同層級結果後，再判斷是否提高難度。`,
  };
}

function buildOneSentence(result) {
  return (
    result?.scoring?.childView?.message ||
    result.parentSummary ||
    "已完成本次聽聲音選相反動物任務。"
  );
}

function buildQuickStats(result) {
  return [
    {
      label: "正確題數",
      value: `${result.correctCount} / ${result.totalTrials}`,
      helper: "正確依照相反規則選擇動物",
    },
    {
      label: "相反規則正確率",
      value: `${Math.round(result.accuracyPercent)}%`,
      helper: "貓叫選狗、狗叫選貓",
    },
    {
      label: "代表性反應時間",
      value: formatMs(result.representativeReactionTime || result.avgReactionTime),
      helper: "以正確題的中位數與平均數綜合計算",
    },
    {
      label: "同動物錯誤",
      value: `${Math.round(result.sameAnimalErrorRate)}%`,
      helper: "直接選擇發出聲音的動物",
    },
    {
      label: "過早反應",
      value: `${result.anticipationCount} 次`,
      helper: "尚未完成聲音判斷便作答",
    },
    {
      label: "逾時次數",
      value: `${result.timeoutCount} 次`,
      helper: "未在作答時間內完成選擇",
    },
  ];
}

function buildHighlights(result) {
  const rt = result.representativeReactionTime || result.avgReactionTime;
  const soundDifference = Math.abs(result.catSoundAccuracy - result.dogSoundAccuracy);

  return [
    {
      badge: result.accuracyPercent >= 80 ? "✓" : "△",
      tone: result.accuracyPercent >= 80 ? "good" : "watch",
      title: "相反規則記得住嗎？",
      text:
        result.accuracyPercent >= 80
          ? "孩子大多能記住聽到聲音後要選擇相反動物。"
          : "孩子偶爾會混淆規則，建議先維持較清楚的示範與提示。",
    },
    {
      badge: rt > 0 && rt <= 1400 ? "✓" : "△",
      tone: rt > 0 && rt <= 1400 ? "good" : "watch",
      title: "聲音判斷速度穩定嗎？",
      text: rt > 0 ? `代表性正確反應約 ${(rt / 1000).toFixed(2)} 秒。` : "目前正確反應時間資料不足。",
    },
    {
      badge: result.sameAnimalErrorRate <= 15 ? "✓" : "!",
      tone: result.sameAnimalErrorRate <= 15 ? "good" : "alert",
      title: "能抑制聲音直覺嗎？",
      text:
        result.sameAnimalErrorRate <= 15
          ? "孩子較少直接選擇發出聲音的動物。"
          : "孩子較常依照聲音直覺作答，需要加強相反規則抑制。",
    },
    {
      badge: !result.hasReliableSoundComparison ? "?" : soundDifference < 30 ? "✓" : "△",
      tone: !result.hasReliableSoundComparison ? "neutral" : soundDifference < 30 ? "good" : "watch",
      title: "貓聲與狗聲表現一致嗎？",
      text: !result.hasReliableSoundComparison
        ? "兩種聲音題數尚不足，暫不單獨比較。"
        : soundDifference < 30
          ? "孩子在貓叫與狗叫題型的表現大致平衡。"
          : `兩種聲音正確率相差約 ${Math.round(soundDifference)}%，可加強較弱的聲音題型。`,
    },
  ];
}

function buildIndicators(result) {
  const officialIndicators = result?.scoring?.parentView?.indicators;
  if (Array.isArray(officialIndicators) && officialIndicators.length > 0) {
    return officialIndicators.map((item) => ({
      key: item.key,
      title: item.label,
      value: Math.round(clamp(item.value)),
      status: item.level || "持續觀察",
      description: item.description || "",
      advice:
        item.value >= 80
          ? "目前表現穩定，可持續累積紀錄。"
          : "建議維持適合的速度與提示，逐步增加熟練度。",
    }));
  }

  return [];
}

function getProfileText(profile) {
  const map = {
    stable: "表現穩定",
    developing: "持續發展中",
    slow_start: "反應啟動較慢",
    impulsive: "可能有衝動反應",
    rule_inhibition_weak: "相反規則抑制較弱",
    fatigue: "後半段可能疲勞",
    sound_rule_asymmetry: "聲音規則表現不平衡",
    unstable: "作答節奏較不穩定",
    insufficient_data: "資料不足",
  };
  return map[profile] || "持續觀察";
}

function getWeaknessText(weakness) {
  const map = {
    none: "未見明顯弱項",
    response_initiation: "反應啟動",
    response_speed: "反應速度",
    impulse_control: "衝動控制",
    rule_inhibition: "相反規則抑制",
    rule_understanding: "規則理解",
    sustained_attention: "持續注意",
    response_stability: "反應穩定度",
    sound_discrimination: "貓聲與狗聲辨識",
    side_bias: "左右側作答平衡",
    insufficient_data: "資料不足",
  };
  return map[weakness] || "持續觀察";
}

function buildNextSuggestion(result) {
  const ai = result.aiAnalysis || {};
  if (ai.suggestedAction) {
    return {
      title: `下一輪建議：${ai.recommendedDifficultyLabel || "維持適合難度"}`,
      text: ai.suggestedAction,
    };
  }

  if (result.recommendedDifficulty === "hard") {
    return { title: "下一輪可以增加挑戰", text: "可縮短作答時間並減少直接提示。" };
  }
  if (result.recommendedDifficulty === "easy") {
    return { title: "下一輪先使用簡單模式", text: "延長作答時間並保留清楚的相反規則提示。" };
  }
  return { title: "下一輪維持目前難度", text: "先讓孩子穩定使用相反規則，再逐步增加挑戰。" };
}

function getDataQualityNotes(result) {
  const notes = [];
  const summary = result.summary || {};
  if (safeNumber(summary.validRtCount, 0) > 0 && safeNumber(summary.validRtCount, 0) < 3) {
    notes.push("有效正確反應時間題數較少，速度表現建議搭配多次紀錄觀察。");
  }
  if (!summary.hasReliableSoundComparison) {
    notes.push("貓叫與狗叫題型尚未達到可靠比較題數，兩者差異僅供參考。");
  }
  if (!summary.hasReliableHalfComparison) {
    notes.push("前後半段題數不足，暫不單獨解讀注意力變化。");
  }
  return notes;
}

/* ========= 主頁面 ========= */
export default function ResultPage_DPT() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [hatReward, setHatReward] = useState(null);

  const result = useMemo(() => {
    try {
      const hasRouteState =
        location.state &&
        typeof location.state === "object" &&
        Object.keys(location.state).length > 0;

      const raw = hasRouteState ? location.state : readSavedResult();
      return raw ? normalizeResult(raw) : null;
    } catch (error) {
      console.error("Failed to parse DPT result:", error);
      return null;
    }
  }, [location.state]);

  useEffect(() => {
    // 明確限制：只有 DPT 訓練結果可登記帽子遊戲。
    // 測驗結果（mode === "test"）直接略過。
    if (!result || result.mode !== "training") {
      setHatReward(null);
      return;
    }

    try {
      setHatReward(registerDptHatReward(result));
    } catch (error) {
      console.error("DPT 帽子遊戲排程登記失敗：", error);
      setHatReward(null);
    }
  }, [result]);

  const handleNavigate = (route) => {
    if (isNavigating) return;
    setIsNavigating(true);
    navigate(route);
  };

  const handleBackToMenu = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    // 只有訓練結果且本次排程命中時，才改為進入帽子遊戲。
    if (result?.mode === "training" && hatReward) {
      sessionStorage.removeItem(`pendingHatReward_DPT_${hatReward.childId}`);
      navigate(HAT_GAME_ROUTE, {
        state: {
          childId: hatReward.childId,
          gameId: "DPT",
          sourceMode: "training",
          resultSessionId: hatReward.resultSessionId,
          rewardSessionId: hatReward.rewardSessionId,
          returnRoute: MENU_ROUTE,
        },
      });
      return;
    }

    navigate(result?.mode === "training" ? MENU_ROUTE : TEST_MAP_ROUTE);
  };

  if (!result) {
    return (
      <div className="dpt-result-page" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)), url(${backgroundImg})` }}>
        <style>{resultPageCss}</style>
        <main className="dpt-result-main-card dpt-result-empty-card">
          <header className="dpt-result-header">
            <p className="dpt-mode-tag">結果頁</p>
            <h1 className="dpt-result-main-title">找不到結果</h1>
          </header>
          <section className="dpt-note-box">
            <h3>目前沒有 DPT 資料</h3>
            <p>請先完成一次測驗或訓練，這裡就會出現家長可以閱讀的結果整理。</p>
          </section>
          <footer className="dpt-action-btns">
            <button type="button" className="dpt-image-button" disabled={isNavigating} onClick={() => handleNavigate(TEST_MAP_ROUTE)} aria-label="回到主頁">
              <img src={homeBackBtn} alt="回到主頁" />
            </button>
          </footer>
        </main>
      </div>
    );
  }

  const isTraining = result.mode === "training";
  const displayScore = getDisplayScore(result);
  const stars = getStars(result, displayScore);
  const detailedTrainingStars = getDetailedDptStars(result, displayScore);
  const childShortLabel = getChildShortLabel(result, displayScore);
  const oneSentenceResult = isTraining
    ? buildDetailedDptTrainingOneSentence(result, detailedTrainingStars)
    : buildOneSentence(result);
  const quickStats = buildQuickStats(result);
  const highlights = isTraining
    ? buildDetailedDptTrainingHighlights(result, detailedTrainingStars)
    : buildHighlights(result);
  const indicators = isTraining
    ? buildDetailedDptTrainingIndicators(result)
    : buildIndicators(result);
  const nextSuggestion = isTraining
    ? buildDetailedDptTrainingNextSuggestion(result)
    : buildNextSuggestion(result);
  const parentSummaryText = isTraining
    ? buildDetailedDptTrainingSummary(result, detailedTrainingStars)
    : result.parentSummary || result.scoring?.parentView?.plainLanguageSummary;
  const dataQualityNotes = getDataQualityNotes(result);
  const profileText = getProfileText(result.aiAnalysis?.attentionProfile);
  const weaknessText = getWeaknessText(result.aiAnalysis?.mainWeakness);

  return (
    <div className="dpt-result-page" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)), url(${backgroundImg})` }}>
      <style>{resultPageCss}</style>

      <main className="dpt-result-main-card">
        <header className="dpt-result-header">
          <p className="dpt-mode-tag">{getResultModeText(result.mode)}</p>
          <h1 className="dpt-result-main-title">
            {isTraining ? "相反動物練習完成" : "相反動物測驗完成"}
          </h1>
          <p className="dpt-mode-desc">
            {isTraining
              ? "練習結果會參考相反規則、提示與難度調整，適合觀察孩子下一輪該怎麼練。"
              : "測驗結果使用固定流程，適合觀察孩子本次聲音辨識與相反規則控制表現。"}
          </p>
        </header>

        <section className="dpt-overview-card">
          <div className="dpt-overview-left">
            <div className="dpt-score-circle" aria-label={`${displayScore} 分`}>
              <span className="dpt-score-number">{displayScore}</span>
              <span className="dpt-score-unit">分</span>
            </div>
            <div className="dpt-overview-text-box">
              <p className="dpt-overview-label">本次表現</p>
              <h2 className="dpt-overview-title">{childShortLabel}</h2>
              <p className="dpt-overview-desc">{oneSentenceResult}</p>
            </div>
          </div>

          <div className="dpt-star-summary">
            <div className="dpt-star-row" aria-label={`${stars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`dpt-star-chip ${star <= stars ? "is-on" : ""}`}>★</span>
              ))}
            </div>
            <p>星星代表本次完成表現</p>
            <small>請搭配下方觀察重點一起看，不是單次診斷。</small>
          </div>
        </section>

        <section className="dpt-quick-stats">
          {quickStats.map((item) => (
            <article key={item.label} className="dpt-stat-card">
              <p className="dpt-stat-label">{item.label}</p>
              <p className="dpt-stat-value">{item.value}</p>
              <p className="dpt-stat-helper">{item.helper}</p>
            </article>
          ))}
        </section>

        <section className="dpt-panel-block">
          <h2 className="dpt-section-title">家長快速解讀</h2>
          {parentSummaryText ? (
            <p className="dpt-parent-summary-text">
              {parentSummaryText}
            </p>
          ) : (
            <>
              <p className="dpt-parent-summary-text">孩子這次已完成聽聲音選相反動物任務，可從相反規則、反應速度、抑制直覺與注意力穩定度一起觀察。</p>
              <p className="dpt-parent-summary-text">建議不要只看單次分數，可以搭配多次測驗與訓練趨勢判斷是否進步。</p>
            </>
          )}
        </section>

        {dataQualityNotes.length > 0 && (
          <section className="dpt-note-box dpt-note-box--warning">
            <h3>資料解讀提醒</h3>
            {dataQualityNotes.map((note) => <p key={note}>{note}</p>)}
          </section>
        )}

        <section className="dpt-panel-block">
          <h2 className="dpt-section-title">家長可以這樣看</h2>
          <div className="dpt-highlight-grid">
            {highlights.map((item) => (
              <article key={item.title} className="dpt-observation-card">
                <div className="dpt-observation-top">
                  <span className={`dpt-status-pill ${item.tone}`}>{item.badge}</span>
                  <div>
                    <p className="dpt-card-label">觀察重點</p>
                    <h3>{item.title}</h3>
                  </div>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dpt-panel-block">
          <h2 className="dpt-section-title">孩子這次主要表現</h2>
          <div className="dpt-indicator-grid">
            {indicators.map((item) => (
              <article key={item.key} className="dpt-observation-card">
                <div className="dpt-observation-top">
                  <span className="dpt-status-pill neutral">{item.status}</span>
                  <div>
                    <p className="dpt-card-label">能力指標</p>
                    <h3>{item.title}</h3>
                  </div>
                </div>
                <p className="dpt-indicator-score">{item.value} / 100</p>
                <div className="dpt-score-bar" aria-hidden="true"><span style={{ width: `${clamp(item.value)}%` }} /></div>
                <p>{item.description}</p>
                <p className="dpt-card-meaning">{item.advice}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dpt-ai-card">
          <h2 className="dpt-section-title">AI 訓練觀察</h2>
          <div className="dpt-ai-grid">
            <div>
              <p className="dpt-ai-label">本次主要觀察</p>
              <h3>{profileText}</h3>
              <p>主要弱項：{weaknessText}</p>
            </div>
            <div>
              <p className="dpt-ai-label">下一輪建議</p>
              <h3>{nextSuggestion.title}</h3>
              <p>{nextSuggestion.text}</p>
            </div>
          </div>
          {result.suggestedAction && <p className="dpt-ai-extra">{result.suggestedAction}</p>}
        </section>

        <section className="dpt-note-box">
          <h3>給家長的小提醒</h3>
          <p>
            這份結果是本次遊戲中的觀察紀錄，可以幫助了解孩子在「辨認聲音、使用相反規則、抑制直覺反應、維持注意力」時的狀況；不代表醫療診斷，建議搭配多次紀錄與其他任務一起觀察。
          </p>
        </section>

        <footer className="dpt-action-btns">
          <button type="button" className="dpt-image-button" disabled={isNavigating} onClick={handleBackToMenu} aria-label="回到主頁">
            <img src={homeBackBtn} alt="回到主頁" />
          </button>
          {isTraining && (
            <button type="button" className="dpt-image-button" disabled={isNavigating} onClick={() => handleNavigate(TRAINING_ROUTE)} aria-label="play again">
              <img src={homeAgainBtn} alt="play again" />
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

const resultPageCss = `
.dpt-result-page,
.dpt-result-page * {
  box-sizing: border-box;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.dpt-result-page {
  min-height: 100vh;
  padding: clamp(16px, 3vw, 40px);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  color: #4b3524;
}

.dpt-result-main-card {
  width: min(1160px, 96vw);
  margin: 0 auto;
  padding: clamp(22px, 3vw, 40px);
  border: 3px solid rgba(155, 103, 43, .72);
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255, 253, 242, .97), rgba(255, 247, 220, .97));
  box-shadow: 0 20px 48px rgba(89, 58, 24, .2);
  backdrop-filter: blur(8px);
}

.dpt-result-empty-card { max-width: 760px; }
.dpt-result-header { text-align: center; margin-bottom: 24px; }
.dpt-mode-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 12px;
  padding: 7px 16px;
  border-radius: 999px;
  background: #edf7d4;
  border: 2px solid #a7c85a;
  color: #4d6d25;
  font-size: 14px;
  font-weight: 800;
}
.dpt-result-main-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 900;
  color: #72502e;
  letter-spacing: .5px;
}
.dpt-mode-desc {
  margin: 10px auto 0;
  max-width: 780px;
  font-size: clamp(16px, 2vw, 20px);
  color: #7c644c;
  line-height: 1.65;
}

.dpt-overview-card,
.dpt-panel-block,
.dpt-ai-card,
.dpt-note-box,
.dpt-stat-card,
.dpt-observation-card {
  border: 1px solid rgba(171, 125, 66, .28);
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 8px 20px rgba(104, 73, 36, .09);
}

.dpt-overview-card {
  border-radius: 22px;
  padding: clamp(20px, 2.7vw, 30px);
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  border-top: 6px solid #e6a53c;
}
.dpt-overview-left { display: flex; align-items: center; gap: 24px; text-align: left; min-width: 0; }
.dpt-score-circle {
  width: clamp(116px, 15vw, 154px);
  height: clamp(116px, 15vw, 154px);
  flex: 0 0 auto;
  border-radius: 50%;
  border: 6px solid #e0a43b;
  background: radial-gradient(circle at 35% 28%, #fffef5, #ffe8a7 68%, #f4ca67);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  box-shadow: inset 0 -7px 0 rgba(188, 126, 33, .14), 0 10px 22px rgba(101, 69, 28, .14);
}
.dpt-score-number { font-size: clamp(40px, 6vw, 62px); font-weight: 900; line-height: .95; color: #71471d; }
.dpt-score-unit { margin-top: 4px; font-size: 16px; font-weight: 800; color: #8b653b; }
.dpt-overview-label, .dpt-card-label, .dpt-stat-label, .dpt-ai-label { margin: 0 0 6px; color: #9b744b; font-size: 14px; font-weight: 800; }
.dpt-overview-title { margin: 0 0 8px; font-size: clamp(25px, 3vw, 34px); color: #5d4028; }
.dpt-overview-desc { margin: 0; font-size: clamp(16px, 2vw, 20px); line-height: 1.65; color: #6b523d; }
.dpt-star-summary { min-width: 230px; text-align: center; padding-left: 24px; border-left: 1px solid #ead8bd; }
.dpt-star-row { display: flex; justify-content: center; gap: 8px; font-size: clamp(31px, 4vw, 43px); }
.dpt-star-chip { color: #ded4c5; filter: drop-shadow(0 2px 0 rgba(121, 75, 18, .08)); }
.dpt-star-chip.is-on { color: #f0b538; }
.dpt-star-summary p { margin: 8px 0 4px; font-weight: 800; color: #6a4a2b; }
.dpt-star-summary small { color: #8c7359; line-height: 1.45; }

.dpt-quick-stats,
.dpt-highlight-grid,
.dpt-indicator-grid,
.dpt-ai-grid {
  display: grid;
  gap: 15px;
}
.dpt-quick-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 18px 0; }
.dpt-highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dpt-indicator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dpt-ai-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.dpt-stat-card,
.dpt-observation-card,
.dpt-panel-block,
.dpt-ai-card,
.dpt-note-box { border-radius: 18px; padding: clamp(17px, 2vw, 22px); }
.dpt-stat-card:nth-child(3n + 1) { border-top: 4px solid #a7c85a; }
.dpt-stat-card:nth-child(3n + 2) { border-top: 4px solid #78bfe8; }
.dpt-stat-card:nth-child(3n) { border-top: 4px solid #ed9c82; }
.dpt-stat-value { margin: 0 0 8px; font-size: clamp(24px, 3vw, 32px); font-weight: 900; color: #4d3827; }
.dpt-stat-helper, .dpt-observation-card p, .dpt-note-box p, .dpt-ai-card p { margin: 0; color: #6d5845; line-height: 1.65; }
.dpt-panel-block, .dpt-ai-card, .dpt-note-box { margin-top: 18px; }
.dpt-section-title { margin: 0 0 15px; font-size: clamp(23px, 3vw, 30px); font-weight: 900; color: #5a3e27; }
.dpt-parent-summary-text { margin: 0 0 8px; font-size: clamp(16px, 2vw, 19px); line-height: 1.8; color: #66513f; }
.dpt-observation-top { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.dpt-observation-card h3, .dpt-ai-card h3 { margin: 0; font-size: clamp(19px, 2.2vw, 23px); color: #4e3928; }
.dpt-status-pill {
  min-width: 42px;
  min-height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  background: #f3eadf;
  color: #69503a;
  font-size: 14px;
  font-weight: 900;
  border: 1px solid rgba(120, 76, 24, .14);
}
.dpt-status-pill.good { background: #e8f4cf; color: #4f742d; border-color: #c9dda0; }
.dpt-status-pill.watch { background: #fff0bd; color: #80601d; border-color: #ead497; }
.dpt-status-pill.alert { background: #fde1d8; color: #93483b; border-color: #edc2b7; }
.dpt-status-pill.neutral { background: #dff1fb; color: #426f8e; border-color: #bfdeef; }
.dpt-indicator-score { font-size: 23px; font-weight: 900; color: #4b3828 !important; margin-bottom: 8px !important; }
.dpt-card-meaning { margin-top: 9px !important; color: #6d6a2e !important; font-weight: 700; }
.dpt-score-bar { width: 100%; height: 10px; border-radius: 999px; background: #eee5d9; overflow: hidden; margin: 8px 0 12px; }
.dpt-score-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #9dc85a, #e7b348); }
.dpt-ai-card { background: linear-gradient(135deg, rgba(237, 247, 212, .88), rgba(224, 242, 251, .9)); border-color: rgba(128, 169, 119, .38); }
.dpt-ai-extra { margin-top: 13px !important; padding-top: 13px; border-top: 1px dashed rgba(102, 122, 75, .35); }
.dpt-note-box { background: rgba(255, 252, 239, .95); }
.dpt-note-box--warning { background: rgba(255, 244, 210, .96); border-color: rgba(220, 174, 74, .45); }
.dpt-note-box h3 { margin: 0 0 8px; font-size: 21px; color: #594129; }

.dpt-action-btns {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #ead9c0;
  display: flex;
  justify-content: center;
  gap: clamp(16px, 3vw, 28px);
}
.dpt-image-button {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: transform .15s ease, filter .15s ease, opacity .15s ease;
}
.dpt-image-button:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.05); }
.dpt-image-button:focus-visible { outline: 3px solid rgba(106, 168, 207, .55); outline-offset: 5px; border-radius: 14px; }
.dpt-image-button:disabled { opacity: .55; cursor: not-allowed; }
.dpt-image-button img { width: clamp(118px, 15vw, 176px); height: auto; display: block; }

@media (max-width: 900px) {
  .dpt-overview-card { align-items: stretch; }
  .dpt-star-summary { min-width: 200px; }
  .dpt-quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .dpt-result-page { padding: 10px; background-attachment: scroll; }
  .dpt-result-main-card { width: 100%; padding: 18px 14px 22px; border-width: 2px; border-radius: 20px; }
  .dpt-overview-card { flex-direction: column; gap: 18px; padding: 18px; }
  .dpt-overview-left { align-items: flex-start; }
  .dpt-score-circle { width: 96px; height: 96px; border-width: 5px; }
  .dpt-star-summary { min-width: 0; padding: 16px 0 0; border-left: 0; border-top: 1px solid #ead8bd; }
  .dpt-quick-stats,
  .dpt-highlight-grid,
  .dpt-indicator-grid,
  .dpt-ai-grid { grid-template-columns: 1fr; }
  .dpt-action-btns {
    position: sticky;
    bottom: 0;
    margin: 24px -14px -22px;
    padding: 13px 14px;
    background: rgba(255, 250, 232, .96);
    z-index: 5;
  }
  .dpt-image-button img { width: min(40vw, 150px); }
}

@media (max-width: 390px) {
  .dpt-overview-left { flex-direction: column; }
  .dpt-action-btns { gap: 8px; }
}
`;
