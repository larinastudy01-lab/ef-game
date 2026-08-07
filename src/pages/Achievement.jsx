import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import gameCardBackground from "../asset/home/gamecard.webp";
import stickerR1 from "../asset/sticker/regular/R1.webp";
import stickerR2 from "../asset/sticker/regular/R2.webp";
import stickerR3 from "../asset/sticker/regular/R3.webp";
import stickerR4 from "../asset/sticker/regular/R4.webp";
import stickerR5 from "../asset/sticker/regular/R5.webp";
import stickerR6 from "../asset/sticker/regular/R6.webp";
import stickerR7 from "../asset/sticker/regular/R7.webp";
import stickerR8 from "../asset/sticker/regular/R8.webp";
import stickerR9 from "../asset/sticker/regular/R9.webp";
import stickerR10 from "../asset/sticker/regular/R10.webp";
import stickerR11 from "../asset/sticker/regular/R11.webp";
import stickerR12 from "../asset/sticker/regular/R12.webp";
import stickerR13 from "../asset/sticker/regular/R13.webp";
import stickerR14 from "../asset/sticker/regular/R14.webp";
import stickerR15 from "../asset/sticker/regular/R15.webp";
import stickerR16 from "../asset/sticker/regular/R16.webp";
import stickerR17 from "../asset/sticker/regular/R17.webp";
import stickerR18 from "../asset/sticker/regular/R18.webp";
import stickerR19 from "../asset/sticker/regular/R19.webp";
import stickerR20 from "../asset/sticker/regular/R20.webp";
import stickerR21 from "../asset/sticker/regular/R21.webp";
import stickerR22 from "../asset/sticker/regular/R22.webp";
import stickerR23 from "../asset/sticker/regular/R23.webp";
import srtGameIcon from "../asset/SRT_icon.webp";
import pmGameIcon from "../asset/PM_icon.webp";
import cbtGameIcon from "../asset/CBT_icon.webp";
import ssgGameIcon from "../asset/SSG_icon.webp";
import dccsGameIcon from "../asset/DCCS_icon.webp";
import lbGameIcon from "../asset/LB_icon.webp";

const MENU_ROUTE = "/game-menu";
const GAME_IDS = ["SRT", "PM", "CBT", "SSG", "DCCS", "LB"];
const MAX_LEDGER_SESSIONS = 500;

const LEVEL_META = [
  { level: 1, folder: "level01", name: "銅級", shortName: "銅" },
  { level: 2, folder: "level02", name: "銀級", shortName: "銀" },
  { level: 3, folder: "level03", name: "金級", shortName: "金" },
  { level: 4, folder: "level04", name: "鑽石級", shortName: "鑽" },
  { level: 5, folder: "level05", name: "星耀級", shortName: "星" },
];

const CATEGORY_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "general", label: "綜合" },
  { id: "SRT", label: "SRT" },
  { id: "PM", label: "PM" },
  { id: "CBT", label: "CBT" },
  { id: "SSG", label: "SSG" },
  { id: "DCCS", label: "DCCS" },
  { id: "LB", label: "LB" },
];

const ACHIEVEMENTS = [
  {
    id: "training_journey",
    name: "森林第一步",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "累積完成訓練次數",
    thresholds: [1, 5, 20, 50, 100],
    unit: "次",
    metric: "trainingSessions",
  },
  {
    id: "game_explorer",
    name: "六項任務探索家",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "至少完成過幾種不同遊戲",
    thresholds: [1, 2, 3, 4, 6],
    unit: "種",
    metric: "exploredGames",
  },
  {
    id: "star_collector",
    name: "星星收藏家",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "累積獲得星星數",
    thresholds: [5, 20, 50, 100, 200],
    unit: "顆",
    metric: "totalStars",
  },
  {
    id: "three_star_master",
    name: "三星榮耀",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "累積獲得三星的訓練次數",
    thresholds: [1, 5, 15, 30, 60],
    unit: "次",
    metric: "threeStarSessions",
  },
  {
    id: "correct_answer_total",
    name: "精準累積者",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "六種遊戲累積答對題數",
    thresholds: [20, 100, 300, 700, 1500],
    unit: "題",
    metric: "totalCorrectAnswers",
  },
  {
    id: "perfect_session",
    name: "完美任務",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "完成正確率 100% 的訓練",
    thresholds: [1, 3, 8, 15, 30],
    unit: "次",
    metric: "perfectSessions",
  },
  {
    id: "no_timeout_session",
    name: "從容完成者",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "完成整場零逾時的訓練",
    thresholds: [1, 5, 15, 30, 60],
    unit: "次",
    metric: "noTimeoutSessions",
  },
  {
    id: "training_days",
    name: "森林足跡",
    category: "general",
    categoryLabel: "綜合訓練",
    description: "累積在不同日期完成訓練",
    thresholds: [1, 3, 7, 14, 30],
    unit: "天",
    metric: "trainingDays",
  },
  {
    id: "srt_acorn_guardian",
    name: "橡實守護者",
    category: "SRT",
    categoryLabel: "SRT 橡實注意力",
    description: "累積正確點擊目標橡實次數",
    thresholds: [20, 60, 150, 300, 600],
    unit: "次",
    metric: "srtAcornHits",
  },
  {
    id: "srt_rotten_resistance",
    name: "壞橡實辨識家",
    category: "SRT",
    categoryLabel: "SRT 橡實注意力",
    description: "完成沒有點到壞橡實且正確率達 80% 的訓練",
    thresholds: [1, 3, 8, 15, 30],
    unit: "次",
    metric: "srtRottenResistanceSessions",
  },
  {
    id: "pm_memory_span",
    name: "圖片記憶家",
    category: "PM",
    categoryLabel: "PM 圖片記憶",
    description: "單題成功記住的最高圖片數量",
    thresholds: [2, 3, 4, 5, 6],
    unit: "張",
    metric: "pmHighestMemorySpan",
  },
  {
    id: "pm_careful_selector",
    name: "細心選圖家",
    category: "PM",
    categoryLabel: "PM 圖片記憶",
    description: "累積完成答對且沒有誤點或取消的題目",
    thresholds: [5, 15, 40, 80, 150],
    unit: "題",
    metric: "pmCarefulSelections",
  },
  {
    id: "cbt_memory_span",
    name: "石頭路記憶家",
    category: "CBT",
    categoryLabel: "CBT 石頭路空間記憶",
    description: "無提示正確完成的最高序列長度",
    thresholds: [3, 4, 5, 6, 7],
    unit: "格",
    metric: "cbtHighestCleanSpan",
  },
  {
    id: "cbt_clean_path",
    name: "一次走對",
    category: "CBT",
    categoryLabel: "CBT 石頭路空間記憶",
    description: "累積無重播、無提示、無救援且答對的題目",
    thresholds: [5, 15, 40, 80, 150],
    unit: "題",
    metric: "cbtCleanPaths",
  },
  {
    id: "ssg_opposite_master",
    name: "聲音反轉家",
    category: "SSG",
    categoryLabel: "SSG 貓狗聲音抑制",
    description: "累積依照聲音正確選擇相反動物",
    thresholds: [10, 30, 80, 160, 320],
    unit: "題",
    metric: "ssgCorrectOpposites",
  },
  {
    id: "ssg_inhibition_master",
    name: "抑制小高手",
    category: "SSG",
    categoryLabel: "SSG 貓狗聲音抑制",
    description: "完成零搶答、零同動物錯誤且正確率達 80% 的訓練",
    thresholds: [1, 3, 8, 15, 30],
    unit: "次",
    metric: "ssgInhibitionSessions",
  },
  {
    id: "dccs_rule_switcher",
    name: "規則切換家",
    category: "DCCS",
    categoryLabel: "DCCS 衣物分類",
    description: "累積答對規則切換後的題目",
    thresholds: [5, 15, 40, 80, 150],
    unit: "題",
    metric: "dccsCorrectSwitchTrials",
  },
  {
    id: "dccs_bag_color_master",
    name: "袋中顏色家",
    category: "DCCS",
    categoryLabel: "DCCS 衣物分類",
    description: "累積答對裝袋後依顏色分類的題目",
    thresholds: [3, 10, 25, 50, 100],
    unit: "題",
    metric: "dccsCorrectBagColorTrials",
  },
  {
    id: "lb_doorplate_navigator",
    name: "門牌導航員",
    category: "LB",
    categoryLabel: "LB 數字門牌",
    description: "累積依正確順序點擊門牌",
    thresholds: [20, 60, 150, 300, 600],
    unit: "次",
    metric: "lbCorrectSteps",
  },
  {
    id: "lb_forest_mission",
    name: "森林任務王",
    category: "LB",
    categoryLabel: "LB 數字門牌",
    description: "以至少二星完成指定最高關卡",
    thresholds: [1, 3, 6, 10, 12],
    unit: "關",
    metric: "lbHighestTwoStarLevel",
    thresholdLabels: ["第 1 關", "第 3 關", "第 6 關", "第 10 關", "第 12 關"],
  },
];

const STICKER_CATALOG = [
  { id: "R1", image: stickerR1, name: "蜂蜜小熊" },
  { id: "R2", image: stickerR2, name: "森林狐狸" },
  { id: "R3", image: stickerR3, name: "快樂小雞" },
  { id: "R4", image: stickerR4, name: "森林小兔" },
  { id: "R5", image: stickerR5, name: "花角小鹿" },
  { id: "R6", image: stickerR6, name: "藍羽小鳥" },
  { id: "R7", image: stickerR7, name: "點心狐狸" },
  { id: "R8", image: stickerR8, name: "蜂蜜刺蝟" },
  { id: "R9", image: stickerR9, name: "勤勞蜜蜂" },
  { id: "R10", image: stickerR10, name: "森林花朵" },
  { id: "R11", image: stickerR11, name: "森林木屋" },
  { id: "R12", image: stickerR12, name: "蜂蜜小屋" },
  { id: "R13", image: stickerR13, name: "蜂蜜罐" },
  { id: "R14", image: stickerR14, name: "花朵提籃" },
  { id: "R15", image: stickerR15, name: "森林樹樁" },
  { id: "R16", image: stickerR16, name: "溫暖提燈" },
  { id: "R17", image: stickerR17, name: "森林松鼠" },
  { id: "R18", image: stickerR18, name: "花朵刺蝟" },
  { id: "R19", image: stickerR19, name: "智慧貓頭鷹" },
  { id: "R20", image: stickerR20, name: "池塘青蛙" },
  { id: "R21", image: stickerR21, name: "紅色蘑菇" },
  { id: "R22", image: stickerR22, name: "向日葵花束" },
  { id: "R23", image: stickerR23, name: "森林寶箱" },
];

// achievement/level01～level05 內的檔名需與 ACHIEVEMENTS 的 id 相同。
const achievementImageContext = require.context(
  "../asset/sticker/achievement",
  true,
  /\.webp$/
);

function safeJsonParse(value, fallback = null) {
  try {
    if (value === null || value === undefined || value === "") return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function finiteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number >= 0 && number <= 1) return number * 100;
  return clamp(number, 0, 100);
}

function normalizeStoredId(value) {
  if (!value || value === "null" || value === "undefined") return null;
  const parsed = safeJsonParse(value, value);
  if (typeof parsed === "string" || typeof parsed === "number") {
    return String(parsed);
  }
  return null;
}

function resolveChildId() {
  if (typeof window === "undefined") return "unassigned";

  const directKeys = [
    "currentChildId",
    "selectedChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of directKeys) {
    const id = normalizeStoredId(window.localStorage.getItem(key));
    if (id) return id;
  }

  const objectKeys = ["currentChild", "selectedChild", "activeChild"];

  for (const key of objectKeys) {
    const child = safeJsonParse(window.localStorage.getItem(key), null);
    const id =
      child?.childId ||
      child?.id ||
      child?.patientId ||
      child?.profileId;

    if (id) return String(id);
  }

  return "unassigned";
}

function inferGameId(raw, sourceKey = "") {
  const text = [
    raw?.gameId,
    raw?.gameKey,
    raw?.task,
    raw?.taskCode,
    raw?.taskName,
    raw?.startedFrom,
    raw?.route,
    sourceKey,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (text.includes("DCCS")) return "DCCS";
  if (text.includes("SSG")) return "SSG";
  if (text.includes("CBT") || text.includes("CORSI")) return "CBT";
  if (
    text.includes("SRT") ||
    text.includes("SIMPLE REACTION") ||
    text.includes("ACORN")
  ) {
    return "SRT";
  }
  if (
    text.includes("PM_TRAINING") ||
    text.includes("PICTURE MEMORY") ||
    text.includes("PICTURE-MEMORY") ||
    /(^|[^A-Z])PM([^A-Z]|$)/.test(text)
  ) {
    return "PM";
  }
  if (
    text.includes("LINKING BALLOONS") ||
    text.includes("DOORPLATE") ||
    /(^|[^A-Z])LB([^A-Z]|$)/.test(text)
  ) {
    return "LB";
  }

  return null;
}

function inferMode(raw, sourceKey = "") {
  const directMode = String(
    raw?.mode ||
      raw?.config?.mode ||
      raw?.scoringMode ||
      raw?.sourceMode ||
      ""
  ).toLowerCase();
  const keyText = String(sourceKey).toLowerCase();

  if (
    directMode.includes("training") ||
    directMode.includes("train") ||
    directMode.includes("練習") ||
    directMode.includes("訓練")
  ) {
    return "training";
  }

  if (directMode.includes("test") || directMode.includes("測驗")) {
    return "test";
  }

  if (keyText.includes("training") || keyText.includes("訓練")) {
    return "training";
  }

  if (keyText.includes("test") || keyText.includes("測驗")) {
    return "test";
  }

  return null;
}

function isTrialLike(raw) {
  if (!raw || typeof raw !== "object") return false;

  const hasTrialIdentity =
    raw.trialIndex !== undefined ||
    raw.roundIndex !== undefined ||
    raw.trialId !== undefined ||
    raw.stepInLevel !== undefined;

  const hasSessionContainer =
    Array.isArray(raw.records) ||
    Array.isArray(raw.trials) ||
    Array.isArray(raw.trialLogs) ||
    Array.isArray(raw.logs) ||
    raw.scoring ||
    raw.summary;

  const hasSessionScore =
    raw.stars !== undefined ||
    raw.totalTrials !== undefined ||
    raw.correctCount !== undefined ||
    raw.correctTrials !== undefined;

  return hasTrialIdentity && !hasSessionContainer && !hasSessionScore;
}

function isResultCandidate(raw, sourceKey) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  if (isTrialLike(raw)) return false;

  const gameId = inferGameId(raw, sourceKey);
  const mode = inferMode(raw, sourceKey);

  if (!gameId || mode !== "training") return false;

  return Boolean(
    Array.isArray(raw.records) ||
      Array.isArray(raw.trials) ||
      Array.isArray(raw.trialLogs) ||
      Array.isArray(raw.logs) ||
      raw.scoring ||
      raw.summary ||
      raw.stars !== undefined ||
      raw.totalTrials !== undefined ||
      raw.correctCount !== undefined ||
      raw.correctTrials !== undefined ||
      raw.trainingLevel !== undefined ||
      raw.stageId ||
      raw.trainingStageId
  );
}

function collectResultCandidates(
  value,
  sourceKey,
  sourcePath,
  output,
  depth = 0
) {
  if (depth > 7 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.slice(0, 1000).forEach((item, index) => {
      collectResultCandidates(
        item,
        sourceKey,
        `${sourcePath}[${index}]`,
        output,
        depth + 1
      );
    });
    return;
  }

  if (typeof value !== "object") return;

  if (isResultCandidate(value, sourceKey)) {
    output.push({ raw: value, sourceKey, sourcePath });
    return;
  }

  Object.entries(value)
    .slice(0, 1000)
    .forEach(([key, nestedValue]) => {
      collectResultCandidates(
        nestedValue,
        sourceKey,
        sourcePath ? `${sourcePath}.${key}` : key,
        output,
        depth + 1
      );
    });
}

function isPotentialResultKey(key) {
  const text = String(key || "").toLowerCase();

  if (
    text.startsWith("achievementresultledger_") ||
    text.startsWith("hatstickercollection_") ||
    text.startsWith("hatstickerclaims_")
  ) {
    return false;
  }

  return [
    "result",
    "training",
    "history",
    "stage_stars",
    "srt",
    "picture",
    "pm",
    "cbt",
    "corsi",
    "ssg",
    "dccs",
    "lb",
  ].some((token) => text.includes(token));
}

function scanBrowserStorage() {
  if (typeof window === "undefined") return [];

  const candidates = [];
  const storages = [window.localStorage, window.sessionStorage];

  storages.forEach((storage) => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !isPotentialResultKey(key)) continue;

      const parsed = safeJsonParse(storage.getItem(key), null);
      if (parsed === null) continue;

      collectResultCandidates(parsed, key, key, candidates);
    }
  });

  return candidates;
}

function getRawRecords(raw) {
  const possibleArrays = [
    raw?.records,
    raw?.trials,
    raw?.trialLogs,
    raw?.logs,
    raw?.history,
    raw?.result?.records,
    raw?.scoring?.records,
  ];

  return possibleArrays.find(Array.isArray) || [];
}

function isCorrectRecord(record) {
  return Boolean(
    record?.isCorrect === true ||
      record?.correct === true ||
      record?.status === "correct" ||
      record?.result === "correct"
  );
}

function isTimeoutRecord(record) {
  return Boolean(
    record?.isTimeout === true ||
      record?.timeout === true ||
      record?.errorType === "timeout" ||
      record?.status === "timeout" ||
      record?.result === "timeout"
  );
}

function compactRecord(record) {
  return {
    isCorrect: isCorrectRecord(record),
    isTimeout: isTimeoutRecord(record),
    trainingAction: record?.trainingAction || null,
    targetType: record?.targetType || null,
    memorySpan: finiteNumber(record?.memorySpan, record?.memoryCount, record?.length),
    wrongTapCount: finiteNumber(record?.wrongTapCount, 0) || 0,
    deselectCount: finiteNumber(record?.deselectCount, 0) || 0,
    replayCount: finiteNumber(record?.replayCount, 0) || 0,
    idleHintShown: Boolean(record?.idleHintShown),
    rescueUsed: Boolean(record?.rescueUsed || record?.isRescueAttempt),
    cleanCorrect: Boolean(record?.cleanCorrect),
    errorType: record?.errorType || record?.wrongType || null,
    ruleStage: record?.ruleStage || record?.rule || null,
    wasAfterRuleSwitch: Boolean(
      record?.wasAfterRuleSwitch ||
        record?.isAfterSwitch ||
        record?.isPostSwitch
    ),
    isBagColorTrial: Boolean(
      record?.isBagColorTrial || record?.ruleStage === "bagColor"
    ),
    levelId: record?.levelId || null,
  };
}

function getCandidateStageId(candidate) {
  const raw = candidate.raw || {};
  const direct =
    raw.stageId ||
    raw.trainingStageId ||
    raw.session?.stageId ||
    raw.planStageId;

  if (direct) return String(direct);

  const sourceText = String(candidate.sourceKey || "").toLowerCase();
  if (
    sourceText.includes("stage_star") ||
    sourceText.includes("training_results") ||
    sourceText.includes("stage_result")
  ) {
    const pathParts = String(candidate.sourcePath || "").split(".");
    const tail = pathParts[pathParts.length - 1];
    if (tail && !tail.includes("[")) return tail;
  }

  return null;
}

function extractChildId(raw) {
  const value =
    raw?.childId ||
    raw?.child?.childId ||
    raw?.child?.id ||
    raw?.currentChild?.childId ||
    raw?.currentChild?.id ||
    raw?.patientId;

  if (!value || value === "current-child" || value === "unassigned") {
    return null;
  }

  return String(value);
}

function extractTimestamp(raw) {
  return (
    raw?.finishedAt ||
    raw?.completedAt ||
    raw?.generatedAt ||
    raw?.createdAt ||
    raw?.updatedAt ||
    raw?.timestamp ||
    raw?.summary?.generatedAt ||
    null
  );
}

function inferLevelFromStageId(stageId) {
  if (!stageId) return null;
  const matches = String(stageId).match(/(?:level|stage|關|_)(\d{1,2})(?!\d)/gi);
  if (!matches?.length) return null;
  const last = matches[matches.length - 1].match(/\d+/);
  return last ? Number(last[0]) : null;
}

function normalizeCandidate(candidate, currentChildId) {
  const raw = candidate.raw || {};
  const gameId = inferGameId(raw, candidate.sourceKey);
  if (!GAME_IDS.includes(gameId)) return null;

  const resultChildId = extractChildId(raw);
  if (
    resultChildId &&
    currentChildId !== "unassigned" &&
    resultChildId !== String(currentChildId)
  ) {
    return null;
  }

  const records = getRawRecords(raw).map(compactRecord);
  const stageId = getCandidateStageId(candidate);
  const timestamp = extractTimestamp(raw);
  const fallbackCorrect = records.filter((record) => record.isCorrect).length;
  const fallbackTimeout = records.filter((record) => record.isTimeout).length;

  const totalTrials = Math.max(
    0,
    Math.round(
      finiteNumber(
        raw?.totalTrials,
        raw?.summary?.totalTrials,
        raw?.scoring?.summary?.totalTrials,
        raw?.scoring?.totalTrials,
        raw?.expectedTrials,
        records.length,
        0
      ) || 0
    )
  );

  const correctCount = Math.max(
    0,
    Math.round(
      finiteNumber(
        raw?.correctCount,
        raw?.correctTrials,
        raw?.summary?.correctCount,
        raw?.summary?.correctTrials,
        raw?.scoring?.summary?.correctCount,
        raw?.scoring?.correctCount,
        fallbackCorrect,
        0
      ) || 0
    )
  );

  const timeoutCount = Math.max(
    0,
    Math.round(
      finiteNumber(
        raw?.timeoutCount,
        raw?.summary?.timeoutCount,
        raw?.scoring?.summary?.timeoutCount,
        raw?.errorTypes?.timeout,
        raw?.errorTypes?.miss,
        fallbackTimeout,
        0
      ) || 0
    )
  );

  const directAccuracy = finiteNumber(
    raw?.accuracyPercent,
    raw?.summary?.accuracyPercent,
    raw?.summary?.accuracy,
    raw?.scoring?.summary?.accuracyPercent,
    raw?.scoring?.accuracyPercent,
    raw?.accuracy
  );

  const accuracy =
    directAccuracy !== null
      ? normalizePercent(directAccuracy)
      : totalTrials > 0
      ? (correctCount / totalTrials) * 100
      : 0;

  const stars = clamp(
    Math.round(
      finiteNumber(
        raw?.stars,
        raw?.summary?.stars,
        raw?.scoring?.stars,
        raw?.scoring?.summary?.stars,
        0
      ) || 0
    ),
    0,
    3
  );

  const trainingLevel = Math.max(
    0,
    Math.round(
      finiteNumber(
        raw?.trainingLevel,
        raw?.trainingOrder,
        raw?.level,
        raw?.currentLevel,
        raw?.levelIndex !== undefined ? Number(raw.levelIndex) + 1 : null,
        inferLevelFromStageId(stageId),
        0
      ) || 0
    )
  );

  const explicitId =
    raw?.resultId ||
    raw?.trainingSessionId ||
    raw?.sessionId ||
    raw?.id ||
    raw?.session?.sessionId;

  let id;
  if (explicitId) {
    id = `${gameId}|id|${String(explicitId)}`;
  } else if (stageId) {
    id = `${gameId}|stage|${String(stageId)}`;
  } else if (timestamp) {
    id = `${gameId}|time|${String(timestamp)}|${trainingLevel}|${totalTrials}`;
  } else {
    id = `${gameId}|fallback|${candidate.sourcePath}|${trainingLevel}|${stars}`;
  }

  return {
    id,
    gameId,
    mode: "training",
    childId: resultChildId || currentChildId,
    stageId,
    timestamp,
    trainingLevel,
    stars,
    accuracy: Math.round(accuracy * 10) / 10,
    totalTrials,
    correctCount,
    timeoutCount,
    anticipationCount: Math.max(
      0,
      Math.round(
        finiteNumber(
          raw?.anticipationCount,
          raw?.scoring?.summary?.anticipationCount,
          raw?.errorTypes?.anticipation,
          records.filter((record) => record.errorType === "anticipation").length,
          0
        ) || 0
      )
    ),
    sameAnimalErrorCount: Math.max(
      0,
      Math.round(
        finiteNumber(
          raw?.sameAnimalErrorCount,
          raw?.scoring?.summary?.sameAnimalErrorCount,
          raw?.errorTypes?.sameAnimalError,
          records.filter((record) => record.errorType === "sameAnimalError").length,
          0
        ) || 0
      )
    ),
    rottenTotal: Math.max(
      0,
      Math.round(
        finiteNumber(
          raw?.rottenTotal,
          raw?.metrics?.rottenTotal,
          raw?.scoring?.summary?.rottenTotal,
          records.filter((record) => record.targetType === "rotten").length,
          0
        ) || 0
      )
    ),
    falseAlarmCount: Math.max(
      0,
      Math.round(
        finiteNumber(
          raw?.falseAlarmCount,
          raw?.clickedRottenCount,
          raw?.metrics?.falseAlarmCount,
          raw?.errorTypes?.wrongTarget,
          records.filter(
            (record) => record.trainingAction === "clickedRotten"
          ).length,
          0
        ) || 0
      )
    ),
    records,
    sourceKey: candidate.sourceKey,
  };
}

function sessionCompleteness(session) {
  return (
    session.records.length * 10 +
    session.totalTrials * 2 +
    (session.timestamp ? 5 : 0) +
    (session.stageId ? 3 : 0) +
    session.stars
  );
}

function mergeSessions(previous, incoming) {
  if (!previous) return incoming;
  if (!incoming) return previous;

  const richer =
    sessionCompleteness(incoming) >= sessionCompleteness(previous)
      ? incoming
      : previous;
  const other = richer === incoming ? previous : incoming;

  return {
    ...other,
    ...richer,
    records: richer.records.length ? richer.records : other.records,
    timestamp: richer.timestamp || other.timestamp,
    stageId: richer.stageId || other.stageId,
    trainingLevel: Math.max(
      Number(richer.trainingLevel || 0),
      Number(other.trainingLevel || 0)
    ),
    stars: Math.max(Number(richer.stars || 0), Number(other.stars || 0)),
  };
}

function ledgerStorageKey(childId) {
  return `achievementResultLedger_${childId}`;
}

function syncAchievementLedger(childId) {
  if (typeof window === "undefined") return [];

  const key = ledgerStorageKey(childId);
  const storedLedger = safeJsonParse(window.localStorage.getItem(key), []);
  const sessionMap = new Map();

  if (Array.isArray(storedLedger)) {
    storedLedger.forEach((session) => {
      if (session?.id && GAME_IDS.includes(session?.gameId)) {
        sessionMap.set(session.id, session);
      }
    });
  }

  scanBrowserStorage()
    .map((candidate) => normalizeCandidate(candidate, childId))
    .filter(Boolean)
    .forEach((session) => {
      sessionMap.set(
        session.id,
        mergeSessions(sessionMap.get(session.id), session)
      );
    });

  const mergedLedger = Array.from(sessionMap.values())
    .filter((session) => session.mode === "training")
    .sort((first, second) => {
      const firstTime = Date.parse(first.timestamp || "") || 0;
      const secondTime = Date.parse(second.timestamp || "") || 0;
      return secondTime - firstTime;
    })
    .slice(0, MAX_LEDGER_SESSIONS);

  try {
    window.localStorage.setItem(key, JSON.stringify(mergedLedger));
  } catch (error) {
    console.warn("成就訓練紀錄暫存失敗：", error);
  }

  return mergedLedger;
}

function dateKey(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAchievementMetrics(sessions) {
  const meaningfulSessions = sessions.filter(
    (session) =>
      session.totalTrials > 0 ||
      session.stageId ||
      session.trainingLevel > 0 ||
      session.stars > 0
  );

  const recordsByGame = GAME_IDS.reduce((output, gameId) => {
    output[gameId] = meaningfulSessions
      .filter((session) => session.gameId === gameId)
      .flatMap((session) => session.records || []);
    return output;
  }, {});

  const srtSessions = meaningfulSessions.filter(
    (session) => session.gameId === "SRT"
  );
  const pmRecords = recordsByGame.PM;
  const cbtRecords = recordsByGame.CBT;
  const ssgSessions = meaningfulSessions.filter(
    (session) => session.gameId === "SSG"
  );
  const ssgRecords = recordsByGame.SSG;
  const dccsRecords = recordsByGame.DCCS;
  const lbSessions = meaningfulSessions.filter(
    (session) => session.gameId === "LB"
  );
  const lbRecords = recordsByGame.LB;

  const totalCorrectAnswers = meaningfulSessions.reduce(
    (sum, session) => sum + Number(session.correctCount || 0),
    0
  );

  const trainingDays = new Set(
    meaningfulSessions.map((session) => dateKey(session.timestamp)).filter(Boolean)
  ).size;

  const pmSuccessfulSpans = pmRecords
    .filter((record) => record.isCorrect)
    .map((record) => Number(record.memorySpan || 0));

  const cbtCleanRecords = cbtRecords.filter(
    (record) =>
      record.isCorrect &&
      (record.cleanCorrect ||
        (record.replayCount === 0 &&
          !record.idleHintShown &&
          !record.rescueUsed))
  );

  return {
    trainingSessions: meaningfulSessions.length,
    exploredGames: new Set(
      meaningfulSessions.map((session) => session.gameId)
    ).size,
    totalStars: meaningfulSessions.reduce(
      (sum, session) => sum + Number(session.stars || 0),
      0
    ),
    threeStarSessions: meaningfulSessions.filter(
      (session) => Number(session.stars || 0) >= 3
    ).length,
    totalCorrectAnswers,
    perfectSessions: meaningfulSessions.filter(
      (session) =>
        session.totalTrials > 0 &&
        (session.accuracy >= 99.5 ||
          session.correctCount >= session.totalTrials)
    ).length,
    noTimeoutSessions: meaningfulSessions.filter(
      (session) => session.totalTrials > 0 && session.timeoutCount === 0
    ).length,
    trainingDays,

    srtAcornHits: recordsByGame.SRT.filter(
      (record) => record.trainingAction === "hit"
    ).length,
    srtRottenResistanceSessions: srtSessions.filter(
      (session) =>
        session.rottenTotal > 0 &&
        session.falseAlarmCount === 0 &&
        session.accuracy >= 80
    ).length,

    pmHighestMemorySpan: pmSuccessfulSpans.length
      ? Math.max(...pmSuccessfulSpans)
      : 0,
    pmCarefulSelections: pmRecords.filter(
      (record) =>
        record.isCorrect &&
        Number(record.wrongTapCount || 0) === 0 &&
        Number(record.deselectCount || 0) === 0
    ).length,

    cbtHighestCleanSpan: cbtCleanRecords.length
      ? Math.max(...cbtCleanRecords.map((record) => Number(record.memorySpan || 0)))
      : 0,
    cbtCleanPaths: cbtCleanRecords.length,

    ssgCorrectOpposites: ssgRecords.filter((record) => record.isCorrect).length,
    ssgInhibitionSessions: ssgSessions.filter(
      (session) =>
        session.totalTrials > 0 &&
        session.anticipationCount === 0 &&
        session.sameAnimalErrorCount === 0 &&
        session.accuracy >= 80
    ).length,

    dccsCorrectSwitchTrials: dccsRecords.filter(
      (record) => record.isCorrect && record.wasAfterRuleSwitch
    ).length,
    dccsCorrectBagColorTrials: dccsRecords.filter(
      (record) =>
        record.isCorrect &&
        (record.isBagColorTrial || record.ruleStage === "bagColor")
    ).length,

    lbCorrectSteps: lbRecords.filter((record) => record.isCorrect).length,
    lbHighestTwoStarLevel: lbSessions
      .filter((session) => Number(session.stars || 0) >= 2)
      .reduce(
        (maximum, session) =>
          Math.max(maximum, Number(session.trainingLevel || 0)),
        0
      ),
  };
}

function getAchievementLevel(value, thresholds) {
  let level = 0;

  thresholds.forEach((threshold, index) => {
    if (value >= threshold) level = index + 1;
  });

  return level;
}

function getAchievementImage(id, level) {
  const displayLevel = clamp(level || 1, 1, 5);
  const folder = LEVEL_META[displayLevel - 1].folder;

  try {
    return achievementImageContext(`./${folder}/${id}.webp`);
  } catch (error) {
    console.warn(`找不到成就圖片：${folder}/${id}.webp`, error);
    return null;
  }
}

function getAchievementState(achievement, metrics) {
  const value = Number(metrics[achievement.metric] || 0);
  const level = getAchievementLevel(value, achievement.thresholds);
  const nextThreshold =
    level >= 5
      ? achievement.thresholds[4]
      : achievement.thresholds[level];
  const previousThreshold = level > 0 ? achievement.thresholds[level - 1] : 0;
  const currentSegment = Math.max(0, value - previousThreshold);
  const segmentTotal = Math.max(1, nextThreshold - previousThreshold);
  const progressPercent =
    level >= 5 ? 100 : clamp((currentSegment / segmentTotal) * 100, 0, 100);

  return {
    ...achievement,
    value,
    level,
    nextThreshold,
    progressPercent,
    image: getAchievementImage(achievement.id, level),
  };
}

function readStickerCollection(childId) {
  if (typeof window === "undefined") return {};

  const childCollection = safeJsonParse(
    window.localStorage.getItem(`hatStickerCollection_${childId}`),
    {}
  );
  const legacyCollection = safeJsonParse(
    window.localStorage.getItem("hatStickerCollection"),
    {}
  );

  return {
    ...(legacyCollection && typeof legacyCollection === "object"
      ? legacyCollection
      : {}),
    ...(childCollection && typeof childCollection === "object"
      ? childCollection
      : {}),
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW").format(Number(value || 0));
}

function getThresholdText(achievement, thresholdIndex, fallbackValue) {
  const customLabel = achievement.thresholdLabels?.[thresholdIndex];
  if (customLabel) return customLabel;
  return `${formatNumber(fallbackValue)} ${achievement.unit}`;
}

function AchievementRow({ achievement }) {
  const currentLevelMeta =
    achievement.level > 0 ? LEVEL_META[achievement.level - 1] : null;
  const nextLevelMeta =
    achievement.level < 5 ? LEVEL_META[achievement.level] : LEVEL_META[4];
  const nextThresholdIndex = achievement.level >= 5 ? 4 : achievement.level;
  const goalText = getThresholdText(
    achievement,
    nextThresholdIndex,
    achievement.nextThreshold
  );
  const currentText = `${formatNumber(achievement.value)} ${achievement.unit}`;

  return (
    <article
      className={`floating-achievement-row ${
        achievement.level > 0 ? "is-unlocked" : "is-locked"
      }`}
    >
      <div className="floating-achievement-icon-shell">
        {achievement.image ? (
          <img
            src={achievement.image}
            alt={achievement.name}
            className="floating-achievement-icon"
          />
        ) : (
          <span className="floating-achievement-fallback">★</span>
        )}
        {achievement.level === 0 && (
          <span className="floating-achievement-lock" aria-label="尚未解鎖">
            🔒
          </span>
        )}
      </div>

      <div className="floating-achievement-info">
        <div className="floating-achievement-heading">
          <div>
            <span className="floating-achievement-category">
              {achievement.categoryLabel}
            </span>
            <h3>{achievement.name}</h3>
          </div>

          <div className="floating-achievement-status">
            <strong>{achievement.level >= 5 ? "完成" : `${currentText} / ${goalText}`}</strong>
            <span>
              {currentLevelMeta
                ? currentLevelMeta.name
                : `目標：${nextLevelMeta.name}`}
            </span>
          </div>
        </div>

        <p>{achievement.description}</p>

        <div className="floating-achievement-progress-line">
          <div className="floating-achievement-progress-track">
            <span style={{ width: `${achievement.progressPercent}%` }} />
          </div>
          <span className="floating-achievement-progress-number">
            {achievement.level >= 5
              ? "5 / 5"
              : `${Math.round(achievement.progressPercent)}%`}
          </span>
        </div>

        <div className="floating-achievement-ranks" aria-label="五階段成就進度">
          {LEVEL_META.map((levelMeta) => (
            <span
              key={levelMeta.level}
              className={levelMeta.level <= achievement.level ? "is-on" : ""}
              title={levelMeta.name}
            >
              {levelMeta.shortName}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function StickerRow({ sticker, collectionItem }) {
  const count = Math.max(0, Number(collectionItem?.count || 0));
  const obtained = count > 0;

  return (
    <article
      className={`floating-sticker-row ${obtained ? "is-owned" : "is-locked"}`}
    >
      <div className="floating-sticker-icon-shell">
        <img loading="lazy" src={sticker.image} alt={sticker.name} />
        {!obtained && <span className="floating-sticker-lock">🔒</span>}
      </div>

      <div className="floating-sticker-info">
        <div className="floating-sticker-heading">
          <div>
            <span>一般貼紙</span>
            <h3>{sticker.name}</h3>
          </div>
          <strong>{obtained ? `× ${count}` : "0 / 1"}</strong>
        </div>
        <p>{obtained ? "已在帽子遊戲中獲得" : "完成帽子遊戲即可隨機獲得"}</p>
        <div className="floating-achievement-progress-track sticker-progress-track">
          <span style={{ width: obtained ? "100%" : "0%" }} />
        </div>
      </div>
    </article>
  );
}

const FLOATING_NAV_ITEMS = [
  { id: "all", label: "全部成就", shortLabel: "全部", icon: "⭐" },
  { id: "general", label: "綜合成就", shortLabel: "綜合", icon: "🎈" },
  { id: "SRT", label: "SRT 橡實注意力", shortLabel: "SRT", iconSrc: srtGameIcon },
  { id: "PM", label: "PM 圖片記憶", shortLabel: "PM", iconSrc: pmGameIcon },
  { id: "CBT", label: "CBT 石頭路記憶", shortLabel: "CBT", iconSrc: cbtGameIcon },
  { id: "SSG", label: "SSG 貓狗聲音", shortLabel: "SSG", iconSrc: ssgGameIcon },
  { id: "DCCS", label: "DCCS 衣物分類", shortLabel: "DCCS", iconSrc: dccsGameIcon },
  { id: "LB", label: "LB 數字門牌", shortLabel: "LB", iconSrc: lbGameIcon },
  { id: "stickers", label: "一般貼紙", shortLabel: "貼紙", icon: "🎀" },
];

export default function Achievement() {
  const navigate = useNavigate();
  const [view, setView] = useState("achievements");
  const [category, setCategory] = useState("all");
  const [childId, setChildId] = useState(() => resolveChildId());
  const [sessions, setSessions] = useState([]);
  const [stickerCollection, setStickerCollection] = useState({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const closePanel = useCallback(() => {
    navigate(MENU_ROUTE);
  }, [navigate]);

  const refreshCollection = useCallback(() => {
    const nextChildId = resolveChildId();
    const nextSessions = syncAchievementLedger(nextChildId);

    setChildId(nextChildId);
    setSessions(nextSessions);
    setStickerCollection(readStickerCollection(nextChildId));
    setLastUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    refreshCollection();

    const handleUpdate = () => refreshCollection();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshCollection();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closePanel();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("stickerCollectionUpdated", handleUpdate);
    window.addEventListener("achievementResultsUpdated", handleUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("stickerCollectionUpdated", handleUpdate);
      window.removeEventListener("achievementResultsUpdated", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [closePanel, refreshCollection]);

  const metrics = useMemo(() => getAchievementMetrics(sessions), [sessions]);

  const achievementStates = useMemo(
    () =>
      ACHIEVEMENTS.map((achievement) =>
        getAchievementState(achievement, metrics)
      ),
    [metrics]
  );

  const visibleAchievements = useMemo(() => {
    const list =
      category === "all"
        ? achievementStates
        : achievementStates.filter(
            (achievement) => achievement.category === category
          );

    return [...list].sort((first, second) => {
      if (second.level !== first.level) return second.level - first.level;
      if (second.progressPercent !== first.progressPercent) {
        return second.progressPercent - first.progressPercent;
      }
      return first.name.localeCompare(second.name, "zh-Hant");
    });
  }, [achievementStates, category]);

  const unlockedAchievementCount = achievementStates.filter(
    (achievement) => achievement.level > 0
  ).length;
  const starLevelAchievementCount = achievementStates.filter(
    (achievement) => achievement.level >= 5
  ).length;
  const unlockedStageCount = achievementStates.reduce(
    (sum, achievement) => sum + achievement.level,
    0
  );

  const stickerStats = useMemo(() => {
    const items = STICKER_CATALOG.map((sticker) => ({
      sticker,
      collectionItem: stickerCollection[sticker.id] || null,
      count: Math.max(0, Number(stickerCollection[sticker.id]?.count || 0)),
    }));

    return {
      items,
      uniqueCount: items.filter((item) => item.count > 0).length,
      totalCount: items.reduce((sum, item) => sum + item.count, 0),
      duplicateCount: items.reduce(
        (sum, item) => sum + Math.max(0, item.count - 1),
        0
      ),
    };
  }, [stickerCollection]);

  const activeNavId = view === "stickers" ? "stickers" : category;
  const panelTitle = view === "stickers" ? "一般貼紙" : "成就";
  const panelDescription =
    view === "stickers"
      ? "帽子遊戲獲得的森林貼紙"
      : category === "all"
      ? "六項訓練的成就進度"
      : `${CATEGORY_OPTIONS.find((option) => option.id === category)?.label || "成就"} 類別`;

  const overallProgress =
    view === "stickers"
      ? STICKER_CATALOG.length > 0
        ? (stickerStats.uniqueCount / STICKER_CATALOG.length) * 100
        : 0
      : (unlockedStageCount / (ACHIEVEMENTS.length * 5)) * 100;

  const overallProgressText =
    view === "stickers"
      ? `${stickerStats.uniqueCount} / ${STICKER_CATALOG.length}`
      : `${unlockedStageCount} / ${ACHIEVEMENTS.length * 5}`;

  const selectNavigation = (id) => {
    if (id === "stickers") {
      setView("stickers");
      return;
    }
    setView("achievements");
    setCategory(id);
  };

  return (
    <div className="achievement-floating-backdrop" onMouseDown={closePanel}>
      <AchievementStyles />

      <section
        className="achievement-floating-window"
        style={{ "--achievement-game-card": `url(${gameCardBackground})` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-floating-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="achievement-floating-titlebar">
          <div className="achievement-title-ornament left" aria-hidden="true" />
          <div className="achievement-floating-title-text">
            <h1 id="achievement-floating-title">{panelTitle}</h1>
          </div>
          <div className="achievement-title-ornament right" aria-hidden="true" />

          <button
            type="button"
            className="achievement-floating-close"
            onClick={closePanel}
            aria-label="關閉成就頁面"
          >
            ×
          </button>
        </header>

        <div className="achievement-floating-body">
          <aside className="achievement-floating-sidebar" aria-label="成就分類">
            <div className="achievement-sidebar-caption">分類</div>
            <nav>
              {FLOATING_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeNavId === item.id ? "is-active" : ""}
                  onClick={() => selectNavigation(item.id)}
                  title={item.label}
                >
                  <span className="achievement-nav-icon" aria-hidden="true">
                    {item.iconSrc ? (
                      <img src={item.iconSrc} alt="" />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                  </span>
                  <span className="achievement-nav-label">{item.shortLabel}</span>
                  <span className="achievement-nav-short-label">
                    {item.shortLabel}
                  </span>
                  {item.id === "stickers" && stickerStats.uniqueCount > 0 && (
                    <em>{stickerStats.uniqueCount}</em>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          <main className="achievement-floating-content">
            <div className="achievement-floating-content-header">
              <div>
                <span>{panelDescription}</span>
                <h2>
                  {view === "stickers"
                    ? `已收集 ${stickerStats.uniqueCount} 種貼紙`
                    : `已解鎖 ${unlockedAchievementCount} 個成就`}
                </h2>
              </div>

              <div className="achievement-header-actions">
                <div className="achievement-mini-stats">
                  {view === "stickers" ? (
                    <>
                      <span>總數 <strong>{stickerStats.totalCount}</strong></span>
                      <span>重複 <strong>{stickerStats.duplicateCount}</strong></span>
                    </>
                  ) : (
                    <>
                      <span>星耀 <strong>{starLevelAchievementCount}</strong></span>
                      <span>訓練 <strong>{metrics.trainingSessions}</strong></span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="achievement-floating-refresh"
                  onClick={refreshCollection}
                  aria-label="更新成就進度"
                  title="更新進度"
                >
                  ↻
                </button>
              </div>
            </div>

            <div className="achievement-floating-scroll-area">
              {view === "achievements" ? (
                visibleAchievements.length > 0 ? (
                  <div className="achievement-floating-list">
                    {visibleAchievements.map((achievement) => (
                      <AchievementRow
                        key={achievement.id}
                        achievement={achievement}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="achievement-empty-state">
                    <strong>目前沒有這個分類的成就</strong>
                    <span>請選擇其他分類查看。</span>
                  </div>
                )
              ) : (
                <div className="achievement-floating-list sticker-list">
                  {stickerStats.items.map(({ sticker, collectionItem }) => (
                    <StickerRow
                      key={sticker.id}
                      sticker={sticker}
                      collectionItem={collectionItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>

        <footer className="achievement-floating-footer">
          <span className="achievement-footer-label">
            {view === "stickers" ? "貼紙收集進度" : "成就總進度"}
          </span>
          <div className="achievement-footer-progress-track">
            <span style={{ width: `${clamp(overallProgress, 0, 100)}%` }} />
          </div>
          <strong>{overallProgressText}</strong>
          <small>
            {lastUpdatedAt
              ? `更新於 ${lastUpdatedAt.toLocaleTimeString("zh-TW", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : `角色 ${childId}`}
          </small>
        </footer>
      </section>
    </div>
  );
}

function AchievementStyles() {
  return (
    <style>{`
      :root {
        --achievement-panel-dark: #07354a;
        --achievement-panel-deep: #052a3b;
        --achievement-panel-mid: #0c5f7a;
        --achievement-panel-light: #1987a3;
        --achievement-panel-cyan: #8ee7f5;
        --achievement-panel-line: #62bdd4;
        --achievement-panel-gold: #ffd948;
        --achievement-panel-lime: #89f24d;
        --achievement-panel-text: #f2fdff;
        --achievement-panel-muted: #b7e1e9;
        --achievement-panel-shadow: 0 28px 80px rgba(0, 15, 24, .62);
      }

      * { box-sizing: border-box; }

      .achievement-floating-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: clamp(14px, 3vw, 38px);
        overflow: hidden;
        background:
          radial-gradient(circle at 18% 14%, rgba(49, 154, 142, .32), transparent 34%),
          radial-gradient(circle at 80% 84%, rgba(181, 123, 42, .23), transparent 36%),
          linear-gradient(rgba(4, 21, 27, .62), rgba(3, 18, 25, .78));
        backdrop-filter: blur(8px) saturate(.82);
        font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      }

      .achievement-floating-window {
        position: relative;
        width: min(1180px, 96vw);
        height: min(820px, calc(100dvh - 58px));
        min-height: 570px;
        display: grid;
        grid-template-rows: 72px minmax(0, 1fr) 48px;
        overflow: hidden;
        border: 3px solid #98dbea;
        border-radius: 22px;
        color: var(--achievement-panel-text);
        background:
          linear-gradient(180deg, rgba(19, 112, 137, .98), rgba(5, 46, 64, .99));
        box-shadow:
          var(--achievement-panel-shadow),
          inset 0 0 0 3px rgba(3, 38, 54, .92),
          inset 0 0 0 5px rgba(129, 219, 236, .22);
        isolation: isolate;
      }

      .achievement-floating-window::before {
        content: "";
        position: absolute;
        inset: 5px;
        z-index: -1;
        border: 1px solid rgba(155, 232, 245, .34);
        border-radius: 15px;
        pointer-events: none;
      }

      .achievement-floating-titlebar {
        position: relative;
        display: grid;
        grid-template-columns: minmax(80px, 1fr) auto minmax(80px, 1fr);
        align-items: center;
        gap: 12px;
        padding: 8px 76px 8px 28px;
        border-bottom: 2px solid rgba(125, 218, 237, .76);
        background:
          linear-gradient(180deg, rgba(222, 242, 247, .96) 0%, rgba(91, 151, 169, .96) 42%, rgba(25, 87, 109, .98) 48%, rgba(10, 59, 78, .98) 100%);
        box-shadow: inset 0 -5px 12px rgba(0, 25, 38, .46);
      }

      .achievement-floating-title-text {
        min-width: 210px;
        padding: 2px 34px 4px;
        text-align: center;
        clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
        background: linear-gradient(180deg, #d8f5fb, #75bfd1 38%, #276f8a 48%, #0e4763);
        box-shadow: 0 5px 12px rgba(0, 20, 32, .45);
      }

      .achievement-floating-title-text span {
        display: block;
        color: #d7f6fb;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .2em;
        text-shadow: 0 1px 2px #073247;
      }

      .achievement-floating-title-text h1 {
        margin: -1px 0 0;
        color: #fff;
        font-size: 26px;
        line-height: 1.05;
        letter-spacing: .18em;
        text-shadow: 0 2px 3px #063349, 0 0 8px rgba(180, 241, 250, .72);
      }

      .achievement-title-ornament {
        height: 16px;
        opacity: .92;
        background:
          linear-gradient(90deg, transparent, #ccebf0 22%, #4f9cb0 50%, #ccebf0 78%, transparent);
        clip-path: polygon(0 35%, 12% 35%, 18% 0, 82% 0, 88% 35%, 100% 35%, 88% 65%, 82% 100%, 18% 100%, 12% 65%, 0 65%);
      }
      .achievement-title-ornament.right { transform: scaleX(-1); }

      .achievement-floating-close {
        position: absolute;
        top: 12px;
        right: 16px;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        padding: 0 0 3px;
        border: 3px solid #d8f3f8;
        border-radius: 50%;
        color: #fff5ab;
        background: linear-gradient(180deg, #2ba3c6, #0b6182 56%, #08425d);
        box-shadow: 0 4px 10px rgba(0, 25, 39, .55), inset 0 0 0 2px #176987;
        font: 900 33px/1 Arial, sans-serif;
        cursor: pointer;
        transition: transform .16s ease, filter .16s ease;
      }
      .achievement-floating-close:hover { transform: scale(1.08); filter: brightness(1.15); }
      .achievement-floating-close:active { transform: scale(.96); }

      .achievement-floating-body {
        min-height: 0;
        display: grid;
        grid-template-columns: 176px minmax(0, 1fr);
        gap: 12px;
        padding: 14px 15px 12px;
        background:
          radial-gradient(circle at 72% 20%, rgba(71, 189, 207, .12), transparent 34%),
          linear-gradient(180deg, rgba(7, 69, 91, .96), rgba(5, 46, 64, .98));
      }

      .achievement-floating-sidebar {
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 9px 8px;
        border: 2px solid #126f8c;
        border-radius: 14px;
        background: linear-gradient(180deg, #0d6080, #073d58);
        box-shadow: inset 0 0 18px rgba(0, 24, 37, .48);
      }

      .achievement-sidebar-caption {
        margin: 2px 7px 8px;
        color: #bce8ef;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .18em;
      }

      .achievement-floating-sidebar nav {
        min-height: 0;
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #63c6da #06364c;
      }

      .achievement-floating-sidebar button {
        position: relative;
        min-height: 46px;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        align-items: center;
        gap: 7px;
        padding: 7px 12px;
        border: 2px solid #167b9b;
        border-radius: 9px;
        color: #d9f7fb;
        background: linear-gradient(180deg, #137491, #0b4e6a);
        box-shadow: inset 0 0 9px rgba(95, 213, 235, .16), 0 2px 4px rgba(0, 25, 38, .35);
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        text-align: left;
        cursor: pointer;
        transition: transform .14s ease, filter .14s ease, color .14s ease;
      }
      .achievement-floating-sidebar button:hover { transform: translateX(3px); filter: brightness(1.1); }
      .achievement-floating-sidebar button.is-active {
        border-color: #ffef60;
        color: #23424b;
        background: linear-gradient(180deg, #fff152, #f2c91b 58%, #d79a08);
        box-shadow: inset 0 0 10px rgba(255, 255, 255, .58), 0 0 13px rgba(255, 221, 41, .42);
      }

      .achievement-nav-icon {
        width: 27px;
        height: 27px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(213, 247, 252, .62);
        border-radius: 7px;
        color: #ffe761;
        background: rgba(2, 38, 54, .55);
        font-size: 15px;
      }
      .achievement-floating-sidebar button.is-active .achievement-nav-icon {
        border-color: #fff7a3;
        color: #fffbe0;
        background: #bf7600;
      }

      .achievement-nav-short-label { display: none; }
      .achievement-floating-sidebar em {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        padding: 0 5px;
        border: 2px solid #fff;
        border-radius: 999px;
        color: #fff;
        background: #f0463c;
        font-size: 10px;
        font-style: normal;
        box-shadow: 0 2px 6px rgba(0,0,0,.32);
      }

      .achievement-floating-content {
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        overflow: hidden;
        border: 2px solid #2f9dbc;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(13, 81, 105, .94), rgba(7, 51, 70, .98));
        box-shadow: inset 0 0 20px rgba(0, 24, 38, .48);
      }

      .achievement-floating-content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(104, 204, 223, .54);
        background: rgba(4, 48, 67, .7);
      }
      .achievement-floating-content-header > div:first-child > span {
        display: block;
        color: #96dbe7;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .1em;
      }
      .achievement-floating-content-header h2 {
        margin: 2px 0 0;
        color: #fff;
        font-size: 20px;
        text-shadow: 0 2px 3px rgba(0, 24, 37, .72);
      }

      .achievement-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .achievement-mini-stats {
        display: flex;
        gap: 8px;
      }
      .achievement-mini-stats span {
        padding: 6px 9px;
        border: 1px solid rgba(108, 207, 225, .48);
        border-radius: 8px;
        color: #bce8ef;
        background: rgba(4, 38, 55, .55);
        font-size: 11px;
        white-space: nowrap;
      }
      .achievement-mini-stats strong { color: #fff15e; }
      .achievement-floating-refresh {
        width: 35px;
        height: 35px;
        border: 2px solid #84d8e8;
        border-radius: 50%;
        color: #fff;
        background: linear-gradient(180deg, #278fac, #0b5673);
        font: 900 20px/1 Arial, sans-serif;
        cursor: pointer;
      }
      .achievement-floating-refresh:hover { filter: brightness(1.16); }

      .achievement-floating-scroll-area {
        min-height: 0;
        overflow-y: auto;
        padding: 12px;
        scrollbar-width: thin;
        scrollbar-color: #73d2e4 #06384e;
      }
      .achievement-floating-scroll-area::-webkit-scrollbar { width: 10px; }
      .achievement-floating-scroll-area::-webkit-scrollbar-track {
        border-radius: 999px;
        background: #06384e;
      }
      .achievement-floating-scroll-area::-webkit-scrollbar-thumb {
        border: 2px solid #06384e;
        border-radius: 999px;
        background: linear-gradient(#8ce7f4, #2796b4);
      }

      .achievement-floating-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .floating-achievement-row,
      .floating-sticker-row {
        min-width: 0;
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 13px;
        padding: 10px 14px 10px 10px;
        border: 2px solid #5cc4da;
        border-radius: 10px;
        background:
          linear-gradient(180deg, rgba(50, 157, 187, .96), rgba(23, 105, 139, .97));
        box-shadow:
          inset 0 0 13px rgba(158, 238, 248, .18),
          0 4px 9px rgba(0, 27, 41, .32);
        transition: transform .16s ease, filter .16s ease;
      }
      .floating-achievement-row:hover,
      .floating-sticker-row:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
      }
      .floating-achievement-row.is-locked,
      .floating-sticker-row.is-locked {
        border-color: #397f94;
        background: linear-gradient(180deg, rgba(34, 110, 137, .86), rgba(18, 76, 103, .92));
      }

      .floating-achievement-icon-shell,
      .floating-sticker-icon-shell {
        position: relative;
        min-height: 84px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 3px solid #75d4e5;
        border-radius: 8px;
        background: linear-gradient(145deg, #0d4f6b, #082f45);
        box-shadow: inset 0 0 12px rgba(0, 19, 30, .62), 0 2px 5px rgba(0,0,0,.3);
      }
      .floating-achievement-icon,
      .floating-sticker-icon-shell img {
        width: 78px;
        height: 78px;
        object-fit: contain;
        filter: drop-shadow(0 4px 5px rgba(0, 20, 30, .45));
      }
      .floating-achievement-row.is-locked .floating-achievement-icon,
      .floating-sticker-row.is-locked img {
        filter: grayscale(1) opacity(.4);
      }
      .floating-achievement-fallback {
        color: #ffe45c;
        font-size: 42px;
      }
      .floating-achievement-lock,
      .floating-sticker-lock {
        position: absolute;
        inset: 50% auto auto 50%;
        transform: translate(-50%, -50%);
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: 2px solid #d8f5fa;
        border-radius: 50%;
        background: rgba(3, 29, 43, .85);
        font-size: 17px;
      }

      .floating-achievement-info,
      .floating-sticker-info {
        min-width: 0;
        align-self: center;
      }
      .floating-achievement-heading,
      .floating-sticker-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
      }
      .floating-achievement-category,
      .floating-sticker-heading span {
        display: block;
        color: #bdebf2;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .08em;
      }
      .floating-achievement-heading h3,
      .floating-sticker-heading h3 {
        margin: 2px 0 0;
        color: #fff;
        font-size: 17px;
        line-height: 1.25;
        text-shadow: 0 2px 2px rgba(0, 30, 43, .72);
      }
      .floating-achievement-status {
        flex: 0 0 auto;
        text-align: right;
      }
      .floating-achievement-status strong,
      .floating-sticker-heading > strong {
        display: block;
        color: var(--achievement-panel-lime);
        font-size: 15px;
        text-shadow: 0 1px 2px #063347;
      }
      .floating-achievement-status span {
        display: block;
        margin-top: 2px;
        color: #d5f0f4;
        font-size: 10px;
      }
      .floating-achievement-info > p,
      .floating-sticker-info > p {
        margin: 5px 0 8px;
        color: #d2edf2;
        font-size: 12px;
        line-height: 1.45;
      }

      .floating-achievement-progress-line {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 42px;
        align-items: center;
        gap: 8px;
      }
      .floating-achievement-progress-track {
        height: 9px;
        overflow: hidden;
        border: 1px solid #021d2c;
        border-radius: 999px;
        background: #041e2c;
        box-shadow: inset 0 2px 4px rgba(0,0,0,.55);
      }
      .floating-achievement-progress-track > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #59e7f5, #a4f550 72%, #ffe54e);
        box-shadow: 0 0 7px rgba(120, 241, 218, .72);
        transition: width .28s ease;
      }
      .floating-achievement-progress-number {
        color: #fff;
        font-size: 10px;
        font-weight: 900;
        text-align: right;
      }

      .floating-achievement-ranks {
        display: flex;
        gap: 4px;
        margin-top: 7px;
      }
      .floating-achievement-ranks span {
        min-width: 27px;
        height: 19px;
        display: grid;
        place-items: center;
        border: 1px solid #3c8ea5;
        border-radius: 5px;
        color: #78b5c2;
        background: rgba(4, 43, 60, .55);
        font-size: 9px;
        font-weight: 900;
      }
      .floating-achievement-ranks span.is-on {
        border-color: #fff16b;
        color: #fff;
        background: linear-gradient(180deg, #d49d13, #9c6207);
        box-shadow: 0 0 5px rgba(255, 225, 75, .42);
      }

      .floating-sticker-row {
        grid-template-columns: 82px minmax(0, 1fr);
      }
      .floating-sticker-icon-shell { min-height: 76px; }
      .floating-sticker-icon-shell img { width: 70px; height: 70px; }
      .sticker-progress-track { margin-top: 11px; }

      .achievement-empty-state {
        min-height: 250px;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 6px;
        color: #b9e5ec;
        text-align: center;
      }
      .achievement-empty-state strong { color: #fff; font-size: 19px; }

      .achievement-floating-footer {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) auto auto;
        align-items: center;
        gap: 10px;
        padding: 8px 18px;
        border-top: 2px solid #2b8fab;
        background: linear-gradient(180deg, #073d56, #052b40);
        box-shadow: inset 0 5px 12px rgba(0, 18, 29, .44);
      }
      .achievement-footer-label {
        color: #b9e6ed;
        font-size: 11px;
        font-weight: 900;
      }
      .achievement-footer-progress-track {
        height: 10px;
        overflow: hidden;
        border: 2px solid #021d2c;
        border-radius: 999px;
        background: #021d2c;
      }
      .achievement-footer-progress-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #4fdff0, #a0f14a, #ffe354);
        box-shadow: 0 0 8px rgba(108, 238, 213, .66);
      }
      .achievement-floating-footer strong {
        color: #fff;
        font-size: 11px;
      }
      .achievement-floating-footer small {
        color: #83bfca;
        font-size: 10px;
      }

      /* 動物森林好友會：暖色森林配色覆寫 */
      :root {
        --achievement-panel-dark: #4f6f43;
        --achievement-panel-deep: #3f5b36;
        --achievement-panel-mid: #79a75c;
        --achievement-panel-light: #a8cf77;
        --achievement-panel-cyan: #ccefff;
        --achievement-panel-line: #d9ae5f;
        --achievement-panel-gold: #ffd568;
        --achievement-panel-lime: #5f9f45;
        --achievement-panel-text: #5b3b2b;
        --achievement-panel-muted: #806b57;
        --achievement-panel-shadow: 0 28px 80px rgba(73, 48, 25, .38);
      }

      .achievement-floating-backdrop {
        background:
          radial-gradient(circle at 17% 12%, rgba(128, 204, 239, .30), transparent 35%),
          radial-gradient(circle at 84% 85%, rgba(255, 198, 78, .30), transparent 38%),
          linear-gradient(rgba(76, 91, 53, .34), rgba(66, 48, 30, .52));
        backdrop-filter: blur(8px) saturate(.96);
      }

      .achievement-floating-window {
        padding: clamp(34px, 4vw, 50px) clamp(36px, 4.5vw, 56px) clamp(38px, 4.5vw, 54px);
        border: 0;
        border-radius: 0;
        color: var(--achievement-panel-text);
        background-image: var(--achievement-game-card);
        background-position: center;
        background-repeat: no-repeat;
        background-size: 100% 100%;
        box-shadow: var(--achievement-panel-shadow);
      }

      .achievement-floating-window::before {
        display: none;
      }

      .achievement-floating-titlebar {
        border-bottom-color: #d49b4a;
        background:
          linear-gradient(180deg, #e8f8ff 0%, #a9def3 42%, #79c1e2 58%, #5da7cc 100%);
        box-shadow: inset 0 -5px 12px rgba(61, 111, 137, .24);
      }

      .achievement-floating-title-text {
        background: linear-gradient(180deg, #ffe9a3 0%, #f4c96b 45%, #d99a42 100%);
        box-shadow:
          0 5px 12px rgba(111, 70, 30, .28),
          inset 0 0 0 2px rgba(255, 247, 206, .72);
      }

      .achievement-floating-title-text span {
        color: #7b562f;
        text-shadow: 0 1px 1px rgba(255, 250, 223, .8);
      }

      .achievement-floating-title-text h1 {
        color: #fffaf0;
        text-shadow: 0 2px 2px #8d5a29, 0 0 7px rgba(255, 247, 206, .9);
      }

      .achievement-title-ornament {
        background:
          linear-gradient(90deg, transparent, #fff6cf 22%, #88b968 50%, #fff6cf 78%, transparent);
      }

      .achievement-floating-close {
        border-color: #fff4c8;
        color: #fffaf0;
        background: linear-gradient(180deg, #f6aa94, #e77567 58%, #bd554f);
        box-shadow:
          0 4px 10px rgba(102, 55, 37, .30),
          inset 0 0 0 2px rgba(255, 225, 195, .72);
      }

      .achievement-floating-body {
        background:
          radial-gradient(circle at 74% 18%, rgba(119, 197, 231, .20), transparent 35%),
          radial-gradient(circle at 18% 86%, rgba(246, 198, 91, .18), transparent 34%),
          linear-gradient(180deg, #fff8e8, #f2dfb7);
      }

      .achievement-floating-sidebar {
        border-color: #7d9e5f;
        background: linear-gradient(180deg, #91bb68, #5f884d 58%, #4b7041);
        box-shadow:
          inset 0 0 18px rgba(52, 83, 42, .30),
          0 4px 10px rgba(104, 73, 37, .18);
      }

      .achievement-sidebar-caption {
        color: #fff8dc;
        text-shadow: 0 1px 2px rgba(63, 82, 40, .45);
      }

      .achievement-floating-sidebar nav {
        scrollbar-color: #f7cf68 #4f7341;
      }

      .achievement-floating-sidebar button {
        border-color: #d8e7b5;
        color: #fffdf0;
        border-radius: 15px;
        background:
          radial-gradient(circle at 82% 18%, rgba(255, 255, 255, .24) 0 3px, transparent 4px),
          linear-gradient(145deg, #8fc86a, #5d934f 68%, #4f7e45);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, .35),
          inset 0 -3px 0 rgba(55, 104, 43, .22),
          0 3px 6px rgba(55, 72, 37, .24);
      }

      .achievement-floating-sidebar button:hover {
        transform: translateX(4px) rotate(-1deg);
      }

      .achievement-floating-sidebar button.is-active {
        border-color: #fff0a0;
        color: #6c492a;
        background: linear-gradient(180deg, #fff29b, #f4c95d 60%, #dc9d3f);
        box-shadow:
          inset 0 0 10px rgba(255, 255, 255, .72),
          0 0 13px rgba(237, 180, 66, .42);
      }

      .achievement-nav-icon {
        width: 34px;
        height: 34px;
        overflow: hidden;
        border: 2px solid rgba(255, 250, 217, .86);
        border-radius: 12px;
        color: #fff3a1;
        background: linear-gradient(145deg, rgba(255, 244, 171, .3), rgba(68, 103, 54, .5));
        box-shadow: inset 0 1px 2px rgba(255, 255, 255, .38), 0 2px 4px rgba(54, 79, 40, .22);
        font-size: 18px;
      }

      .achievement-nav-icon img {
        width: 31px;
        height: 31px;
        object-fit: contain;
        filter: drop-shadow(0 1px 1px rgba(67, 72, 39, .26));
      }

      .achievement-floating-sidebar button.is-active .achievement-nav-icon {
        border-color: #fff7c7;
        color: #fffdf0;
        background: linear-gradient(145deg, #fff2ad, #e5a748);
        transform: rotate(-4deg) scale(1.06);
      }

      .achievement-floating-sidebar em {
        border-color: #fff8e4;
        background: #ec6e63;
      }

      .achievement-floating-content {
        border-color: #d7af69;
        background: linear-gradient(180deg, rgba(255, 250, 232, .98), rgba(246, 229, 194, .98));
        box-shadow:
          inset 0 0 20px rgba(151, 111, 56, .12),
          0 4px 10px rgba(103, 73, 37, .12);
      }

      .achievement-floating-content-header {
        border-bottom-color: rgba(188, 139, 70, .38);
        background: linear-gradient(90deg, rgba(255, 247, 216, .96), rgba(224, 244, 220, .92));
      }

      .achievement-floating-content-header > div:first-child > span {
        color: #6b9360;
      }

      .achievement-floating-content-header h2 {
        color: #68462f;
        text-shadow: 0 1px 0 rgba(255, 255, 255, .72);
      }

      .achievement-mini-stats span {
        border-color: rgba(116, 159, 91, .48);
        color: #6d5a46;
        background: rgba(255, 252, 232, .76);
      }

      .achievement-mini-stats strong {
        color: #d4862f;
      }

      .achievement-floating-refresh {
        border-color: #fff0b7;
        color: #fffdf2;
        background: linear-gradient(180deg, #7bc9e9, #4ca3cb 58%, #3c82a8);
        box-shadow: 0 3px 7px rgba(57, 105, 130, .24);
      }

      .achievement-floating-scroll-area {
        scrollbar-color: #80bd67 #ead6aa;
      }

      .achievement-floating-scroll-area::-webkit-scrollbar-track {
        background: #ead6aa;
      }

      .achievement-floating-scroll-area::-webkit-scrollbar-thumb {
        border-color: #ead6aa;
        background: linear-gradient(#a8d67b, #68a952);
      }

      .floating-achievement-row,
      .floating-sticker-row {
        border-color: #9bcfe1;
        background: linear-gradient(180deg, #eefaff 0%, #d8f0f7 48%, #c8e6ef 100%);
        box-shadow:
          inset 0 0 13px rgba(255, 255, 255, .58),
          0 4px 9px rgba(102, 81, 48, .16);
      }

      .floating-achievement-row.is-locked,
      .floating-sticker-row.is-locked {
        border-color: #b5c69b;
        background: linear-gradient(180deg, #edf2df, #d6dfc4);
      }

      .floating-achievement-icon-shell,
      .floating-sticker-icon-shell {
        border-color: #f0c968;
        background: linear-gradient(145deg, #fff9df, #f2dda8);
        box-shadow:
          inset 0 0 12px rgba(178, 121, 47, .15),
          0 2px 5px rgba(104, 74, 37, .18);
      }

      .floating-achievement-icon,
      .floating-sticker-icon-shell img {
        filter: drop-shadow(0 4px 5px rgba(103, 73, 37, .24));
      }

      .floating-achievement-fallback {
        color: #e8ae36;
      }

      .floating-achievement-lock,
      .floating-sticker-lock {
        border-color: #fff3c0;
        background: rgba(91, 109, 71, .88);
      }

      .floating-achievement-category,
      .floating-sticker-heading span {
        color: #55936e;
      }

      .floating-achievement-heading h3,
      .floating-sticker-heading h3 {
        color: #65432d;
        text-shadow: 0 1px 0 rgba(255, 255, 255, .82);
      }

      .floating-achievement-status strong,
      .floating-sticker-heading > strong {
        color: #5d9d44;
        text-shadow: 0 1px 0 rgba(255, 255, 255, .72);
      }

      .floating-achievement-status span {
        color: #7c6854;
      }

      .floating-achievement-info > p,
      .floating-sticker-info > p {
        color: #76624f;
      }

      .floating-achievement-progress-track {
        border-color: #b99356;
        background: #e3d3ad;
        box-shadow: inset 0 2px 4px rgba(112, 78, 35, .24);
      }

      .floating-achievement-progress-track > span {
        background: linear-gradient(90deg, #69b65a, #a9d95f 55%, #ffd666);
        box-shadow: 0 0 7px rgba(136, 185, 74, .42);
      }

      .floating-achievement-progress-number {
        color: #6c4d32;
      }

      .floating-achievement-ranks span {
        border-color: #b8c89d;
        color: #8b9277;
        background: rgba(245, 241, 214, .86);
      }

      .floating-achievement-ranks span.is-on {
        border-color: #ffe487;
        color: #fffdf0;
        background: linear-gradient(180deg, #e9b94b, #b97031);
        box-shadow: 0 0 5px rgba(228, 170, 62, .40);
      }

      .achievement-empty-state {
        color: #806b57;
      }

      .achievement-empty-state strong {
        color: #65432d;
      }

      .achievement-floating-footer {
        border-top-color: #668b4f;
        background: linear-gradient(180deg, #6f9a57, #496d40);
        box-shadow: inset 0 5px 12px rgba(51, 77, 43, .24);
      }

      .achievement-footer-label,
      .achievement-floating-footer strong {
        color: #fff9df;
      }

      .achievement-footer-progress-track {
        border-color: #3e5d36;
        background: #3e5d36;
      }

      .achievement-footer-progress-track span {
        background: linear-gradient(90deg, #85d36a, #d7e76d 58%, #ffd55f);
        box-shadow: 0 0 8px rgba(223, 219, 99, .52);
      }

      .achievement-floating-footer small {
        color: #e9f1d8;
      }

      /* gamecard.webp is the only full-window card. Keep the functional panels,
         but remove the old rectangular title/body/footer shell around them. */
      .achievement-floating-titlebar {
        border-bottom: 0;
        background: transparent;
        box-shadow: none;
      }

      .achievement-floating-body {
        background: transparent;
      }

      .achievement-floating-footer {
        border-top: 0;
        background: transparent;
        box-shadow: none;
      }

      .achievement-floating-footer .achievement-footer-label,
      .achievement-floating-footer strong,
      .achievement-floating-footer small {
        color: #5f563d;
      }

      @media (max-width: 900px) {
        .achievement-floating-backdrop { padding: 12px; }
        .achievement-floating-window {
          width: 100%;
          height: calc(100dvh - 24px);
          min-height: 0;
          padding: 30px 34px 34px;
          grid-template-rows: 64px minmax(0, 1fr) 46px;
        }
        .achievement-floating-titlebar {
          grid-template-columns: 1fr auto 1fr;
          padding: 7px 60px 7px 14px;
        }
        .achievement-floating-title-text { min-width: 178px; padding-inline: 24px; }
        .achievement-floating-title-text h1 { font-size: 22px; }
        .achievement-floating-close { width: 39px; height: 39px; top: 10px; right: 12px; }
        .achievement-floating-body {
          grid-template-columns: 94px minmax(0, 1fr);
          gap: 8px;
          padding: 9px;
        }
        .achievement-sidebar-caption { display: none; }
        .achievement-floating-sidebar { padding: 6px; }
        .achievement-floating-sidebar button {
          min-height: 46px;
          grid-template-columns: 1fr;
          place-items: center;
          gap: 1px;
          padding: 5px 3px;
          text-align: center;
        }
        .achievement-nav-icon { width: 24px; height: 24px; font-size: 12px; }
        .achievement-nav-icon img { width: 22px; height: 22px; }
        .achievement-nav-label { display: none; }
        .achievement-nav-short-label { display: block; font-size: 10px; }
        .achievement-floating-content-header { padding: 9px 11px; }
        .achievement-floating-content-header h2 { font-size: 17px; }
        .achievement-mini-stats { display: none; }
        .achievement-floating-scroll-area { padding: 8px; }
        .floating-achievement-row { grid-template-columns: 78px minmax(0, 1fr); padding: 8px; }
        .floating-achievement-icon-shell { min-height: 76px; }
        .floating-achievement-icon { width: 68px; height: 68px; }
        .floating-achievement-heading h3,
        .floating-sticker-heading h3 { font-size: 15px; }
      }

      @media (max-width: 620px) {
        .achievement-floating-backdrop { padding: 0; }
        .achievement-floating-window {
          height: 100dvh;
          padding: 18px 16px 20px;
          grid-template-rows: 58px minmax(0, 1fr) 42px;
        }
        .achievement-title-ornament { display: none; }
        .achievement-floating-titlebar {
          grid-template-columns: 1fr;
          padding: 6px 52px 6px 10px;
        }
        .achievement-floating-title-text { min-width: 0; width: 190px; justify-self: center; }
        .achievement-floating-title-text span { display: none; }
        .achievement-floating-title-text h1 { font-size: 20px; }
        .achievement-floating-close { top: 9px; right: 9px; width: 37px; height: 37px; }
        .achievement-floating-body {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
          padding: 7px;
        }
        .achievement-floating-sidebar {
          min-width: 0;
          display: block;
          padding: 5px;
        }
        .achievement-floating-sidebar nav {
          flex-direction: row;
          gap: 5px;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .achievement-floating-sidebar button {
          flex: 0 0 66px;
          min-height: 42px;
        }
        .achievement-nav-icon { width: 28px; height: 28px; }
        .achievement-nav-icon img { width: 26px; height: 26px; }
        .achievement-floating-sidebar button:hover { transform: translateY(-1px); }
        .achievement-floating-content-header > div:first-child > span { display: none; }
        .achievement-floating-content-header h2 { font-size: 15px; }
        .achievement-floating-refresh { width: 31px; height: 31px; }
        .floating-achievement-row,
        .floating-sticker-row {
          grid-template-columns: 66px minmax(0, 1fr);
          gap: 8px;
          padding: 7px;
        }
        .floating-achievement-icon-shell,
        .floating-sticker-icon-shell { min-height: 64px; border-width: 2px; }
        .floating-achievement-icon,
        .floating-sticker-icon-shell img { width: 58px; height: 58px; }
        .floating-achievement-status span,
        .floating-achievement-category,
        .floating-sticker-heading span { display: none; }
        .floating-achievement-status strong,
        .floating-sticker-heading > strong { font-size: 12px; }
        .floating-achievement-info > p,
        .floating-sticker-info > p {
          margin: 3px 0 6px;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .floating-achievement-ranks span { min-width: 23px; height: 17px; font-size: 8px; }
        .achievement-floating-footer {
          grid-template-columns: auto minmax(70px, 1fr) auto;
          padding: 7px 9px;
        }
        .achievement-floating-footer small { display: none; }
      }
    `}</style>
  );
}
