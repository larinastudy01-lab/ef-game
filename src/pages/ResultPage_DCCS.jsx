// src/pages/ResultPage_DCCS.jsx

import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_DCCS.css";

import bgImg from "../asset/SRT/SRT_background.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeAgainBtn from "../asset/home/again.webp";
import calculateDccsScore from "../utils/dccsScoring";

const MENU_ROUTE = "/game-menu";
const TEST_MAP_ROUTE = "/test-map";
const TRAINING_ROUTE = "/training-dccs";
const HAT_GAME_ROUTE = "/hat-sticker-game";
const HAT_TRIGGER_MIN = 5;
const HAT_TRIGGER_MAX = 8;
const SESSION_KEYS = [
  "DCCS_RESULT",
  "DCCS_TEST_RESULT",
  "DCCS_TRAINING_RESULT",
  "dccsTrainingResult",
  "dccsTestResult",
];

const DIFFICULTY_TO_LEVEL = {
  colorIntro: 1,
  colorStable: 2,
  typeIntro: 3,
  typeStable: 4,
  switchClear: 5,
  switchEarly: 6,
  switchMaintain: 7,
  lowInterference: 8,
  highInterference: 9,
  testLike: 10,
  easyIntro: 1,
  easyPlus: 2,
  switchIntro: 5,
  switchPlus: 7,
  interference: 9,
};

const LEVEL_INFO = {
  1: {
    title: "找一樣顏色",
    focus: "知道現在要看顏色",
    parentText: "這一關主要是在看孩子能不能記得：現在只要看衣服的顏色。",
    homeTip: "可以請孩子把玩具先照顏色分堆，例如紅色一堆、藍色一堆。",
  },
  2: {
    title: "顏色小練習",
    focus: "穩定照顏色分類",
    parentText: "這一關還是看顏色，但題目變多，重點是能不能穩穩照同一個玩法完成。",
    homeTip: "先固定一個玩法，不急著換規則，讓孩子多練幾次照顏色分類。",
  },
  3: {
    title: "找一樣衣服",
    focus: "知道現在要看衣服種類",
    parentText: "這一關主要是在看孩子能不能不看顏色，改看衣服是哪一種。",
    homeTip: "可以一起把衣服或圖片分成上衣、褲子、襪子、裙子。",
  },
  4: {
    title: "衣服小練習",
    focus: "穩定照衣服種類分類",
    parentText: "這一關是練習看衣服種類，還沒有強調換玩法，重點是先熟悉第二種分類方式。",
    homeTip: "讓孩子先穩定練習『看種類』，不要同時給太多提示。",
  },
  5: {
    title: "換玩法囉",
    focus: "玩法改變後能不能跟上",
    parentText: "這一關開始練習玩法改變：一開始看顏色，後來改成看衣服種類。",
    homeTip: "陪孩子說：『剛剛看顏色，現在換成看衣服。』讓孩子先停一下再作答。",
  },
  6: {
    title: "早一點換玩法",
    focus: "提早換玩法時能不能跟上",
    parentText: "這一關會比較早換玩法，孩子需要更快知道現在的分類方式已經不一樣了。",
    homeTip: "短短玩幾題就換玩法，例如先照顏色分 3 個，再改照種類分。",
  },
  7: {
    title: "不要忘記玩法",
    focus: "換玩法後能不能維持新玩法",
    parentText: "這一關不只看能不能切換，也看孩子切換後會不會又回到剛剛的玩法。",
    homeTip: "換玩法後多提醒一次：『現在一直都是看衣服，不看顏色喔。』",
  },
  8: {
    title: "不要被騙到",
    focus: "會不會還照剛剛的玩法",
    parentText: "這一關會有一點顏色干擾，重點是孩子能不能記得現在不是看顏色。",
    homeTip: "可以慢慢練，不用催快；先問孩子：『現在要看顏色還是看衣服？』",
  },
  9: {
    title: "看清楚再放",
    focus: "不被明顯顏色干擾",
    parentText: "這一關干擾更多，顏色會比較容易吸引注意，孩子要練習照新的玩法完成。",
    homeTip: "若孩子一直照顏色分，可以先回到前一關，用更明確的提示陪他練。",
  },
  10: {
    title: "自己試試看",
    focus: "接近正式測驗狀態",
    parentText: "這一關比較接近測驗，不會一直提示，重點是看孩子能不能自己記得玩法。",
    homeTip: "完成後先鼓勵，不要急著重測；可以休息後再練短回合。",
  },
};

const STAR_STATUS = {
  3: {
    label: "今天很穩定",
    detail: "孩子大多能自己完成，下一步可以慢慢增加一點挑戰。",
  },
  2: {
    label: "正在練習中",
    detail: "孩子已經有基礎，但玩法改變或題目變多時，可能還需要一點提醒。",
  },
  1: {
    label: "需要多一點提示",
    detail: "孩子可能還在熟悉玩法，建議先回到簡單、短回合練習。",
  },
};

const TRAINING_STAR_STATUS = {
  3: {
    label: "目前層級表現穩定",
    detail: "孩子在這個層級大多能自己完成。下一步可以先維持同層級確認一次，或小幅增加一點挑戰。",
  },
  2: {
    label: "能力正在出現，但還需要穩定",
    detail: "孩子已經有基本分類能力，但玩法改變、題目變多或干擾增加時，可能還需要一點提醒。",
  },
  1: {
    label: "仍需要較多支持與熟悉",
    detail: "孩子目前可能還在熟悉分類玩法，建議先回到簡單、短回合練習，讓孩子累積成功經驗。",
  },
};

const TRAINING_LEVEL_GROUPS = {
  basic: {
    label: "基礎分類層級",
    detail: "這一層主要在建立「知道現在要看什麼」的基本流程，重點不是快，而是理解並穩定使用同一個規則。",
  },
  switch: {
    label: "規則切換層級",
    detail: "這一層開始要求孩子從一個分類規則改成另一個規則，重點是玩法改變後能不能跟上。",
  },
  interference: {
    label: "干擾控制層級",
    detail: "這一層加入更明顯的舊規則或顏色干擾，重點是能不能記得現在的玩法，不被前一個玩法拉回去。",
  },
};


function safeJsonParse(raw, fallback = null) {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function resolveChildId(payload = {}) {
  const directId =
    payload?.childId ??
    payload?.userId ??
    payload?.profileId ??
    payload?.child?.id ??
    payload?.profile?.id;

  if (directId !== undefined && directId !== null && String(directId).trim()) {
    return String(directId);
  }

  const directKeys = [
    "selectedChildId",
    "currentChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of directKeys) {
    const value = localStorage.getItem(key);
    if (value && value.trim()) return value.trim();
  }

  const objectKeys = ["currentChild", "selectedChild", "activeChild"];

  for (const key of objectKeys) {
    const parsed = safeJsonParse(localStorage.getItem(key), null);
    if (parsed?.id !== undefined && parsed?.id !== null) {
      return String(parsed.id);
    }
  }

  return "unassigned";
}

function isTrainingResult(payload = {}) {
  const mode = String(
    payload?.mode ??
      payload?.resultMode ??
      payload?.gameMode ??
      payload?.result?.mode ??
      ""
  ).toLowerCase();

  return mode === "training" || mode === "train";
}

function createHatRewardSessionId(childId) {
  return `dccs-hat-${childId}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getRandomHatTarget() {
  return (
    Math.floor(Math.random() * (HAT_TRIGGER_MAX - HAT_TRIGGER_MIN + 1)) +
    HAT_TRIGGER_MIN
  );
}

function shouldOpenHatGame(childId) {
  const progressKey = `hatRewardProgress_${childId}`;
  const saved = safeJsonParse(localStorage.getItem(progressKey), {});

  const previousCount = Math.max(0, Math.floor(safeNumber(saved?.count, 0)));
  const previousTarget = clamp(
    Math.floor(safeNumber(saved?.target, getRandomHatTarget())),
    HAT_TRIGGER_MIN,
    HAT_TRIGGER_MAX
  );
  const nextCount = previousCount + 1;

  if (nextCount >= previousTarget) {
    localStorage.setItem(
      progressKey,
      JSON.stringify({
        count: 0,
        target: getRandomHatTarget(),
        lastTriggeredAt: new Date().toISOString(),
        lastSourceGame: "DCCS",
      })
    );
    return true;
  }

  localStorage.setItem(
    progressKey,
    JSON.stringify({
      count: nextCount,
      target: previousTarget,
      lastCompletedAt: new Date().toISOString(),
      lastSourceGame: "DCCS",
    })
  );

  return false;
}

function readStoredResult() {
  for (const key of SESSION_KEYS) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn(`${key} 解析失敗：`, error);
    }
  }

  return null;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  const number = safeNumber(value, min);
  const safeMin = safeNumber(min, 0);
  const safeMax = safeNumber(max, 100);

  return Math.min(Math.max(number, safeMin), safeMax);
}

function percent(value) {
  const number = safeNumber(value, 0);
  const normalized = number >= 0 && number <= 1 ? number * 100 : number;

  return clamp(Math.round(normalized), 0, 100);
}

function clearDccsResultCaches() {
  SESSION_KEYS.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`${key} 清除失敗：`, error);
    }
  });
}

function getSafeTrainingLevel(value, fallback = 5) {
  const level = Math.round(safeNumber(value, fallback));
  return clamp(level, 1, 10);
}

function getTrialLogsFromPayload(payload) {
  if (Array.isArray(payload?.trialLogs)) return payload.trialLogs;
  if (Array.isArray(payload?.dccsTrialLogs)) return payload.dccsTrialLogs;
  if (Array.isArray(payload?.DCCSTrialLogs)) return payload.DCCSTrialLogs;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.trials)) return payload.trials;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.result?.clinicianMetrics?.trialLogs)) {
    return payload.result.clinicianMetrics.trialLogs;
  }

  return [];
}

function normalizePayload(payload = {}) {
  const raw = payload?.result && typeof payload.result === "object" ? payload.result : payload;

  return {
    ...raw,
    trialLogs: getTrialLogsFromPayload(raw),
  };
}

function getMetricValue(result, modernKey, fallbackKey) {
  const indicators = result?.parentIndicators || {};
  const modern = indicators[modernKey];

  if (typeof modern === "number") return percent(modern);
  if (modern && typeof modern.value === "number") return percent(modern.value);
  if (typeof indicators[fallbackKey] === "number") return percent(indicators[fallbackKey]);

  return 0;
}

function getReadableLevel(value, emptyText = "這關還沒看這個") {
  const safeValue = clamp(safeNumber(value, 0), 0, 100);

  if (safeValue <= 0) return emptyText;
  if (safeValue >= 85) return "很穩定";
  if (safeValue >= 70) return "大致穩定";
  if (safeValue >= 50) return "正在練習";
  return "需要多一點提示";
}

function getApproxText(value) {
  const safeValue = clamp(safeNumber(value, 0), 0, 100);

  if (safeValue <= 0) return "尚未觀察";
  if (safeValue >= 85) return "大多數時候都可以完成";
  if (safeValue >= 70) return "多數時候可以完成";
  if (safeValue >= 50) return "有時候可以完成";
  return "目前需要比較多協助";
}

function getStarCount(value) {
  return clamp(Math.round(safeNumber(value, 1)), 1, 3);
}

function getDifficultyLevel(payload, result) {
  const directLevel = safeNumber(
    payload?.trainingLevel ??
      payload?.level ??
      payload?.trainingOrder ??
      result?.trainingLevel,
    0
  );

  if (directLevel >= 1 && directLevel <= 10) return getSafeTrainingLevel(directLevel);

  const difficulty =
    payload?.difficulty ||
    payload?.trainingDifficulty ||
    payload?.levelDifficulty ||
    result?.difficulty;

  return getSafeTrainingLevel(DIFFICULTY_TO_LEVEL[difficulty], 5);
}

function getRecommendedLevel(payload, result) {
  const saved = safeNumber(
    payload?.nextRecommendedDccsLevel ?? result?.nextRecommendedDccsLevel,
    0
  );

  if (saved >= 1 && saved <= 10) return getSafeTrainingLevel(saved);

  const currentLevel = getDifficultyLevel(payload, result);
  const stars = getStarCount(result?.stars);
  const oldRuleErrors = safeNumber(
    result?.perseverativeErrors ?? result?.oldRuleInterference,
    0
  );

  if (stars === 3 && oldRuleErrors <= 1) return getSafeTrainingLevel(currentLevel + 1, currentLevel);
  if (stars === 1 || oldRuleErrors >= 3) return getSafeTrainingLevel(currentLevel - 1, currentLevel);
  return getSafeTrainingLevel(currentLevel);
}

function getResultContext(payload, result) {
  const metrics = result?.clinicianMetrics || {};
  const level = getDifficultyLevel(payload, result);
  const recommendedLevel = getRecommendedLevel(payload, result);
  const levelInfo = LEVEL_INFO[level] || LEVEL_INFO[5];
  const recommendedInfo = LEVEL_INFO[recommendedLevel] || LEVEL_INFO[5];

  const postSwitchTrials = safeNumber(
    metrics.postSwitchTrials ?? metrics.switchTrials ?? result?.postSwitchTrials ?? result?.switchTrials,
    0
  );
  const interferenceTrials = safeNumber(
    metrics.interferenceTrials ?? result?.interferenceTrials,
    0
  );

  const hasSwitchData = postSwitchTrials > 0;
  const hasInterferenceData = interferenceTrials > 0 || level >= 8;

  const stars = getStarCount(result?.stars);
  const training = isTrainingResult(payload);
  const starStatus = training
    ? TRAINING_STAR_STATUS[stars] || TRAINING_STAR_STATUS[1]
    : STAR_STATUS[stars] || STAR_STATUS[1];
  const levelGroup = level <= 4
    ? TRAINING_LEVEL_GROUPS.basic
    : level <= 7
    ? TRAINING_LEVEL_GROUPS.switch
    : TRAINING_LEVEL_GROUPS.interference;

  return {
    level,
    levelInfo,
    recommendedLevel,
    recommendedInfo,
    hasSwitchData,
    hasInterferenceData,
    stars,
    starStatus,
    training,
    levelGroup,
  };
}

function buildTrainingInterpretation(result, context) {
  const accuracy = percent(result?.accuracy);
  const postSwitch = percent(result?.postSwitchAccuracy ?? result?.switchAccuracy);
  const oldRuleErrors = safeNumber(result?.perseverativeErrors ?? result?.oldRuleInterference, 0);
  const totalTrials = safeNumber(result?.totalTrials ?? result?.clinicianMetrics?.totalTrials, 0);

  if (totalTrials < 4) {
    return {
      headline: "這次資料仍在累積",
      summary: "目前題數不足，還不適合解讀規則切換或干擾控制。",
      good: "孩子已經開始熟悉這次的分類玩法。",
      practice: "下一次先完成一個完整短回合，再一起看結果。",
    };
  }

  if (context.level <= 4) {
    const stable = accuracy >= 70;
    return {
      headline: stable ? "單一規則理解較穩定" : "單一規則仍在熟悉中",
      summary: stable
        ? "孩子大多能照目前規則分類，代表已逐漸抓到單一玩法。"
        : "孩子目前可能還在確認這一關要看顏色或看衣服種類，先不用急著進入換玩法。",
      good: stable ? "孩子已逐漸抓到目前的分類規則。" : "孩子願意完成任務，這就是後續練習的基礎。",
      practice: stable ? "可維持同關卡再確認一次，若仍穩定，再進入換玩法層級。" : "下一次建議維持或降低一關，先用短回合穩定知道「現在要看什麼」。",
    };
  }

  if (context.level <= 7) {
    const returnsToOldRule = oldRuleErrors >= 2;
    return {
      headline: returnsToOldRule ? "換玩法後容易回到剛剛的玩法" : "玩法改變時容易短暫混淆",
      summary: returnsToOldRule
        ? "孩子切換後可能仍使用上一個規則，這表示新規則維持還需要練習。"
        : `孩子已能完成部分分類，玩法改變後約 ${postSwitch}% 的題目能跟上，可能需要更多時間。`,
      good: "孩子已經有基本分類能力，並能完成部分切換題。",
      practice: returnsToOldRule
        ? "下一次先維持目前或前一關，重點放在切換後持續提醒新規則。"
        : "下一次可先用明確口語提示：「剛剛看顏色，現在換成看衣服。」",
    };
  }

  const stable = context.stars === 3 && oldRuleErrors <= 1;
  return {
    headline: stable ? "切換與干擾控制較平衡" : "容易被明顯線索拉回舊玩法",
    summary: stable
      ? "孩子能在規則改變與干擾增加時維持目前玩法，整體表現較穩定。"
      : "孩子可能知道新規則，但遇到顏色明顯或容易吸引注意的刺激時，會被舊玩法影響。",
    good: stable ? "孩子在玩法改變與干擾增加時，仍能維持目前規則。" : "孩子願意繼續嘗試新規則，這是後續練習的基礎。",
    practice: stable ? "可維持同層級再確認一次，若仍穩定，再小幅提高挑戰。" : "下一次建議先降低干擾或回到前一關，先練「看清楚現在規則再放」。",
  };
}

function buildParentInterpretation(result, context) {
  if (context.training) return buildTrainingInterpretation(result, context);
  const accuracy = percent(result?.accuracy);
  const postSwitch = percent(result?.postSwitchAccuracy ?? result?.switchAccuracy);
  const interferenceControl = percent(result?.interferenceControl);
  const oldRuleErrors = safeNumber(result?.perseverativeErrors ?? result?.oldRuleInterference, 0);

  if (context.stars === 3) {
    return {
      headline: context.hasSwitchData
        ? "孩子今天能跟上玩法改變"
        : "孩子今天能穩定照著玩法完成",
      summary: context.hasSwitchData
        ? "孩子不只知道怎麼分類，也能在玩法改變後慢慢改用新的方式。"
        : "孩子能理解這一關要看什麼，並且大多能穩定完成。",
      good: "孩子能記得目前的玩法，作答時也比較穩定。",
      practice: context.hasInterferenceData
        ? "接下來可以繼續練習有一點干擾的關卡，看看孩子能不能不被剛剛的玩法影響。"
        : "接下來可以慢慢加入『換玩法』練習，例如先看顏色，再改成看衣服種類。",
    };
  }

  if (context.stars === 2) {
    return {
      headline: "孩子今天正在練習中",
      summary: context.hasSwitchData
        ? `孩子已經有基本分類能力。玩法改變時，約 ${postSwitch}% 的切換題能跟上，還需要一點時間穩定。`
        : `孩子整體約 ${accuracy}% 的題目能完成，代表已經開始理解這一關的玩法。`,
      good: "孩子不是完全不會，而是需要在規則變化或題目變多時多練幾次。",
      practice: context.hasSwitchData
        ? "玩法從『看顏色』變成『看衣服』時，孩子可能會短暫混淆。"
        : "可以先把單一玩法練穩，再進入換玩法關卡。",
    };
  }

  return {
    headline: "今天可以先從簡單玩法開始",
    summary: context.hasSwitchData
      ? `孩子玩法改變時比較容易混淆，這次大約有 ${oldRuleErrors} 次可能還照剛剛的玩法做。`
      : "孩子目前對這一關的分類玩法還需要更多熟悉時間。",
    good: "孩子願意完成任務，這就是後續練習的基礎。",
    practice: context.hasInterferenceData && interferenceControl > 0
      ? "孩子可能容易被明顯的顏色吸引，建議先降低干擾、縮短練習時間。"
      : "先不要一次給太多規則，讓孩子穩定知道『現在要看什麼』。",
  };
}

function ObservationCard({ icon, title, level, text, helper, active = true }) {
  return (
    <div
      className="dccs-observation-card"
      style={{ opacity: active ? 1 : 0.76 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ marginBottom: 6 }}>
            <span aria-hidden="true" style={{ marginRight: 8 }}>
              {icon}
            </span>
            {title}
          </h3>
          <p style={{ marginTop: 0 }}>{text}</p>
          {helper && (
            <p style={{ margin: "8px 0 0", color: "#8d6e63", fontWeight: 700 }}>
              {helper}
            </p>
          )}
        </div>

        <strong
          style={{
            color: active ? "#5d3220" : "#9e8b80",
            minWidth: 104,
            textAlign: "right",
          }}
        >
          {level}
        </strong>
      </div>
    </div>
  );
}

function ParentView({ payload, result, context, interpretation }) {
  const understandRule = getMetricValue(result, "understandRule", "ruleUnderstanding");
  const switchRule = getMetricValue(result, "switchRule", "cognitiveFlexibility");
  const avoidOldRule = getMetricValue(result, "avoidOldRule", "inhibitionControl");
  const stableResponse = getMetricValue(result, "stableResponse", "responseStability");

  const accuracy = percent(result?.accuracy);
  const correctCount = safeNumber(result?.correctCount ?? result?.clinicianMetrics?.correctCount, 0);
  const totalTrials = safeNumber(result?.totalTrials ?? result?.clinicianMetrics?.totalTrials, 0);
  const postSwitchAccuracy = percent(result?.postSwitchAccuracy ?? result?.switchAccuracy);
  const oldRuleErrors = safeNumber(result?.perseverativeErrors ?? result?.oldRuleInterference, 0);
  const newRuleMaintenance = context.hasSwitchData
    ? avoidOldRule > 0
      ? avoidOldRule
      : clamp(
          100 -
            (oldRuleErrors /
              Math.max(
                1,
                safeNumber(
                  result?.postSwitchTrials ??
                    result?.switchTrials ??
                    result?.clinicianMetrics?.postSwitchTrials ??
                    result?.clinicianMetrics?.switchTrials,
                  0
                )
              )) *
              100,
          0,
          100
        )
    : 0;

  const observations = [
    {
      title: "知道現在要看什麼",
      level: getReadableLevel(understandRule),
      text: "這是在看孩子有沒有抓到目前的玩法：現在是看顏色，還是看衣服種類。",
      helper: getApproxText(understandRule),
      active: true,
    },
    {
      title: "玩法改變後能不能跟上",
      level: context.hasSwitchData ? getReadableLevel(switchRule) : "這關還沒看這個",
      text: context.hasSwitchData
        ? "遊戲可能一開始看顏色，後來變成看衣服種類。這裡是在看孩子能不能跟著玩法一起改變。"
        : "這一關主要還在練單一玩法，所以先不判斷換玩法能力。",
      helper: context.hasSwitchData ? getApproxText(switchRule) : "等進入換玩法關卡後再觀察。",
      active: context.hasSwitchData,
    },
    {
      title: "會不會還照剛剛的玩法",
      level: context.hasInterferenceData ? getReadableLevel(avoidOldRule) : "這關還沒看這個",
      text: context.hasInterferenceData
        ? "玩法換了以後，有些孩子還會用上一輪的方法分類。這裡是在看孩子會不會被剛剛的玩法影響。"
        : "這一關還沒有明顯舊玩法干擾，所以不需要特別看這個。",
      helper: context.hasInterferenceData ? getApproxText(avoidOldRule) : "干擾關卡才會重點觀察。",
      active: context.hasInterferenceData,
    },
    {
      title: "能不能穩穩完成",
      level: getReadableLevel(stableResponse),
      text: "這不是看孩子有多快，而是看孩子能不能穩定完成，不是忽快忽慢或一直猜。",
      helper: getApproxText(stableResponse),
      active: true,
    },
  ];

  const quickStats = [
    {
      label: "目前關卡",
      value: `第 ${context.level} 關`,
      helper: context.levelInfo.title,
    },
    {
      label: "完成情形",
      value: totalTrials > 0 ? `${correctCount}/${totalTrials} 題` : "--",
      helper: "正確完成的分類題數",
    },
    {
      label: "整體正確率",
      value: `${accuracy}%`,
      helper: "有沒有照目前玩法分類",
    },
    {
      label: "建議練習",
      value: `第 ${context.recommendedLevel} 關`,
      helper: context.recommendedInfo.title,
    },
  ];

  const chartItems = [
    {
      label: "規則理解",
      value: understandRule,
      observed: true,
      helper: "知道目前要依顏色或衣服種類分類",
    },
    {
      label: "規則切換",
      value: switchRule,
      observed: context.hasSwitchData,
      helper: "玩法改變後能不能跟上",
    },
    {
      label: "新規則維持",
      value: newRuleMaintenance,
      observed: context.hasSwitchData,
      helper: "停止使用舊規則並持續依新規則分類",
    },
    {
      label: "作答穩定",
      value: stableResponse,
      observed: true,
      helper: "能不能穩定完成，不是看速度快慢",
    },
  ];

  const chartTone = (value) => {
    if (value >= 85) return "strong";
    if (value >= 70) return "steady";
    if (value >= 50) return "practice";
    return "support";
  };

  const strengthItem = chartItems
    .filter((item) => item.observed)
    .sort((a, b) => b.value - a.value)[0];
  const practiceItem = chartItems
    .filter((item) => item.observed)
    .sort((a, b) => a.value - b.value)[0];

  const strengthText = strengthItem
    ? `${strengthItem.label}是本次相對穩定的表現：${strengthItem.helper}。`
    : interpretation.good;
  const practiceText =
    practiceItem?.label === "新規則維持" && oldRuleErrors > 0
      ? `這次約有 ${oldRuleErrors} 次可能仍照剛剛的玩法分類，表示孩子在轉換並維持新規則上還需要練習。`
      : practiceItem
      ? `${practiceItem.label}是下一次可以繼續練習的方向：${practiceItem.helper}。`
      : interpretation.practice;

  const highlights = [
    {
      badge: understandRule >= 70 ? "✓" : "△",
      tone: understandRule >= 70 ? "good" : "watch",
      title: "先確認玩法",
      text: understandRule >= 70
        ? context.levelInfo.parentText
        : "孩子可能還需要更多提示，先確認他知道現在要看哪一個特徵。",
    },
    {
      badge: context.hasSwitchData ? (postSwitchAccuracy >= 70 ? "✓" : "△") : "☆",
      tone: context.hasSwitchData ? (postSwitchAccuracy >= 70 ? "good" : "watch") : "neutral",
      title: "換玩法反應",
      text: context.hasSwitchData
        ? postSwitchAccuracy >= 70
          ? `玩法改變後約 ${postSwitchAccuracy}% 的題目能跟上。`
          : "玩法從「看顏色」變成「看衣服」時，孩子可能會短暫混淆。"
        : "這一關主要還在看單一玩法，換玩法能力會在後面關卡觀察。",
    },
    {
      badge: context.hasInterferenceData ? (oldRuleErrors <= 1 ? "✓" : "!") : "☆",
      tone: context.hasInterferenceData ? (oldRuleErrors <= 1 ? "good" : "alert") : "neutral",
      title: "避免舊玩法干擾",
      text: context.hasInterferenceData
        ? oldRuleErrors <= 1
          ? "這次孩子較少還照剛剛的玩法做。"
          : `這次約有 ${oldRuleErrors} 次可能還照剛剛的玩法做。`
        : "這一關還沒有明顯干擾，先不用把這項當成主要表現。",
    },
  ];

  return (
    <>
      <section className="dccs-overview-card">
        <div className="dccs-overview-left">
          <div className="dccs-score-circle" aria-label={`整體正確率 ${accuracy}%`}>
            <span className="dccs-score-number">{accuracy}</span>
            <span className="dccs-score-unit">%</span>
          </div>

          <div className="dccs-overview-text-box">
            <p className="dccs-overview-label">這次分類挑戰</p>
            <h2 className="dccs-overview-title">{interpretation.headline}</h2>
            <p className="dccs-overview-desc">{interpretation.summary}</p>
          </div>
        </div>

        <div className="dccs-star-summary">
          <div className="dccs-star-row" aria-label={`${context.stars} 顆星`}>
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={`dccs-star-chip ${star <= context.stars ? "is-on" : ""}`}
              >
                ★
              </span>
            ))}
          </div>
          <p>{context.starStatus.label}</p>
          <small>星星代表本次需要協助的程度，請搭配下方說明一起看。</small>
        </div>
      </section>

      <section className="dccs-performance-chart" aria-labelledby="dccs-chart-title">
        <div className="dccs-chart-heading">
          <div>
            <p className="dccs-card-label">本次遊戲觀察</p>
            <h2 id="dccs-chart-title" className="dccs-section-title">四項表現</h2>
          </div>
          <span className="dccs-level-chip">任務關卡・第 {context.level} 關</span>
        </div>

        <div className="dccs-chart-list">
          {chartItems.map((item) => (
            <div
              key={item.label}
              className={`dccs-chart-row ${item.observed ? "" : "is-unobserved"}`}
            >
              <div className="dccs-chart-copy">
                <strong>{item.label}</strong>
                <small>{item.observed ? item.helper : "本關尚未觀察"}</small>
              </div>
              <div className="dccs-chart-meter-wrap">
                <div
                  className="dccs-chart-meter"
                  role="progressbar"
                  aria-label={item.label}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={item.observed ? Math.round(item.value) : undefined}
                  aria-valuetext={item.observed ? `${Math.round(item.value)}%` : "本關尚未觀察"}
                >
                  <span
                    className={`dccs-chart-fill ${item.observed ? chartTone(item.value) : ""}`}
                    style={{ width: item.observed ? `${clamp(item.value, 0, 100)}%` : "0%" }}
                  />
                </div>
                <span className="dccs-chart-value">
                  {item.observed ? `${Math.round(item.value)}%` : "尚未觀察"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="dccs-chart-footnote">
          圖表呈現的是本次任務表現；灰色項目代表目前關卡沒有足夠資料，不代表能力為零。
        </p>
      </section>

      <section className="dccs-result-highlights" aria-label="本次重點摘要">
        <article className="dccs-result-highlight is-strength">
          <span aria-hidden="true">✓</span>
          <div>
            <h2>本次亮點</h2>
            <p>{strengthText}</p>
          </div>
        </article>
        <article className="dccs-result-highlight is-practice">
          <span aria-hidden="true">△</span>
          <div>
            <h2>練習重點</h2>
            <p>{practiceText}</p>
          </div>
        </article>
      </section>

      <section className="dccs-next-card">
        <p className="dccs-card-label">下一次可以這樣做</p>
        <h2 className="dccs-section-title">
          建議先練第 {context.recommendedLevel} 關：{context.recommendedInfo.title}
        </h2>
        <p>
          這一關重點是「{context.recommendedInfo.focus}」。{context.recommendedInfo.homeTip}
          {context.training && context.recommendedLevel > context.level
            ? " 孩子本次表現較穩定，可以考慮小幅增加挑戰；但仍建議先用短回合確認。"
            : context.training && context.recommendedLevel < context.level
            ? " 這次可能需要多一點提示，下一次可先回到較簡單關卡，讓孩子重新建立成功經驗。"
            : context.training
            ? " 先維持目前關卡累積 2 到 3 次結果，再判斷是否調整。"
            : " 建議搭配多次結果觀察，不用依單次表現立即調整。"}
        </p>
      </section>

      <details className="dccs-details-panel">
        <summary>查看詳細說明與居家練習</summary>
        <div className="dccs-details-content">
          <section className="dccs-quick-stats" aria-label="本次數據摘要">
            {quickStats.map((item) => (
              <article key={item.label} className="dccs-stat-card">
                <p className="dccs-stat-label">{item.label}</p>
                <p className="dccs-stat-value">{item.value}</p>
                <p className="dccs-stat-helper">{item.helper}</p>
              </article>
            ))}
          </section>

          <section className="dccs-panel-block">
            <h2 className="dccs-section-title">家長快速解讀</h2>
            <p className="dccs-parent-summary-text">
              {context.training
                ? `這次屬於「${context.levelGroup.label}」訓練。${context.levelGroup.detail}`
                : context.level <= 4
                ? "這一關還在練單一玩法。家長可以先看孩子是否知道現在要看顏色或看衣服，不用急著解讀換玩法能力。"
                : context.level <= 7
                ? "這一關開始練玩法改變。重點是孩子能不能從『看顏色』改成『看衣服種類』。"
                : "這一關加入干擾。重點是孩子能不能記得現在的玩法，不被剛剛的玩法拉回去。"}
            </p>
          </section>

          <section className="dccs-panel-block">
            <h2 className="dccs-section-title">家長可以這樣看</h2>
            <div className="dccs-highlight-grid">
              {highlights.map((item) => (
                <article key={item.title} className="dccs-observation-card">
                  <div className="dccs-observation-top">
                    <span className={`dccs-status-pill ${item.tone}`}>{item.badge}</span>
                    <div>
                      <p className="dccs-card-label">觀察重點</p>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dccs-panel-block">
            <h2 className="dccs-section-title">四項表現怎麼看</h2>
            <div className="dccs-indicator-grid">
              {observations.map((card) => (
                <ObservationCard key={card.title} {...card} />
              ))}
            </div>
          </section>
        </div>
      </details>

      <section className="dccs-note-box">
        <h3>給家長的小提醒</h3>
        <p>
          這份結果是本次遊戲中的觀察紀錄，可以幫助了解孩子在「記住分類規則、切換分類規則、避免舊規則干擾」時的狀況；不代表醫療診斷，建議搭配多次練習一起觀察。
        </p>
      </section>
    </>
  );
}


const resultPageCss = `
:root {
  --dccs-honey: #e7a62f;
  --dccs-honey-dark: #b87818;
  --dccs-cream: #fffaf0;
  --dccs-cream-deep: #f6ead4;
  --dccs-sky: #65b8e8;
  --dccs-sky-soft: #eaf6fd;
  --dccs-leaf: #739a48;
  --dccs-leaf-soft: #eef5e6;
  --dccs-coral: #e98f7d;
  --dccs-coral-soft: #fff0ec;
  --dccs-wood: #6b4226;
  --dccs-wood-soft: #8a5a34;
  --dccs-line: #ead8b7;
}

.dccs-result-page {
  width: 100%;
  min-height: 100dvh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: clamp(12px, 2.4vw, 30px);
  box-sizing: border-box;
  font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
  color: var(--dccs-wood);
}

.dccs-result-main-card {
  width: min(1180px, 100%);
  min-height: calc(100dvh - clamp(24px, 4.8vw, 60px));
  margin: 0 auto;
  background: rgba(255, 250, 240, 0.97);
  border: 1px solid rgba(194, 139, 68, 0.45);
  border-radius: 22px;
  box-shadow: 0 18px 44px rgba(99, 67, 30, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dccs-result-header {
  padding: clamp(22px, 4vw, 38px) clamp(18px, 4vw, 42px) 22px;
  border-bottom: 1px solid var(--dccs-line);
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,248,232,.94));
}

.dccs-mode-tag {
  display: inline-flex;
  margin: 0 0 9px;
  padding: 6px 12px;
  border-radius: 7px;
  background: var(--dccs-sky-soft);
  border: 1px solid #b9dff4;
  color: #3b7799;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .04em;
}

.dccs-result-main-title {
  margin: 0;
  color: var(--dccs-wood);
  font-size: clamp(27px, 4vw, 42px);
  font-weight: 900;
  line-height: 1.22;
}

.dccs-result-subtitle {
  margin: 10px 0 0;
  color: var(--dccs-wood-soft);
  font-size: clamp(15px, 1.7vw, 19px);
  font-weight: 650;
}

.dccs-parent-panel {
  flex: 1;
  padding: clamp(16px, 3vw, 34px);
}

.dccs-overview-card,
.dccs-panel-block,
.dccs-next-card,
.dccs-note-box,
.dccs-performance-chart,
.dccs-details-panel {
  background: rgba(255,255,255,.96);
  border: 1px solid var(--dccs-line);
  border-radius: 15px;
  box-shadow: 0 5px 16px rgba(108, 72, 31, .07);
}

.dccs-overview-card {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 24px;
  padding: clamp(20px, 3vw, 30px);
  margin-bottom: 22px;
  border-top: 5px solid var(--dccs-honey);
}

.dccs-overview-left {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.dccs-score-circle {
  width: 132px;
  height: 132px;
  min-width: 132px;
  border-radius: 18px;
  background: linear-gradient(160deg, #7fc9ef, var(--dccs-sky));
  border: 3px solid #fff;
  outline: 1px solid #9fd5ef;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  box-shadow: 0 8px 18px rgba(57, 137, 181, .22);
}

.dccs-score-number { font-size: 48px; font-weight: 900; line-height: 1; }
.dccs-score-unit { font-size: 20px; font-weight: 800; align-self: flex-end; margin-bottom: 30px; }

.dccs-overview-label,
.dccs-card-label,
.dccs-stat-label {
  margin: 0 0 7px;
  color: #8d6745;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .03em;
}

.dccs-overview-title {
  margin: 0 0 10px;
  color: var(--dccs-wood);
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 900;
  line-height: 1.25;
}

.dccs-overview-desc,
.dccs-parent-summary-text,
.dccs-parent-intro,
.dccs-observation-card p,
.dccs-next-card p,
.dccs-note-box p {
  margin: 0;
  color: #6f5743;
  font-size: clamp(15px, 1.7vw, 18px);
  font-weight: 500;
  line-height: 1.75;
}

.dccs-star-summary {
  flex: 0 0 220px;
  padding: 20px;
  border-radius: 13px;
  background: linear-gradient(180deg, #fff8df, #fff3cf);
  border: 1px solid #efd28d;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.dccs-star-row { display: flex; justify-content: center; gap: 8px; }
.dccs-star-chip { color: #d9c8a7; font-size: 30px; line-height: 1; }
.dccs-star-chip.is-on { color: var(--dccs-honey); }
.dccs-star-summary p { margin: 0; color: var(--dccs-wood); font-size: 15px; font-weight: 800; }
.dccs-star-summary small { color: #8a6a4d; font-size: 12px; line-height: 1.5; }

.dccs-performance-chart {
  padding: clamp(20px, 3vw, 30px);
  margin-bottom: 22px;
  border-top: 5px solid var(--dccs-sky);
}

.dccs-chart-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}

.dccs-chart-heading .dccs-section-title { margin-bottom: 0; }

.dccs-level-chip {
  flex: 0 0 auto;
  padding: 8px 13px;
  border-radius: 999px;
  background: var(--dccs-sky-soft);
  border: 1px solid #b9dff4;
  color: #3b7799;
  font-size: 13px;
  font-weight: 850;
}

.dccs-chart-list { display: grid; gap: 20px; }

.dccs-chart-row {
  display: grid;
  grid-template-columns: minmax(180px, .8fr) minmax(280px, 1.8fr);
  gap: 24px;
  align-items: center;
}

.dccs-chart-copy { display: grid; gap: 4px; }
.dccs-chart-copy strong { color: var(--dccs-wood); font-size: 17px; font-weight: 900; }
.dccs-chart-copy small { color: #866d58; font-size: 13px; line-height: 1.45; }

.dccs-chart-meter-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 78px;
  gap: 12px;
  align-items: center;
}

.dccs-chart-meter {
  height: 18px;
  overflow: hidden;
  border-radius: 999px;
  background: #eee7dc;
  box-shadow: inset 0 1px 2px rgba(83, 57, 32, .12);
}

.dccs-chart-fill {
  display: block;
  height: 100%;
  min-width: 4px;
  border-radius: inherit;
  transition: width .35s ease;
}
.dccs-chart-fill.strong { background: #6f9c47; }
.dccs-chart-fill.steady { background: #65b8e8; }
.dccs-chart-fill.practice { background: #e7a62f; }
.dccs-chart-fill.support { background: #e98f7d; }
.dccs-chart-row.is-unobserved .dccs-chart-meter { background: #e7e3de; }
.dccs-chart-row.is-unobserved .dccs-chart-copy { opacity: .7; }

.dccs-chart-value {
  color: var(--dccs-wood);
  font-size: 16px;
  font-weight: 900;
  text-align: right;
}
.dccs-chart-row.is-unobserved .dccs-chart-value { color: #8b8179; font-size: 12px; }

.dccs-chart-footnote {
  margin: 22px 0 0;
  padding-top: 14px;
  border-top: 1px solid #eadcc5;
  color: #846d5a;
  font-size: 13px;
  line-height: 1.6;
}

.dccs-result-highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.dccs-result-highlight {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 20px;
  border: 1px solid;
  border-radius: 15px;
}
.dccs-result-highlight > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 50%;
  font-weight: 900;
}
.dccs-result-highlight h2 { margin: 0 0 7px; color: var(--dccs-wood); font-size: 18px; font-weight: 900; }
.dccs-result-highlight p { margin: 0; color: #6f5743; font-size: 15px; line-height: 1.7; }
.dccs-result-highlight.is-strength { background: #f5faef; border-color: #cbdcaf; }
.dccs-result-highlight.is-strength > span { background: #dcebc8; color: #547731; }
.dccs-result-highlight.is-practice { background: #fff8e9; border-color: #ecd29a; }
.dccs-result-highlight.is-practice > span { background: #f7e5bb; color: #98651f; }

.dccs-details-panel {
  margin-bottom: 22px;
  overflow: hidden;
}

.dccs-details-panel > summary {
  position: relative;
  padding: 19px 54px 19px 22px;
  color: var(--dccs-wood);
  font-size: 17px;
  font-weight: 900;
  cursor: pointer;
  list-style: none;
}
.dccs-details-panel > summary::-webkit-details-marker { display: none; }
.dccs-details-panel > summary::after {
  content: "+";
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--dccs-honey-dark);
  font-size: 26px;
  line-height: 1;
}
.dccs-details-panel[open] > summary::after { content: "−"; }
.dccs-details-panel > summary:focus-visible { outline: 3px solid rgba(101,184,232,.38); outline-offset: -3px; }
.dccs-details-content { padding: 0 22px 22px; border-top: 1px solid var(--dccs-line); }
.dccs-details-content .dccs-quick-stats { margin-top: 22px; }
.dccs-details-content .dccs-panel-block { box-shadow: none; }

.dccs-quick-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.dccs-stat-card {
  min-height: 122px;
  padding: 18px;
  border-radius: 13px;
  background: #fff;
  border: 1px solid var(--dccs-line);
  border-top: 4px solid var(--dccs-leaf);
  box-sizing: border-box;
}
.dccs-stat-card:nth-child(2) { border-top-color: var(--dccs-sky); }
.dccs-stat-card:nth-child(3) { border-top-color: var(--dccs-honey); }
.dccs-stat-card:nth-child(4) { border-top-color: var(--dccs-coral); }
.dccs-stat-card:nth-child(5) { border-top-color: #9d7ac1; }
.dccs-stat-card:nth-child(6) { border-top-color: var(--dccs-leaf); }

.dccs-stat-value { margin: 0 0 7px; color: var(--dccs-wood); font-size: clamp(23px, 2.5vw, 30px); font-weight: 900; }
.dccs-stat-helper { margin: 0; color: #8b715b; font-size: 13px; line-height: 1.5; }

.dccs-panel-block,
.dccs-next-card,
.dccs-note-box { padding: clamp(18px, 3vw, 28px); margin-bottom: 22px; }
.dccs-section-title { margin: 0 0 12px; color: var(--dccs-wood); font-size: clamp(20px, 2.4vw, 25px); font-weight: 900; }

.dccs-highlight-grid,
.dccs-indicator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.dccs-indicator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.dccs-observation-card {
  padding: 18px;
  border-radius: 13px;
  background: #fffdf8;
  border: 1px solid #eadcc5;
  box-sizing: border-box;
}
.dccs-observation-card:nth-child(3n+1) { background: #fbfdf7; border-color: #d7e4c7; }
.dccs-observation-card:nth-child(3n+2) { background: #f7fcff; border-color: #cfe7f4; }
.dccs-observation-card:nth-child(3n) { background: #fff9f7; border-color: #f0d2ca; }

.dccs-observation-top { display: flex; gap: 11px; align-items: flex-start; margin-bottom: 12px; }
.dccs-observation-card h3,
.dccs-next-card h3,
.dccs-note-box h3 { margin: 0 0 7px; color: var(--dccs-wood); font-size: 18px; font-weight: 800; line-height: 1.4; }

.dccs-status-pill {
  flex: 0 0 auto;
  min-width: 38px;
  padding: 5px 9px;
  border-radius: 7px;
  background: #fff5df;
  border: 1px solid #edcf91;
  color: #98651f;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}
.dccs-status-pill.good { background: var(--dccs-leaf-soft); color: #547731; border-color: #c8dbaa; }
.dccs-status-pill.watch { background: #fff5df; color: #98651f; border-color: #edcf91; }
.dccs-status-pill.alert { background: var(--dccs-coral-soft); color: #a15343; border-color: #efc0b6; }
.dccs-status-pill.neutral { background: var(--dccs-sky-soft); color: #3d7898; border-color: #c5e2f2; }

.dccs-indicator-score { color: var(--dccs-wood) !important; font-size: 22px !important; font-weight: 900 !important; margin-bottom: 6px !important; }
.dccs-card-meaning { margin-top: 10px !important; padding-top: 10px; border-top: 1px solid #eadcc5; color: #7e6754 !important; font-size: 15px !important; }

.dccs-next-card {
  background: linear-gradient(180deg, #f7fbf2, #eef5e6);
  border-left: 5px solid var(--dccs-leaf);
}

.dccs-note-box {
  background: linear-gradient(180deg, #fffaf3, #fff5e5);
  box-shadow: none;
  border-left: 5px solid var(--dccs-honey);
}

.dccs-action-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(16px, 3vw, 30px);
  padding: 18px clamp(16px, 3vw, 32px) 24px;
  border-top: 1px solid var(--dccs-line);
  background: rgba(255,250,240,.98);
}

.dccs-image-button {
  width: clamp(148px, 18vw, 220px);
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 12px;
  line-height: 0;
  cursor: pointer;
  transition: transform .16s ease, filter .16s ease;
}
.dccs-image-button img { width: 100%; height: auto; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 5px 6px rgba(91,57,27,.2)); }
.dccs-image-button:hover { transform: translateY(-2px); filter: brightness(1.03); }
.dccs-image-button:active { transform: translateY(1px) scale(.98); }
.dccs-image-button:focus-visible { outline: 3px solid rgba(101,184,232,.38); outline-offset: 4px; }

@media (max-width: 980px) {
  .dccs-overview-card { flex-direction: column; }
  .dccs-star-summary { flex-basis: auto; }
  .dccs-quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dccs-highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .dccs-result-page { padding: 0; background-position: center top; }
  .dccs-result-main-card { min-height: 100dvh; border-radius: 0; border-left: 0; border-right: 0; box-shadow: none; }
  .dccs-result-header { padding: 20px 16px 17px; }
  .dccs-parent-panel { padding: 14px; }
  .dccs-overview-card { padding: 18px; gap: 18px; }
  .dccs-overview-left { align-items: flex-start; gap: 15px; }
  .dccs-score-circle { width: 96px; height: 96px; min-width: 96px; border-radius: 14px; }
  .dccs-score-number { font-size: 36px; }
  .dccs-score-unit { font-size: 16px; margin-bottom: 21px; }
  .dccs-quick-stats,
  .dccs-highlight-grid,
  .dccs-indicator-grid,
  .dccs-result-highlights { grid-template-columns: 1fr; }
  .dccs-chart-heading { align-items: flex-start; }
  .dccs-chart-row { grid-template-columns: 1fr; gap: 9px; }
  .dccs-chart-meter-wrap { grid-template-columns: minmax(0, 1fr) 72px; }
  .dccs-details-content { padding: 0 14px 14px; }
  .dccs-stat-card { min-height: auto; }
  .dccs-action-btns { position: sticky; bottom: 0; z-index: 10; gap: 12px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); box-shadow: 0 -5px 14px rgba(91,57,27,.09); }
  .dccs-image-button { width: min(44vw, 190px); }
}

@media (max-width: 420px) {
  .dccs-overview-left { flex-direction: column; }
  .dccs-score-circle { width: 100%; height: 82px; }
  .dccs-score-unit { align-self: center; margin: 13px 0 0; }
  .dccs-image-button { width: calc(50vw - 22px); }
}


.dccs-highlight-grid.two-cols {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dccs-image-button:disabled {
  cursor: default;
  opacity: .62;
}

.dccs-image-button:disabled:hover {
  transform: none;
  filter: none;
}
`


export default function ResultPage_DCCS() {
  const location = useLocation();
  const navigate = useNavigate();
  const actionLockRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const payload = useMemo(() => {
    const source = location.state || readStoredResult() || {};
    return normalizePayload(source);
  }, [location.state]);

  const result = useMemo(() => calculateDccsScore(payload), [payload]);
  const context = useMemo(() => getResultContext(payload, result), [payload, result]);
  const interpretation = useMemo(
    () => buildParentInterpretation(result, context),
    [result, context]
  );

  const leaveResultPage = (route, state = undefined) => {
    if (actionLockRef.current) return;

    actionLockRef.current = true;
    setIsNavigating(true);
    clearDccsResultCaches();
    navigate(route, state ? { state } : undefined);
  };

  const returnToForest = () => {
    if (actionLockRef.current) return;

    // 只有訓練結果可以累積並觸發帽子遊戲；正式測驗永遠直接回森林。
    if (!isTrainingResult(payload)) {
      leaveResultPage(TEST_MAP_ROUTE);
      return;
    }

    const childId = resolveChildId(payload);
    const shouldTrigger = shouldOpenHatGame(childId);

    if (!shouldTrigger) {
      leaveResultPage(MENU_ROUTE);
      return;
    }

    const rewardSessionId = createHatRewardSessionId(childId);

    leaveResultPage(HAT_GAME_ROUTE, {
      childId,
      rewardSessionId,
      sessionId: rewardSessionId,
      sourceGame: "DCCS",
      sourceMode: "training",
      returnRoute: MENU_ROUTE,
      fromResultPage: true,
    });
  };

  const startRecommendedTraining = () => {
    const safeRecommendedLevel = getSafeTrainingLevel(context?.recommendedLevel, 5);

    leaveResultPage(TRAINING_ROUTE, {
      trainingLevel: safeRecommendedLevel,
      trainingOrder: safeRecommendedLevel,
      trainingTotal: 10,
      difficultyLabel: `第 ${safeRecommendedLevel} 關`,
      fromResult: true,
    });
  };

  return (
    <div
      className="dccs-result-page"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)), url(${bgImg})`,
      }}
    >
      <style>{resultPageCss}</style>

      <main className="dccs-result-main-card">
        <header className="dccs-result-header">
          <p className="dccs-mode-tag">{isTrainingResult(payload) ? "訓練結果" : "測驗結果"}</p>
          <h1 className="dccs-result-main-title">分類挑戰完成</h1>
          <p className="dccs-result-subtitle">
            了解孩子在規則理解、規則切換與避免舊規則干擾上的本次表現。
          </p>
        </header>

        <section className="dccs-parent-panel">
          <ParentView
            payload={payload}
            result={result}
            context={context}
            interpretation={interpretation}
          />
        </section>

        <footer className="dccs-action-btns">
          <button
            type="button"
            className="dccs-image-button"
            onClick={returnToForest}
            disabled={isNavigating}
            aria-label="回到森林"
          >
            <img width={1024} height={341} src={homeBackBtn} alt="回到森林" />
          </button>

          {isTrainingResult(payload) && (
            <button
              type="button"
              className="dccs-image-button"
              onClick={startRecommendedTraining}
              disabled={isNavigating}
              aria-label="play again"
            >
              <img width={1024} height={341} loading="lazy" src={homeAgainBtn} alt="play again" />
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
