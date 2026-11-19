import { largestComparableCount, ObservationResults } from "../components/professional/ObservationResults";
import { formatMetric as metricText, formatAccuracy, formatDifficulty, formatReactionTime } from "../utils/professionalFormatters";
import { ProfessionalNavigation } from "../components/professional/ProfessionalNavigation";
import { useProfessionalWorkspace } from "../components/professional/ProfessionalWorkspaceContext";
import { DataStatus, ProfessionalTaskCards, TaskMetricDetail, RecordComparison } from "../components/professional/ProfessionalData";
import { ProfessionalRecords } from "../components/professional/ProfessionalRecords";
import { compareRecords, describeRecord, numberOrNull, taskHistory } from "../utils/professionalMetrics";
import { patientDataStatus } from "../utils/professionalStatus";
import { buildProfessionalReport } from "../utils/professionalReport";

import assistIcon from "../asset/assist.webp";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { AssistantEmailChoice, AssistantEmailStatus, useAssistantEmail } from "../components/AssistantEmailControls";
import { dedupeClinicalRecords } from "../utils/resultIdentity";
import { getResultCompletionStatus, isCompletedResult } from "../utils/resultCompletion";
import { getSrtClinicalMetrics } from "../utils/srtClinicalMetrics";
import { getCbtClinicalMetrics } from "../utils/cbtClinicalMetrics";
import { getPmClinicalMetrics } from "../utils/pmClinicalMetrics";
import { getLbClinicalMetrics } from "../utils/lbClinicalMetrics";
import { getAriClinicalMetrics } from "../utils/ariClinicalMetrics";
import { getDccsClinicalMetrics } from "../utils/dccsClinicalMetrics";
import { getDccsTrainingConfig, normalizeDccsTrainingDifficulty } from "../utils/dccsTrainingProtocol";
import {
  AddPatientModal,
  ClinicianDashboardHeader,
  DashboardLoadError,
  DashboardStats,
} from "../components/clinician/ClinicianDashboardShell";
import {
  calculateAge,
  daysSince,
  formatDate,
  formatGender,
  formatTrendRecordDate,
} from "../utils/clinicianDashboardFormatters";

const RECORD_SOURCES = [
  { table: "game_results", fallbackType: "session" },
];

const GAME_NAME_MAP = {
  SRT: "松鼠接橡實",
  PM: "圖片記憶",
  CBT: "跳石橋",
  ARI: "動物聲音辨識",
  DCCS: "衣物分類",
  LB: "幫助迷路的綿羊奶奶",
};

const ABILITY_BY_GAME = {
  SRT: "反應速度 / 抑制控制",
  PM: "工作記憶",
  CBT: "序列記憶 / 注意維持",
  ARI: "選擇性注意 / 抑制控制",
  DCCS: "認知彈性",
  LB: "排序能力 / 規則理解",
};

const GAME_THEME_MAP = Object.fromEntries(Object.keys(GAME_NAME_MAP).map((task) => [task, { primary: "#163B59", dark: "#163B59", soft: "#EAF1F6", border: "#c9d6df" }]));

const CLINICIAN_LOGIN_ROUTE = "/clinician-login";
const CLINICIAN_ROLES = ["clinician", "medical", "doctor", "醫療人員"];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isClinicianRole(role) {
  return CLINICIAN_ROLES.includes(normalizeRole(role));
}

async function getClinicalApiHeaders(expectedOwner) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data?.session?.access_token;
  if (!accessToken) throw new Error("登入狀態已失效，請重新登入。");
  if (expectedOwner && data.session.user?.id !== expectedOwner) throw new Error("登入帳號已變更，請重新選取個案。");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

const REMINDER_TEMPLATES = [
  {
    key: "follow_up",
    label: "提醒回診",
    text: "您好，提醒您孩子近期需要回診或進行認知功能追蹤檢查，建議協助安排後續時間，謝謝。",
  },
  {
    key: "training",
    label: "提醒完成訓練",
    text: "您好，系統顯示孩子近期訓練紀錄較少，建議本週安排 2 至 3 次短時間訓練，協助維持學習與追蹤資料完整性。",
  },
  {
    key: "test",
    label: "提醒重新測驗",
    text: "您好，孩子距離上次測驗已有一段時間，建議安排一次新的測驗，以利醫療人員追蹤近期表現變化。",
  },
  {
    key: "check_report",
    label: "提醒查看報告",
    text: "您好，孩子已有新的測驗或訓練結果，建議您登入平台查看近期表現摘要，若有疑問可於回診時與醫療人員討論。",
  },
  {
    key: "inspection",
    label: "提醒補做檢查",
    text: "您好，孩子目前追蹤資料不足，建議補做相關測驗或檢查，協助醫療人員更完整了解近期狀態。",
  },
];


const LOCAL_RESULT_KEYS = [
  { key: "efGameResults", gameKey: "", fallbackType: "session" },
  { key: "SRT_RESULT", gameKey: "SRT", fallbackType: "test" },
  { key: "srtTestResult", gameKey: "SRT", fallbackType: "test" },
  { key: "latestSRTTestResult", gameKey: "SRT", fallbackType: "test" },
  { key: "srtTrainingResult", gameKey: "SRT", fallbackType: "training" },
  { key: "latestSRTTrainingResult", gameKey: "SRT", fallbackType: "training" },

  { key: "PM_RESULT", gameKey: "PM", fallbackType: "test" },
  { key: "pmTestResult", gameKey: "PM", fallbackType: "test" },
  { key: "latestPMTestResult", gameKey: "PM", fallbackType: "test" },
  { key: "PMTestResult", gameKey: "PM", fallbackType: "test" },
  { key: "pictureMemoryTestResult", gameKey: "PM", fallbackType: "test" },
  { key: "pmTrainingResult", gameKey: "PM", fallbackType: "training" },
  { key: "latestPMTrainingResult", gameKey: "PM", fallbackType: "training" },

  { key: "CBT_RESULT", gameKey: "CBT", fallbackType: "test" },
  { key: "cbtTestResult", gameKey: "CBT", fallbackType: "test" },
  { key: "latestCBTTestResult", gameKey: "CBT", fallbackType: "test" },
  { key: "cbtTrainingResult", gameKey: "CBT", fallbackType: "training" },
  { key: "latestCBTTrainingResult", gameKey: "CBT", fallbackType: "training" },

  { key: "ARI_RESULT", gameKey: "ARI", fallbackType: "test" },
  { key: "ariTestResult", gameKey: "ARI", fallbackType: "test" },
  { key: "latestARITestResult", gameKey: "ARI", fallbackType: "test" },
  { key: "ariTrainingResult", gameKey: "ARI", fallbackType: "training" },
  { key: "latestARITrainingResult", gameKey: "ARI", fallbackType: "training" },

  { key: "DCCS_RESULT", gameKey: "DCCS", fallbackType: "test" },
  { key: "dccsTestResult", gameKey: "DCCS", fallbackType: "test" },
  { key: "latestDCCSTestResult", gameKey: "DCCS", fallbackType: "test" },
  { key: "dccsTrainingResult", gameKey: "DCCS", fallbackType: "training" },
  { key: "latestDCCSTrainingResult", gameKey: "DCCS", fallbackType: "training" },

  { key: "LB_RESULT", gameKey: "LB", fallbackType: "test" },
  { key: "lbTestResult", gameKey: "LB", fallbackType: "test" },
  { key: "latestLBTestResult", gameKey: "LB", fallbackType: "test" },
  { key: "lbTrainingResult", gameKey: "LB", fallbackType: "training" },
  { key: "latestLBTrainingResult", gameKey: "LB", fallbackType: "training" },
];

const LOCAL_PATIENT_KEYS = [
  "selectedPatientId",
  "selectedChildId",
  "currentPatientId",
  "currentChildId",
  "patientId",
  "childId",
];

function safeParseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("JSONB 欄位解析失敗，已使用安全預設值：", error);
      return fallback;
    }
  }
  return value;
}

function asObject(value, fallback = {}) {
  const parsed = safeParseJson(value, fallback);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
}

function asArray(value, fallback = []) {
  const parsed = safeParseJson(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

function firstObject(...values) {
  for (const value of values) {
    const parsed = asObject(value, null);
    if (parsed && Object.keys(parsed).length > 0) return parsed;
  }
  return {};
}

function firstArray(...values) {
  for (const value of values) {
    const parsed = asArray(value, null);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }
  return null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function safeNumberValue(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value.replace("%", "").replace("ms", "").trim();
    const number = Number(cleaned);
    if (Number.isFinite(number)) return number;
  }
  return fallback;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = safeNumberValue(value, NaN);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function toPercent(value, fallback = 0) {
  const number = safeNumberValue(value, NaN);
  if (!Number.isFinite(number)) return fallback;
  if (number >= 0 && number <= 1) return Math.round(number * 100);
  return Math.round(number);
}

function inferGameKey(item = {}, sourceTable = "", sourceGameKey = "") {
  const payloadData = asObject(item.payload);
  const payloadRawResult = asObject(payloadData.rawResult);
  const candidates = [
    sourceGameKey,
    item.game_id,
    item.game_key,
    payloadData.game?.gameId,
    payloadData.game?.game_id,
    payloadRawResult.gameId,
    payloadRawResult.game_id,
    item.gameKey,
    item.game_type,
    item.gameType,
    item.game,
    item.task,
    item.test_type,
    item.testType,
    item.module,
    item.result?.gameKey,
    item.result?.game_key,
    item.summary?.gameKey,
    item.summary?.game_key,
    item.config?.gameKey,
  ];

  const sourceText = `${sourceTable} ${candidates.filter(Boolean).join(" ")}`.toLowerCase();
  if (sourceText.includes("dccs")) return "DCCS";
  if (sourceText.includes("srt")) return "SRT";
  if (sourceText.includes("cbt")) return "CBT";
  if (sourceText.includes("ari")) return "ARI";
  if (sourceText.includes("lb")) return "LB";
  if (sourceText.includes("picture") || sourceText.includes("pm")) return "PM";

  const raw = firstDefined(...candidates, "未分類");
  return String(raw).toUpperCase();
}

function normalizeRecordFilterType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("test") || text.includes("測驗") || text === "assessment") return "test";
  if (text.includes("train") || text.includes("訓練") || text === "practice") return "training";
  return text || "session";
}

function normalizeRecordFilterGameKey(value, record = {}) {
  // 篩選時以畫面實際顯示的遊戲名稱為最高優先，避免舊資料中的
  // gameKey / ability / sourceTable 含有其他遊戲字樣，造成勾選一個遊戲卻混入別的紀錄。
  const displayName = String(record.gameName || record.game_name || "").trim().toLowerCase();
  const displayNameMap = {
    "松鼠接橡實": "SRT",
    "圖片記憶": "PM",
    "跳石橋": "CBT",
    "動物聲音辨識": "ARI",
    "衣物分類": "DCCS",
    "綿羊回家": "LB",
    "數字門牌": "LB",
  };

  if (displayNameMap[displayName]) return displayNameMap[displayName];

  // 只接受明確的遊戲代碼，不再使用 ability 等模糊文字判斷。
  const exactCandidates = [
    value,
    record.gameKey,
    record.game_key,
    record.raw?.game_id,
    record.raw?.game_key,
    record.raw?.gameKey,
    record.raw?.payload?.game?.gameId,
    record.raw?.payload?.game?.game_id,
  ];

  for (const candidate of exactCandidates) {
    const normalized = String(candidate || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (Object.prototype.hasOwnProperty.call(GAME_NAME_MAP, normalized)) {
      return normalized;
    }
  }

  // 最後才針對名稱做明確比對；不讀取能力欄位，避免「抑制控制」等共通能力誤分類。
  const nameText = `${displayName} ${String(record.raw?.game_name || record.raw?.gameName || "").toLowerCase()}`;
  if (nameText.includes("松鼠接橡實")) return "SRT";
  if (nameText.includes("圖片記憶") || nameText.includes("picture memory")) return "PM";
  if (nameText.includes("跳石橋")) return "CBT";
  if (nameText.includes("動物聲音辨識")) return "ARI";
  if (nameText.includes("衣物分類")) return "DCCS";
  if (nameText.includes("綿羊回家") || nameText.includes("數字門牌")) return "LB";

  return "";
}

function getTrialLogs(item = {}) {
  const payloadData = asObject(item.payload);
  const summaryData = asObject(item.summary_data);
  const resultData = asObject(item.result_data);
  const clinicianMetrics = asObject(item.clinician_metrics);

  return firstArray(
    payloadData.trials,
    payloadData.trialRecords,
    payloadData.trial_logs,
    payloadData.rawResult?.trials,
    payloadData.rawResult?.trialRecords,
    item.trials,
    item.trialRecords,
    item.trial_records,
    item.trialLogs,
    item.trial_logs,
    item.trial_details,
    item.trialDetails,
    item.detail,
    item.details,
    item.events,
    item.logs,
    item.history,
    item.records,
    summaryData.trials,
    summaryData.trialLogs,
    summaryData.history,
    resultData.trials,
    resultData.trialLogs,
    clinicianMetrics.trialLogs,
    item.result?.trials,
    item.result?.trialLogs,
    item.result?.clinicianMetrics?.trialLogs,
    item.lbResult?.clinicianMetrics?.trialLogs,
    item.scoreResult?.clinicianMetrics?.trialLogs,
    item.dccsTrialLogs,
    item.lbTrialLogs,
    item.cbtHistory,
    item.history,
    item.rawHistory,
    item.scoring?.records,
    item.scoring?.history
  );
}


function getMetricsObjects(item = {}) {
  const payloadData = asObject(item.payload);
  const payloadRawResult = asObject(payloadData.rawResult);
  const payloadGame = asObject(payloadData.game);
  const payloadSession = asObject(payloadData.session);
  const payloadSummary = asObject(payloadData.summary);
  const payloadMetrics = asObject(payloadData.metrics);
  const payloadAi = asObject(payloadData.ai);
  const summaryData = asObject(item.summary_data);
  const resultData = asObject(item.result_data);
  const scoringData = asObject(item.scoring_data);
  const clinicianMetricsData = asObject(item.clinician_metrics);
  const parentMetricsData = asObject(item.parent_metrics);
  const childViewData = asObject(item.child_view);

  const result = firstObject(
    payloadData,
    payloadRawResult,
    payloadGame,
    payloadSession,
    item.result,
    item.lbResult,
    item.scoreResult,
    item.scoring,
    item.scoreData,
    resultData,
    scoringData,
    summaryData.result,
    summaryData.scoreResult
  );

  const summary = firstObject(
    payloadSummary,
    payloadRawResult.summary,
    item.summary,
    result.summary,
    item.summaryData,
    summaryData,
    resultData.summary,
    scoringData.summary
  );

  const clinician = firstObject(
    payloadMetrics,
    payloadAi,
    payloadRawResult.clinicianMetrics,
    item.clinicianMetrics,
    result.clinicianMetrics,
    clinicianMetricsData,
    summaryData.clinicianMetrics,
    resultData.clinicianMetrics
  );

  const parent = firstObject(
    payloadRawResult.parentMetrics,
    item.parentMetrics,
    result.parentMetrics,
    result.parentView,
    item.parentView,
    parentMetricsData,
    summaryData.parentMetrics,
    resultData.parentMetrics
  );

  const child = firstObject(
    payloadData.child,
    payloadRawResult.childView,
    item.childView,
    result.childView,
    childViewData,
    summaryData.childView,
    resultData.childView
  );

  return { result, summary, clinician, parent, child };
}


function inferLocalResultMeta(storageKey = "") {
  const key = String(storageKey || "");
  if (key.startsWith("efGameResultOutbox:")) return null;
  const lower = key.toLowerCase();

  let gameKey = "";
  if (lower.includes("dccs")) gameKey = "DCCS";
  else if (lower.includes("srt")) gameKey = "SRT";
  else if (lower.includes("cbt")) gameKey = "CBT";
  else if (lower.includes("ari")) gameKey = "ARI";
  else if (lower.includes("picturememory") || lower.includes("pmresult") || lower.includes("pmtest") || lower.includes("pmtraining")) gameKey = "PM";
  else if (lower.includes("lb_result") || lower.includes("lbtest") || lower.includes("lbtraining")) gameKey = "LB";

  if (!gameKey || !lower.includes("result")) return null;

  const fallbackType = lower.includes("training")
    ? "training"
    : lower.includes("test")
      ? "test"
      : "session";

  return { key, gameKey, fallbackType };
}

function readLocalResultPayloads(patientIds = []) {
  if (typeof window === "undefined") return [];

  const patientSet = new Set((patientIds || []).map((value) => String(value)));
  const getStorageValue = (storage, key) => {
    try {
      return storage?.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const getStoredPatientId = () => {
    for (const key of LOCAL_PATIENT_KEYS) {
      const value = getStorageValue(window.localStorage, key) || getStorageValue(window.sessionStorage, key);
      if (value) return value;
    }
    return "";
  };

  const getAllResultMetas = (storage) => {
    const metaMap = new Map(LOCAL_RESULT_KEYS.map((meta) => [meta.key, meta]));

    try {
      for (let index = 0; index < (storage?.length || 0); index += 1) {
        const key = storage.key(index);
        const inferred = inferLocalResultMeta(key);
        if (inferred && !metaMap.has(key)) metaMap.set(key, inferred);
      }
    } catch (error) {
      console.warn("瀏覽器結果 key 掃描失敗：", error);
    }

    return [...metaMap.values()];
  };

  const storedPatientId = getStoredPatientId();
  const payloads = [];

  [
    { storage: window.localStorage, source: "localStorage" },
    { storage: window.sessionStorage, source: "sessionStorage" },
  ].forEach(({ storage, source }) => {
    getAllResultMetas(storage).forEach((meta) => {
      const raw = getStorageValue(storage, meta.key);
      if (!raw) return;

      try {
        const parsed = safeParseJson(raw, null);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        list.forEach((entry, index) => {
          if (!entry || typeof entry !== "object") return;

          const item = firstObject(
            entry.rawResult,
            entry.resultPayload,
            entry.result,
            entry.data,
            entry
          );
          const payload = asObject(entry.payload);
          const patientId = firstDefined(
            entry.patient_id,
            entry.patientId,
            entry.child_id,
            entry.childId,
            entry.child?.childId,
            entry.child?.id,
            entry.currentChild?.id,
            entry.profile?.patient_id,
            entry.profile?.patientId,
            entry.config?.patient_id,
            entry.config?.patientId,
            payload.child?.childId,
            payload.child?.id,
            item.patient_id,
            item.patientId,
            item.child_id,
            item.childId,
            storedPatientId
          );

          if (patientSet.size > 0 && patientId && !patientSet.has(String(patientId))) return;

          payloads.push({
            ...item,
            ...entry,
            id: firstDefined(entry.id, item.id, entry.resultId, item.resultId, `${meta.key}-${index}`),
            patient_id: patientId || storedPatientId || patientIds[0] || "",
            game_key: firstDefined(entry.game_key, entry.gameKey, entry.game?.gameId, item.game_key, item.gameKey, item.gameId, meta.gameKey),
            record_type: firstDefined(
              entry.record_type,
              entry.session?.mode,
              entry.mode,
              entry.mode_type,
              entry.sourceMode,
              item.record_type,
              item.mode,
              meta.fallbackType
            ),
            created_at: firstDefined(
              entry.session?.finishedAt,
              entry.finishedAt,
              entry.createdAt,
              entry.created_at,
              entry.completedAt,
              entry.finished_at,
              entry.completed_at,
              entry.endedAt,
              entry.date,
              entry.savedAt,
              entry.generatedAt,
              item.created_at,
              item.finishedAt,
              item.createdAt,
              item.completedAt,
              item.finished_at,
              item.date
            ),
            __localKey: meta.key,
            __localSource: source,
          });
        });
      } catch (error) {
        console.warn(`${meta.key} 解析失敗，已略過：`, error);
      }
    });
  });

  return payloads;
}

function formatFileDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "unknown-date";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function sanitizeFileName(value) {
  return String(value || "report").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

function documentRefCreateAnchor(url, filename) {
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFileName(filename);
  window.document.body.appendChild(anchor);
  return anchor;
}

function firstTrialImage(trial = {}) {
  const candidates = [
    trial.screenshotUrl,
    trial.screenshot,
    trial.imageUrl,
    trial.image,
    trial.stimulusImage,
    trial.targetImage,
    trial.cardImage,
    trial.assetUrl,
    trial.target?.image,
    trial.stimulus?.image,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function normalizeTrialBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function getTrialReactionTime(trial = {}) {
  return firstDefined(trial.reactionTime, trial.responseTime, trial.rt, trial.reaction_time, trial.latency, trial.responseLatency);
}

function getTrialOutcome(trial = {}) {
  const missed = normalizeTrialBoolean(firstDefined(trial.missed, trial.timeout, trial.isTimeout));
  const falseClick = normalizeTrialBoolean(firstDefined(trial.falseClick, trial.wrongClick, trial.clickedWrong));
  const correct = normalizeTrialBoolean(firstDefined(trial.isCorrect, trial.correct, trial.success));
  const action = String(firstDefined(trial.action, trial.trainingAction, trial.legacyAction, trial.result, trial.status, trial.outcome, "") || "").toLowerCase();
  if (missed === true || action.includes("miss") || action.includes("timeout")) return { label: "未作答 / 逾時", tone: "warning" };
  if (falseClick === true || action.includes("false") || action.includes("wrong") || action.includes("error")) return { label: "誤點 / 錯誤", tone: "danger" };
  if (correct === true || action === "hit" || action.includes("correct") || action.includes("success")) return { label: "正確", tone: "success" };
  if (correct === false) return { label: "錯誤", tone: "danger" };
  return { label: action || "未標記", tone: "neutral" };
}

function buildTrialDataExplanation(trial = {}, record = null, index = 0) {
  const outcome = getTrialOutcome(trial);
  const rt = getTrialReactionTime(trial);
  if (record?.gameKey === "DCCS" && trial.protocolVersion) {
    return `第 ${trial.trialNumber} 題依${trial.rule === "type" ? "種類" : "顏色"}分類，作答上限 ${trial.answerTimeLimitMs / 1000} 秒，結果為「${outcome.label}」。實際 MOUSE 提醒 ${trial.promptCount ?? 0} 次。${trial.isReverseRule ? "作答時有風，採相反規則。" : "作答時採原本規則。"}提示出現時間、風效事件與正確分類箱保留於原始資料。`;
  }
  if (record?.gameKey === "ARI" && trial.protocolVersion) {
    return `第 ${trial.trialIndex} 題聽到${trial.soundType === "cat" ? "貓叫" : "狗叫"}，正確選擇為${trial.expectedTarget === "cat" ? "貓咪" : "狗狗"}，作答上限 ${trial.answerTimeLimit / 1000} 秒，結果為「${outcome.label}」。實際 MOUSE 提醒 ${trial.promptCount ?? 0} 次（等待提示 ${trial.idleHintCount ?? 0} 次、連錯提示 ${trial.consecutiveErrorHintCount ?? 0} 次），聲音重播 ${trial.replayCount ?? 0} 次。${trial.interference ? "本題含沙鈴干擾。" : ""}提醒與重播事件保留於原始資料。`;
  }
  if (record?.gameKey === "LB" && trial.protocolVersion) {
    return `第 ${trial.stepInLevel} 個目標為「${trial.expectedLabel}」，作答上限 ${trial.answerTimeLimit} 秒，本次操作結果為「${outcome.label}」。反應時間 ${rt ?? "未記錄"} ms；本次新出現 MOUSE 提醒 ${trial.promptCount ?? 0} 次（等待提示 ${trial.idleHintCount ?? 0} 次、規則錯誤提示 ${trial.ruleErrorHintCount ?? 0} 次）。同一提示持續顯示不重複計數，提示事件保留於原始資料。`;
  }
  if (record?.gameKey === "PM" && trial.protocolVersion) {
    const confusion = trial.confusionAnalysis;
    const relations = (confusion?.errors || []).map((error) => `${error.selectedId} → ${error.matchedTargetIds.join("、") || "無已定義關聯"}（${error.type === "visual_similarity" ? "相近外形" : error.type === "same_category" ? "同類物品" : "其他錯選"}）`).join("；");
    return `第 ${index + 1} 題記憶 ${trial.memoryCount} 個物件，觀看 ${trial.showTime} 秒、作答上限 ${trial.answerTimeLimit} 秒，結果為「${outcome.label}」。${rt != null ? `作答時間 ${rt} ms；` : ""}實際提醒 ${trial.promptCount ?? 0} 次。${relations ? `錯選與漏選目標關聯：${relations}。` : "未記錄可能混淆的錯選。"}相近外形或同類分類只標示可能關聯，不能確認實際錯誤原因。完整選取、取消選取與提示事件保留在本題原始資料。`;
  }
  const assisted = normalizeTrialBoolean(firstDefined(trial.assisted, trial.usedAssist, trial.hintUsed));
  const falseClickCount = Number(firstDefined(trial.falseClickCount, trial.wrongTapCount, trial.errorClickCount, 0)) || 0;
  const repeatedClickCount = Number(firstDefined(trial.repeatedClickCount, trial.repeatClickCount, 0)) || 0;
  const x = firstDefined(trial.positionX, trial.clickX, trial.x, trial.clickedX);
  const y = firstDefined(trial.positionY, trial.clickY, trial.y, trial.clickedY);
  const targetType = firstDefined(trial.targetType, trial.stimulusType, trial.itemType, "-");
  const scoreValue = firstDefined(trial.scoreValue, trial.trialScore, trial.points, "-");
  const locationText = x != null && y != null && Number.isFinite(Number(x)) && Number.isFinite(Number(y))
    ? `點擊位置約在畫面水平 ${Number(x).toFixed(1)}%、垂直 ${Number(y).toFixed(1)}%。`
    : "此題沒有完整的點擊座標資料。";
  return `第 ${index + 1} 題屬於「${record?.gameName || "目前遊戲"}」，系統結果為「${outcome.label}」。目標類型為 ${targetType}，${rt != null ? `反應時間為 ${rt} ms，` : ""}誤點 ${falseClickCount} 次、重複點擊 ${repeatedClickCount} 次，${assisted === true ? "有使用提示" : assisted === false ? "未使用提示" : "提示狀態未記錄"}，本題得分 ${metricText(scoreValue)}。${locationText} 單一 trial 只能說明當次作答行為，不能單獨推論整體認知能力或做出診斷。`;
}

function ClinicianDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useProfessionalWorkspace();
  const workspaceRef = useRef(workspace); workspaceRef.current = workspace;
  const ownerRef = useRef(null); const draftsRef = useRef({});
  const currentPatientRef = useRef("");
  const [reminders, setReminders] = useState([]);
  const [reminderHistoryError, setReminderHistoryError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteHistoryError, setNoteHistoryError] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [clinicianId, setClinicianId] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(() => workspace?.patientId || "");
  currentPatientRef.current = selectedPatientId;
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordDetailOpen, setRecordDetailOpen] = useState(false);
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [recordTypeFilters, setRecordTypeFilters] = useState([]);
  const [recordGameFilters, setRecordGameFilters] = useState([]);
  const [recordPage, setRecordPage] = useState(1);
  const [trendGameKey, setTrendGameKey] = useState("SRT");
  const [activePatientTab, setActivePatientTab] = useState(() => ["records", "tools"].includes(searchParams.get("section")) ? searchParams.get("section") : "trend");
  const [exportingRecordId, setExportingRecordId] = useState("");
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [exportingCombinedReport, setExportingCombinedReport] = useState(false);
  const recordPageSize = 10;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [addPatientSubmitting, setAddPatientSubmitting] = useState(false);
  const [addPatientError, setAddPatientError] = useState("");
  const [addPatientForm, setAddPatientForm] = useState({
    accessCode: "",
  });
  const [reminderTemplate, setReminderTemplate] = useState("follow_up");
  const [reminderMessage, setReminderMessage] = useState("");
  const [noteText, setNoteText] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const assistantEmail = useAssistantEmail(selectedPatientId);
  const [selectedTrialIndex, setSelectedTrialIndex] = useState(null);
  const [assistantMessages, setAssistantMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      content: "您好，我會依照你的問題分別整理最近結果、兩次比較、訓練建議、單題判定或家長說明，不會重複貼上同一份摘要。",
    },
  ]);
  const assistantMessagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const hasLoadedDashboardRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const recordDetailRef = useRef(null);

  useEffect(() => {
    const section = searchParams.get("section");
    if (["trend", "records", "tools"].includes(section)) setActivePatientTab(section);
  }, [searchParams]);
  useEffect(() => {
    const current = workspaceRef.current;
    if (clinicianId && selectedPatientId) {
      current?.selectPatient(clinicianId, selectedPatientId);
      const draft = current?.owner === clinicianId ? current.drafts[selectedPatientId] || "" : draftsRef.current[selectedPatientId] || "";
      draftsRef.current[selectedPatientId] = draft; setNoteText(draft);
    }
    setNoteError("");
  }, [selectedPatientId, clinicianId]);
  useEffect(() => {
    const warn = (event) => { if (Object.values(draftsRef.current).some(Boolean)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const updateNoteDraft = (text) => {
    setNoteText(text); draftsRef.current[selectedPatientId] = text;
    workspaceRef.current?.setDraft(clinicianId, selectedPatientId, text);
  };
  const guardDraft = () => !noteText.trim() || window.confirm("備註尚未儲存。草稿會保留於目前帳號的本次工作階段；關閉分頁或登出後會清除。要繼續切換嗎？");
  const selectSection = (section) => {
    if (!guardDraft()) return;
    setSearchParams({ section });
    if (["overview", "patients"].includes(section)) setActivePatientTab("trend");
  };
  const clearSensitiveData = () => {
    fetchRequestIdRef.current += 1;
    setPatients([]); setRecords([]); setNotes([]); setReminders([]); setSelectedPatientId("");
    setSelectedRecord(null); setSelectedRecordIds([]); setRecordDetailOpen(false); setNoteText("");
    setClinicianId(""); setClinicianName(""); setSearchText(""); setLoadError(""); setNoteError(""); setNoteHistoryError(""); setReminderHistoryError("");
    setAssistantMessages([]); setAssistantQuestion(""); setAssistantOpen(false); setAssistantLoading(false); setNoteSaving(false);
    draftsRef.current = {}; hasLoadedDashboardRef.current = false;
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchClinicianAndPatients();

    const scheduleRefresh = () => {
      if (document.visibilityState === "hidden") return;
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        fetchClinicianAndPatients();
      }, 180);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user?.id || null;
      if (ownerRef.current && ownerRef.current !== nextOwner) {
        clearSensitiveData(); ownerRef.current = nextOwner;
        if (nextOwner) window.setTimeout(fetchClinicianAndPatients, 0);
      }
      ownerRef.current = nextOwner;
      if (!nextOwner) navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
    });

    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("pageshow", scheduleRefresh);
    document.addEventListener("visibilitychange", scheduleRefresh);

    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("pageshow", scheduleRefresh);
      document.removeEventListener("visibilitychange", scheduleRefresh);
      authListener?.subscription?.unsubscribe?.();
    };
    // This effect owns one app-lifetime subscription; refresh callbacks read current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClinicianAndPatients = async () => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;

    try {
      if (!hasLoadedDashboardRef.current) setLoading(true);
      setLoadError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
      if (userError || !user) {
        navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
        return;
      }

      if (ownerRef.current && ownerRef.current !== user.id) {
        clearSensitiveData(); ownerRef.current = user.id;
        window.setTimeout(fetchClinicianAndPatients, 0); return;
      }
      ownerRef.current = user.id;
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;

      const isClinician = isClinicianRole(profileData?.role);
      if (profileError || !profileData || !isClinician) {
        await supabase.auth.signOut();
        navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
        return;
      }

      const { data: accessData, error: accessError } = await supabase
        .from("clinician_patient_access")
        .select("patient_id")
        .eq("clinician_id", user.id);

      const patientIds = [...new Set((accessData || []).map((item) => item.patient_id).filter(Boolean))];
      if (accessError) {
        throw new Error(`無法讀取醫療人員的個案授權：${accessError.message}`);
      }

      if (patientIds.length === 0) {
        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
        setClinicianId(user.id);
        setClinicianName(profileData.full_name || "醫療人員");
        setPatients([]);
        setRecords([]);
        setNotes([]);
        setSelectedPatientId("");
        hasLoadedDashboardRef.current = true;
        return;
      }

      const [patientResult, clinicalRecords, clinicalNotes] = await Promise.all([
        supabase
          .from("patients")
          .select("*")
          .in("id", patientIds)
          .order("created_at", { ascending: false }),
        fetchClinicalRecords(patientIds, user.id),
        fetchClinicalNotes(patientIds),
      ]);

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;

      if (patientResult.error) {
        throw new Error(`無法讀取個案資料：${patientResult.error.message}`);
      }

      const safePatients = patientResult.data || [];
      const allowedPatientIds = new Set(safePatients.map((patient) => String(patient.id)));
      const safeRecords = clinicalRecords.filter((record) => allowedPatientIds.has(String(record.patientId)));
      const safeNotes = Array.isArray(clinicalNotes)
        ? clinicalNotes.filter((note) => allowedPatientIds.has(String(note.patient_id)))
        : null;
      setClinicianId(user.id);
      setClinicianName(profileData.full_name || "醫療人員");
      setPatients(safePatients);
      setRecords(safeRecords);
      if (Array.isArray(clinicalNotes)) setNotes(safeNotes);
      setSelectedPatientId((currentId) => {
        const remembered = workspaceRef.current?.owner === user.id ? workspaceRef.current.patientId : "";
        return [currentId, remembered].find((id) => id && allowedPatientIds.has(String(id))) || safePatients[0]?.id || "";
      });
      setLoadError("");
      hasLoadedDashboardRef.current = true;
    } catch (error) {
      console.error("fetchClinicianAndPatients 發生錯誤：", error);
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        setLoadError(error?.message || "醫療端資料讀取失敗，請稍後重新整理。");
      }
    } finally {
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) setLoading(false);
    }
  };


  const fetchClinicalRecords = async (patientIds = [], ownerId) => {
    if (!patientIds.length) return [];

    const settledResults = await Promise.all(
      RECORD_SOURCES.map(async (source) => {
        const { data, error } = await supabase
          .from(source.table)
          .select("*")
          .in("patient_id", patientIds)
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(`${source.table} 讀取失敗：${error.message}`);
        }

        return (data || []).map((item) =>
          normalizeRecord(item, source.table, source.fallbackType, source.gameKey)
        );
      })
    );

    const allRecords = settledResults.flat();

    readLocalResultPayloads(patientIds).forEach((item) => {
      const localOwner = item.syncOwnerId || item.payload?.syncOwnerId || item.payload?.rawResult?.syncOwnerId;
      if (!ownerId || localOwner !== ownerId) return;
      allRecords.push(
        normalizeRecord(
          item,
          item.__localSource || "browserStorage",
          item.record_type || "session",
          item.game_key
        )
      );
    });

    return dedupeClinicalRecords(allRecords).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };


  const fetchClinicalNotes = async (patientIds = []) => {
    if (!patientIds.length) return [];

    const noteOwner = ownerRef.current;
    const { data, error } = await supabase
      .from("clinician_notes")
      .select("*")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    if (noteOwner !== ownerRef.current) return null;
    if (error) {
      console.warn(`clinician_notes 讀取失敗，保留既有備註：${error.message}`);
      setNoteHistoryError("備註歷程讀取失敗，已保留本次草稿。請重新整理重試。");
      return null;
    }

    setNoteHistoryError("");
    return data || [];
  };

  useEffect(() => {
    if (!clinicianId || !patients.length) { setReminders([]); return undefined; }
    let active = true;
    supabase.from("parent_reminders").select("*").in("patient_id", patients.map((p) => p.id)).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (!active) return; if (error) setReminderHistoryError("提醒歷程讀取失敗，可重新整理重試。"); else { setReminders(data || []); setReminderHistoryError(""); } });
    return () => { active = false; };
  }, [clinicianId, patients]);

  const normalizeRecord = (item, sourceTable, fallbackType, sourceGameKey = "") => {
    const { result, summary, clinician, parent, child } = getMetricsObjects(item);
    const trials = getTrialLogs(item);
    const gameKey = inferGameKey(item, sourceTable, sourceGameKey);
    const type = normalizeType(
      firstDefined(
        item.record_type,
        item.mode_type,
        item.type,
        item.mode,
        item.payload?.session?.mode,
        result.mode,
        summary.mode,
        item.config?.mode,
        fallbackType
      )
    );

    const total = firstNumber(
      item.total_trials,
      item.totalTrials,
      item.total,
      item.trial_count,
      item.trialCount,
      item.question_count,
      item.questionCount,
      item.totalQuestions,
      item.total_levels,
      item.totalLevels,
      item.completedTrials,
      summary.totalTrials,
      summary.totalQuestions,
      summary.totalLevels,
      clinician.totalTrials,
      clinician.total,
      trials?.length
    );

    const correct = firstNumber(
      item.correct_trials,
      item.correctTrials,
      item.correct,
      item.correct_count,
      item.correctCount,
      item.hitCount,
      summary.correct,
      summary.correctCount,
      summary.hitCount,
      clinician.correct,
      clinician.correctCount
    );

    const wrong = firstNumber(
      item.error_count,
      item.errorCount,
      item.wrong_trials,
      item.wrongTrials,
      item.wrong,
      item.wrongCount,
      item.timeoutCount,
      summary.timeoutCount,
      clinician.wrong,
      clinician.errorCount,
      clinician.timeoutCount
    );

    const errors = wrong || Math.max(total - correct, 0);
    const accuracy = toPercent(
      firstDefined(
        item.accuracy,
        item.accuracy_rate,
        item.accuracyRate,
        item.accuracyPercent,
        summary.accuracy,
        summary.accuracy_rate,
        summary.accuracyPercent,
        clinician.accuracy,
        clinician.accuracyPercent,
        parent.accuracy,
        total > 0 ? (correct / total) * 100 : 0
      )
    );

    const avgRt = Math.round(
      firstNumber(
        item.avg_rt,
        item.avg_reaction_time,
        item.avgRT,
        item.average_rt,
        item.averageRT,
        item.mean_reaction_time,
        item.meanReactionTime,
        item.rt_avg,
        item.avgReactionTime,
        item.reactionTime,
        summary.avgRT,
        summary.avgRt,
        summary.avgReactionTime,
        clinician.avgReactionTime,
        clinician.averageReactionTime,
        clinician.avgRT
      )
    );

    const score = firstNumber(
      item.score,
      item.final_score,
      item.finalScore,
      item.total_score,
      item.totalScore,
      result.score,
      result.finalScore,
      result.totalScore,
      summary.score,
      summary.finalScore,
      summary.totalScore,
      child.score
    );

    const stars = firstNumber(
      item.stars,
      item.star,
      item.rating,
      result.stars,
      result.star,
      child.stars,
      child.star
    );

    const level = firstDefined(
      item.difficulty,
      item.difficultyLabel,
      item.level,
      item.stage,
      item.completed_level,
      item.completedLevel,
      item.config?.difficulty,
      item.config?.difficultyLabel,
      summary.difficultyLabel,
      summary.level,
      "-"
    );

    const date = firstDefined(
      item.finished_at,
      item.created_at,
      item.completed_at,
      item.updated_at,
      item.date,
      item.savedAt,
      item.timestamp,
      ""
    );

    const normalized = {
      id: `${sourceTable}-${item.id || item.__localKey || `${gameKey}-${date}`}`,
      rawId: item.id || item.__localKey || "local",
      sourceTable: item.__localKey ? `${sourceTable}:${item.__localKey}` : sourceTable,
      sessionKey: firstDefined(
        item.session_id,
        item.sessionId,
        item.result_id,
        item.resultId,
        item.payload?.resultId,
        item.payload?.session?.id,
        item.payload?.session?.sessionId,
        result.session_id,
        result.sessionId,
        result.resultId,
        ""
      ),
      patientId: firstDefined(item.patient_id, item.patientId, item.child_id, item.childId, item.payload?.child?.childId, item.payload?.child?.id, item.config?.patientId, item.config?.patient_id, ""),
      type,
      gameKey,
      gameName: (item.game_name || item.gameName || item.payload?.game?.gameName || GAME_NAME_MAP[gameKey] || gameKey || "未分類")
        + (isCompletedResult(item) ? "" : "（未完成）"),
      completionStatus: getResultCompletionStatus(item),
      ability: item.ability || item.training_ability || item.trainingAbility || ABILITY_BY_GAME[gameKey] || "未分類能力",
      date,
      score,
      stars,
      accuracy,
      correct,
      total,
      errors,
      avgRt,
      ...(gameKey === "SRT" ? getSrtClinicalMetrics(item) : {}),
      ...(gameKey === "CBT" ? getCbtClinicalMetrics(item) : {}),
      ...(gameKey === "PM" ? getPmClinicalMetrics(item) : {}),
      ...(gameKey === "LB" ? getLbClinicalMetrics(item) : {}),
      ...(gameKey === "ARI" ? getAriClinicalMetrics(item) : {}),
      ...(gameKey === "DCCS" ? getDccsClinicalMetrics(item) : {}),
      duration: firstNumber(item.duration, item.duration_seconds, item.durationSeconds, item.total_time, item.totalTime, summary.duration, clinician.duration),
      difficulty: gameKey === "DCCS" && normalizeDccsTrainingDifficulty(level, null)
        ? getDccsTrainingConfig(level).label : level,
      status: isCompletedResult(item) ? item.status || item.finishReason || item.reason || "已完成" : "測驗中斷",
      completedLevel: firstDefined(item.completed_level, item.level_completed, item.completedLevel, item.stage, summary.completedLevel, "-"),
      raw: item,
      trials,
      metrics: { result, summary, clinician, parent, child },
    };
    const presentation = describeRecord(normalized);
    return { ...normalized, accuracy: presentation.accuracy, avgRt: presentation.rtMean,
      correct: presentation.correct, total: presentation.total,
      errors: presentation.total === null ? null : presentation.total - presentation.correct };
  };

  const normalizeType = (type) => {
    if (!type) return "session";
    const value = String(type).toLowerCase();
    if (value.includes("test") || value.includes("測驗")) return "test";
    if (value.includes("train") || value.includes("訓練")) return "training";
    return value;
  };

  const closeAssistant = () => {
    setAssistantOpen(false);
  };

  const handleLogout = async () => {
    if (!guardDraft()) return;
    await supabase.auth.signOut();
    navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
  };

  const handleAddPatientField = (field) => (event) => {
    setAddPatientForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const closeAddPatient = () => {
    if (addPatientSubmitting) return;
    setShowAddPatient(false);
    setAddPatientError("");
  };

  const handleClinicianAddPatient = async (event) => {
    event.preventDefault();
    if (addPatientSubmitting) return;

    const accessCode = addPatientForm.accessCode.trim();

    if (!accessCode) {
      setAddPatientError("請輸入家長提供的醫療授權碼。");
      return;
    }

    setAddPatientSubmitting(true);
    setAddPatientError("");

    try {
      const { data, error } = await supabase.rpc("redeem_patient_access_code", {
        provided_code: accessCode,
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) throw new Error(result?.message || "授權碼無效。");

      setAddPatientForm({ accessCode: "" });
      setShowAddPatient(false);
      await fetchClinicianAndPatients();
    } catch (error) {
      const message = String(error?.message || "新增兒童失敗，請稍後再試。");
      setAddPatientError(
        message.includes("Could not find the function")
          ? "尚未安裝兒童醫療授權碼功能，請先執行最新 Supabase migration。"
          : message
      );
    } finally {
      setAddPatientSubmitting(false);
    }
  };

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || patients[0] || null,
    [patients, selectedPatientId]
  );

  const selectedPatientRecords = useMemo(() => {
    if (!selectedPatient) return [];
    return records.filter((record) => record.patientId === selectedPatient.id);
  }, [records, selectedPatient]);

  const selectedPatientNotes = useMemo(() => {
    if (!selectedPatient) return [];
    return notes.filter((note) => note.patient_id === selectedPatient.id);
  }, [notes, selectedPatient]);

  const patientCards = useMemo(() => {
    return patients.map((patient) => {
      const patientRecords = records.filter((record) => record.patientId === patient.id);
      return {
        patient,
        records: patientRecords,
        risk: getRiskLevel(patientRecords),
        lastRecord: patientRecords[0] || null,
      };
    });
    // getRiskLevel is a pure render-local helper; patients/records are the data inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, records]);

  const filteredPatientCards = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return patientCards.filter(({ patient, risk }) => {
      const matchText = `${patient.nickname || ""} ${patient.full_name || ""} ${patient.parent_email || ""} ${patient.guardian_email || ""}`.toLowerCase();
      const matchKeyword = keyword ? matchText.includes(keyword) : true;
      const matchRisk = riskFilter === "all" ? true : risk.key === riskFilter;
      return matchKeyword && matchRisk;
    });
  }, [patientCards, searchText, riskFilter]);

  const toggleRecordTypeFilter = (typeKey) => {
    const normalizedKey = normalizeRecordFilterType(typeKey);
    setRecordTypeFilters((previous) => {
      const normalizedPrevious = previous.map(normalizeRecordFilterType);
      return normalizedPrevious.includes(normalizedKey)
        ? normalizedPrevious.filter((item) => item !== normalizedKey)
        : [...normalizedPrevious, normalizedKey];
    });
  };

  const toggleRecordGameFilter = (gameKey) => {
    const normalizedKey = String(gameKey || "").trim().toUpperCase();
    if (!GAME_NAME_MAP[normalizedKey]) return;

    setRecordGameFilters((previous) => {
      const normalizedPrevious = previous
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => GAME_NAME_MAP[item]);

      return normalizedPrevious.includes(normalizedKey)
        ? normalizedPrevious.filter((item) => item !== normalizedKey)
        : [...normalizedPrevious, normalizedKey];
    });
  };

  const filteredRecords = useMemo(() => {
    const selectedTypes = new Set(recordTypeFilters.map(normalizeRecordFilterType));
    const selectedGames = new Set(recordGameFilters.map((key) => String(key).toUpperCase()));

    return selectedPatientRecords.filter((record) => {
      const normalizedType = normalizeRecordFilterType(record.type);
      const normalizedGameKey = normalizeRecordFilterGameKey(record.gameKey, record);
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(normalizedType);
      const matchesGame = selectedGames.size === 0
        ? true
        : Boolean(normalizedGameKey) && selectedGames.has(normalizedGameKey);
      return matchesType && matchesGame;
    });
  }, [selectedPatientRecords, recordTypeFilters, recordGameFilters]);

  // 篩選條件改變時強制重建表格 body，避免資料來源存在重複 key 時，
  // React 沿用舊的 <tr> 而讓已被篩掉的遊戲仍殘留在畫面上。
  const recordFilterSignature = useMemo(() => {
    const types = [...recordTypeFilters].map(normalizeRecordFilterType).sort().join(",");
    const games = [...recordGameFilters].map((key) => String(key || "").trim().toUpperCase()).sort().join(",");
    const visibleIds = filteredRecords
      .map((record) => `${record.id}|${record.gameKey}|${record.type}|${record.date}`)
      .join(";");
    return `${selectedPatientId || "none"}::${types || "all-types"}::${games || "all-games"}::${visibleIds}`;
  }, [selectedPatientId, recordTypeFilters, recordGameFilters, filteredRecords]);

  const recordTotalPages = Math.max(1, Math.ceil(filteredRecords.length / recordPageSize));

  const visibleRecords = useMemo(() => {
    const safePage = Math.min(recordPage, recordTotalPages);
    const startIndex = (safePage - 1) * recordPageSize;
    return filteredRecords.slice(startIndex, startIndex + recordPageSize);
  }, [filteredRecords, recordPage, recordPageSize, recordTotalPages]);

  const testRecords = useMemo(
    () => selectedPatientRecords.filter((record) => record.type === "test" && describeRecord(record).complete),
    [selectedPatientRecords]
  );

  const trainingRecords = useMemo(
    () => selectedPatientRecords.filter((record) => record.type === "training" && describeRecord(record).complete),
    [selectedPatientRecords]
  );

  const dashboardStats = useMemo(() => {
    const needFollowUp = patientCards.filter(({ risk }) => risk.key === "warning" || risk.key === "danger").length;
    const newRecords = records.filter((record) => (daysSince(record.date) ?? 999) <= 7).length;

    return {
      patientCount: patients.length,
      totalTests: records.filter((record) => record.type === "test" && describeRecord(record).complete).length,
      totalTraining: records.filter((record) => record.type === "training" && describeRecord(record).complete).length,
      needFollowUp,
      newRecords,
    };
  }, [patients, records, patientCards]);

  const patientSummary = useMemo(() => {
    if (!selectedPatient) return null;

    const risk = getRiskLevel(selectedPatientRecords);
    const lastRecord = selectedPatientRecords[0] || null;
    const trendByGame = Object.keys(GAME_NAME_MAP).reduce((result, gameKey) => {
      result[gameKey] = buildGameTrendData(selectedPatientRecords, gameKey);
      return result;
    }, {});

    return {
      risk,
      lastRecord,
      testCount: testRecords.length,
      trainingCount: trainingRecords.length,
      trendByGame,
    };
    // Pure formatting helpers do not carry state; list every data dependency instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, selectedPatientRecords, testRecords, trainingRecords]);

  const selectedTrendData = useMemo(() => {
    return patientSummary?.trendByGame?.[trendGameKey] || [];
  }, [patientSummary, trendGameKey]);

  const selectedTrial = useMemo(() => {
    const trials = Array.isArray(selectedRecord?.trials) ? selectedRecord.trials : [];
    if (selectedTrialIndex === null || selectedTrialIndex < 0 || selectedTrialIndex >= trials.length) return null;
    return trials[selectedTrialIndex];
  }, [selectedRecord, selectedTrialIndex]);

  useEffect(() => {
    if (!patientSummary) return;
    const firstGameWithData = Object.keys(GAME_NAME_MAP).find(
      (gameKey) => (patientSummary.trendByGame?.[gameKey] || []).length > 0
    );
    if (!patientSummary.trendByGame?.[trendGameKey]?.length && firstGameWithData) {
      setTrendGameKey(firstGameWithData);
    }
  }, [selectedPatientId, patientSummary, trendGameKey]);

  const compareA = useMemo(
    () => testRecords.find((record) => record.id === compareAId) || testRecords[1] || testRecords[0] || null,
    [testRecords, compareAId]
  );

  const compareB = useMemo(
    () => testRecords.find((record) => record.id === compareBId) || testRecords[0] || null,
    [testRecords, compareBId]
  );

  useEffect(() => {
    if (!selectedPatient) return;
    const template = REMINDER_TEMPLATES.find((item) => item.key === reminderTemplate) || REMINDER_TEMPLATES[0];
    setReminderMessage(personalizeTemplate(template.text, selectedPatient));
  }, [selectedPatient, reminderTemplate]);

  useEffect(() => {
    setCompareAId(testRecords[1]?.id || testRecords[0]?.id || "");
    setCompareBId(testRecords[0]?.id || "");
  }, [selectedPatientId, testRecords]);

  useEffect(() => {
    setRecordPage(1);
    setSelectedRecord(null);
    setRecordDetailOpen(false);
  }, [selectedPatientId, recordTypeFilters, recordGameFilters]);

  useEffect(() => {
    const filteredIdSet = new Set(filteredRecords.map((record) => record.id));
    setSelectedRecordIds((previous) => previous.filter((id) => filteredIdSet.has(id)));

    if (selectedRecord && !filteredRecords.some((record) => record.id === selectedRecord.id)) {
      setSelectedRecord(null);
      setRecordDetailOpen(false);
      setSelectedTrialIndex(null);
    }
  }, [filteredRecords, selectedRecord]);

  useEffect(() => {
    if (recordPage > recordTotalPages) setRecordPage(recordTotalPages);
  }, [recordPage, recordTotalPages]);

  useEffect(() => { setSelectedTrialIndex(null); }, [selectedRecord]);
  useEffect(() => {
    setAssistantMessages([{ id: "assistant-context", role: "assistant", content: "可依目前個案的作業資料整理觀察、證據與限制。" }]);
    setAssistantQuestion(""); setAssistantLoading(false);
  }, [selectedPatientId]);

  useEffect(() => {
    if (!recordDetailOpen || !selectedRecord) return;
    const timer = window.setTimeout(() => {
      recordDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [recordDetailOpen, selectedRecord]);

  function openRecordFromTrend(trendItem) {
    const record = trendItem?.record || selectedPatientRecords.find((item) => item.id === trendItem?.recordId);
    if (!record) return;

    setActivePatientTab("records");
    setSelectedRecord(record);
    setSelectedTrialIndex(null);
    setRecordDetailOpen(true);
  }

  function askAboutSelectedRecord() {
    if (!selectedRecord) return;
    setSelectedTrialIndex(null);
    setAssistantQuestion(`請完整解釋 ${selectedRecord.gameName} 在 ${formatDate(selectedRecord.date)} 的這次${selectedRecord.type === "test" ? "測驗" : selectedRecord.type === "training" ? "訓練" : "紀錄"}，包含客觀資料、初步解讀、限制與後續建議。`);
    setAssistantOpen(true);
  }

  function getRiskLevel(patientRecords) { return patientDataStatus(patientRecords || [], describeRecord); }

  function buildGameTrendData(patientRecords, gameKey) {
    return [...patientRecords]
      .filter((record) => record.gameKey === gameKey && describeRecord(record).complete && !describeRecord(record).integrityError && describeRecord(record).accuracy !== null)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .map((record, index) => ({
        recordId: record.id,
        label: formatTrendLabel(record.date, index),
        accuracy: describeRecord(record).accuracy,
        rt: describeRecord(record).rtMean,
        type: record.type,
        difficulty: record.difficulty,
        score: record.score,
        stars: record.stars,
        correct: record.correct,
        wrong: record.wrong,
        timeout: record.timeout,
        total: record.total,
        date: record.date,
        record,
      }));
  }

  function formatTrendLabel(value, index) {
    if (!value) return `第 ${index + 1} 次`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `第 ${index + 1} 次`;
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function personalizeTemplate(text, patient) {
    const name = patient?.nickname || patient?.full_name || "孩子";
    return text.replace("孩子", name);
  }

  const handleCreateReminder = async () => {
    if (!selectedPatient) return;

    const template = REMINDER_TEMPLATES.find((item) => item.key === reminderTemplate) || REMINDER_TEMPLATES[0];
    const message = reminderMessage.trim() || personalizeTemplate(template.text, selectedPatient);

    const targetOwner = clinicianId;
    const { data: savedReminder, error } = await supabase.from("parent_reminders").insert({
      patient_id: selectedPatient.id,
      clinician_id: clinicianId,
      reminder_type: reminderTemplate,
      title: template.label,
      message,
      status: "unread",
    }).select("*").single();
    if (ownerRef.current !== targetOwner) return;

    if (error) {
      console.error("parent_reminders 新增失敗：", error);
      alert("提醒建立失敗，請確認 parent_reminders 的 RLS 權限與資料表欄位。");
      return;
    }

    if (savedReminder) setReminders((prev) => [savedReminder, ...prev]);
    setReminderMessage(personalizeTemplate(template.text, selectedPatient));
    alert("已送出提醒給家長端。");
  };

  const handleSaveNote = async () => {
    if (!selectedPatient || !noteText.trim() || noteSaving) return;
    const patientId = selectedPatient.id; const owner = clinicianId; const text = noteText.trim();
    setNoteSaving(true); setNoteError("");
    try {
      const { data, error } = await supabase.from("clinician_notes").insert({ patient_id: patientId, clinician_id: owner, note: text }).select("*").single();
      if (ownerRef.current !== owner) return;
      if (error || !data?.id) throw error || new Error("未收到已儲存紀錄");
      setNotes((prev) => [data, ...prev]);
      if ((draftsRef.current[patientId] || "").trim() === text) {
        draftsRef.current[patientId] = ""; workspaceRef.current?.setDraft(owner, patientId, "");
        if (patientId === currentPatientRef.current) setNoteText("");
      }
    } catch (error) {
      if (ownerRef.current === owner) setNoteError(`儲存失敗，草稿已保留：${error.message || "請稍後重試"}`);
    } finally { if (ownerRef.current === owner) setNoteSaving(false); }
  };

  const generateLocalAssistantAnswer = async (question) => {
    const query = String(question || "").trim();
    if (!query) return "請輸入想了解的問題。";
    if (!selectedPatient || !patientSummary) return "請先從左側選擇一位個案，我才能根據該個案的資料回答。";

    const lower = query.toLowerCase();
    const patientName = selectedPatient.nickname || selectedPatient.full_name || "此兒童";
    const sortedRecords = [...selectedPatientRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedRecords[0] || null;

    const recordLine = (record) => { if (!record) return "尚無紀錄"; const d = describeRecord(record); return `${formatDate(record.date)}｜${record.gameName}｜${record.type === "training" ? "訓練" : "測驗"}｜正確 ${d.correct ?? "未記錄"}/${d.total ?? "未記錄"}（${metricText(d.accuracy, "%")}）｜正確有效 RT ${metricText(d.rtMean, " ms")}，n=${d.rtN}｜${d.status.label}`; };
    const asksAboutTrial = Boolean(selectedTrial) && (
      lower.includes("這張") || lower.includes("圖片") || lower.includes("這題") || lower.includes("trial") ||
      lower.includes("欄位") || lower.includes("json") || lower.includes("判定") || lower.includes("點擊") ||
      lower.includes("hit") || lower.includes("miss") || lower.includes("falseclick") || lower.includes("座標")
    );

    if (asksAboutTrial) {
      const imageUrl = firstTrialImage(selectedTrial);
      const payload = {
        question: query,
        patient: { id: selectedPatient.id, age: calculateAge(selectedPatient.birth_date) },
        record: selectedRecord ? {
          gameKey: selectedRecord.gameKey,
          gameName: selectedRecord.gameName,
          type: selectedRecord.type,
          difficulty: selectedRecord.difficulty,
        } : null,
        trialIndex: selectedTrialIndex,
        trial: selectedTrial,
        imageUrl,
      };

      try {
        const response = await fetch("/api/clinical-assistant", {
          method: "POST",
          headers: await getClinicalApiHeaders(clinicianId),
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.answer) return data.answer;
        }
      } catch (error) {
        console.warn("多模態臨床助手 API 無法使用，改用本機 trial 解釋：", error);
      }

      return `【單題判定說明】\n${buildTrialDataExplanation(selectedTrial, selectedRecord, selectedTrialIndex || 0)}\n\n【判讀限制】\n單一題目只能說明當次作答行為，不能單獨推論整體能力或作為診斷依據。`;
    }

    if (lower.includes("比較") || lower.includes("兩次")) {
      if (!compareA || !compareB || compareA.id === compareB.id) return "請先選擇兩筆不同的測驗紀錄。";
      const ordered = [compareA, compareB].sort((a,b) => new Date(a.date) - new Date(b.date));
      const comparison = compareRecords(...ordered);
      return `【觀察摘要】\n${comparison.comparable ? `正確率差 ${metricText(comparison.change, " 個百分點")}` : "暫不判定變化"}\n\n【資料證據】\n${ordered.map(recordLine).join("\n")}\n\n【解讀限制】\n${comparison.comparable ? "施測條件一致，僅能描述這兩次作業表現；兩筆不足以確定穩定趨勢。" : comparison.reasons.join("；")}；尚無臨床風險分級。`;
    }
    const matchedGame = Object.keys(GAME_NAME_MAP).find((key) => lower.includes(key.toLowerCase()) || lower.includes(GAME_NAME_MAP[key]));
    const target = matchedGame ? sortedRecords.find((r) => r.gameKey === matchedGame) : selectedRecord || latest;
    if (!target) return `${patientName}目前尚無可供分析的紀錄。`;
    const history = taskHistory(sortedRecords, target.gameKey);
    const comparison = history.comparison;
    return `【觀察摘要】\n${recordLine(target)}\n${comparison.comparable ? `最近兩次同條件正式測驗相差 ${metricText(comparison.change, " 個百分點")}。` : "尚無條件完整且一致的前次正式測驗，暫不判定變化。"}\n\n【資料證據】\n${JSON.stringify(describeRecord(target).specific)}\n\n【解讀限制】\n測驗與訓練、不同難度與施測版本分開解讀；目前沒有常模或臨床風險分級。若需訓練調整，請先核對規則理解、施測條件與人工備註，由專業人員決定。`;
  };

  const sanitizeAssistantRecord = (record) => {
    if (!record) return null;

    return {
      id: record.id || null,
      gameKey: record.gameKey || null,
      gameName: record.gameName || GAME_NAME_MAP[record.gameKey] || null,
      ability: ABILITY_BY_GAME[record.gameKey] || null,
      type: record.type || null,
      date: record.date || null,
      accuracy: describeRecord(record).accuracy,
      avgRt: describeRecord(record).rtMean,
      total: numberOrNull(record.total),
      correct: numberOrNull(record.correct),
      wrong: numberOrNull(record.wrong),
      timeout: numberOrNull(record.timeout),
      difficulty: firstDefined(record.difficulty, record.difficultyLevel, null),
      stars: numberOrNull(record.stars),
      score: numberOrNull(record.score),
      presentationMetrics: describeRecord(record),
      scoring: record.scoring ? asObject(record.scoring) : null,
      analysis: record.analysis ? asObject(record.analysis) : null,
    };
  };

  const buildHistoricalAssistantData = (sortedRecords = []) => {
    const safeRecords = sortedRecords.filter(Boolean);
    const selectedIds = new Set(selectedRecordIds.map((id) => String(id)));
    const byGame = safeRecords.reduce((acc, record) => {
      const gameKey = record.gameKey || "UNKNOWN";
      if (!acc[gameKey]) acc[gameKey] = [];
      acc[gameKey].push(record);
      return acc;
    }, {});

    const gameSummaries = Object.fromEntries(
      Object.entries(byGame).map(([gameKey, gameRecords]) => {
        const sortedGameRecords = [...gameRecords].sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );

        return [
          gameKey,
          {
            gameName: GAME_NAME_MAP[gameKey] || sortedGameRecords[0]?.gameName || gameKey,
            ability: ABILITY_BY_GAME[gameKey] || sortedGameRecords[0]?.ability || null,
            recordCount: sortedGameRecords.length,
            testCount: sortedGameRecords.filter((record) => record.type === "test").length,
            trainingCount: sortedGameRecords.filter((record) => record.type === "training").length,
            conditionMixed: true,
            averageAccuracy: null,
            averageReactionTime: null,
            earliestDate: sortedGameRecords[sortedGameRecords.length - 1]?.date || null,
            latestDate: sortedGameRecords[0]?.date || null,
            latestRecord: sanitizeAssistantRecord(sortedGameRecords[0]),
          },
        ];
      })
    );

    const selectedRecords = selectedIds.size > 0
      ? safeRecords.filter((record) => selectedIds.has(String(record.id))).slice(0, 12)
      : [];

    return {
      source: "ClinicianDashboard selected patient history",
      recordCount: safeRecords.length,
      earliestDate: safeRecords[safeRecords.length - 1]?.date || null,
      latestDate: safeRecords[0]?.date || null,
      selectedRecordIds: [...selectedIds],
      selectedRecords: selectedRecords.map(sanitizeAssistantRecord),
      allRecords: safeRecords.slice(0, 80).map(sanitizeAssistantRecord),
      gameSummaries,
    };
  };

  const buildRagEnhancedQuestion = (question, context) => {
    const historicalData = context?.historicalData;
    if (!historicalData?.recordCount) return question;

    const historyLines = [
      `原始問題：${question}`,
      "",
      "以下是 ClinicianDashboard 已載入的既有個案資料摘要，請在 RAG 檢索與回答時一併納入；回答時仍直接回覆原始問題，不要逐字重述本段。",
      `資料筆數：${historicalData.recordCount}`,
      `資料期間：${formatDate(historicalData.earliestDate)} 至 ${formatDate(historicalData.latestDate)}`,
      ...Object.entries(historicalData.gameSummaries || {}).map(([gameKey, summary]) => (
        `${gameKey}/${summary.gameName}：${summary.recordCount} 筆，測驗 ${summary.testCount}、訓練 ${summary.trainingCount}；不同條件不合併平均` +
        `${summary.averageReactionTime ? `，平均反應 ${summary.averageReactionTime} ms` : ""}`
      )),
    ];

    if (context?.selectedRecord) {
      historyLines.push(
        `目前選取紀錄：${context.selectedRecord.gameName} ${context.selectedRecord.type}，正確率 ${metricText(context.selectedRecord.presentationMetrics?.accuracy, "%")}，平均反應 ${metricText(context.selectedRecord.presentationMetrics?.rtMean, " ms")}`
      );
    }

    if (Array.isArray(historicalData.selectedRecords) && historicalData.selectedRecords.length > 0) {
      historyLines.push(
        `已勾選紀錄：${historicalData.selectedRecords.map((record) => `${record.gameName || record.gameKey}/${formatDate(record.date)}`).join("；")}`
      );
    }

    return historyLines.join("\n").slice(0, 12_000);
  };

  const buildAssistantContext = () => {
    const sortedRecords = [...selectedPatientRecords].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30);

    const recentRecords = sortedRecords
      .filter((record) => {
        const recordDate = new Date(record.date || 0);
        return !Number.isNaN(recordDate.getTime()) && recordDate >= recentCutoff;
      })
      .slice(0, 30);

    const selectedTrialSummary = selectedTrial
      ? {
          index: selectedTrialIndex,
          outcome: getTrialOutcome(selectedTrial),
          reactionTime: getTrialReactionTime(selectedTrial),
          imageUrl: firstTrialImage(selectedTrial),
          data: selectedTrial,
        }
      : null;

    const historicalData = buildHistoricalAssistantData(sortedRecords);

    return {
      patient: selectedPatient
        ? {
            anonymousId: selectedPatient.id,
            age: calculateAge(selectedPatient.birth_date),
            gender: selectedPatient.gender || null,
          }
        : null,
      summary: patientSummary
        ? {
            riskLevel: "尚無臨床風險分級",
            dataQuality: patientSummary.risk?.label || null,
            testCount: safeNumberValue(patientSummary.testCount, 0),
            trainingCount: safeNumberValue(patientSummary.trainingCount, 0),
            interpretationRule: "不得將跨任務或不同條件的正確率平均解讀為整體能力；所有差值須通過 computedAnalysis 比較條件。",
          }
        : null,
      latestRecord: sanitizeAssistantRecord(sortedRecords[0]),
      selectedRecord: sanitizeAssistantRecord(selectedRecord),
      selectedTrial: selectedTrialSummary,
      comparison: {
        first: sanitizeAssistantRecord(compareA),
        second: sanitizeAssistantRecord(compareB),
      },
      recentRecords: recentRecords.map(sanitizeAssistantRecord),
      historicalData,
      gameDefinitions: Object.fromEntries(
        Object.keys(GAME_NAME_MAP).map((gameKey) => [
          gameKey,
          {
            name: GAME_NAME_MAP[gameKey],
            ability: ABILITY_BY_GAME[gameKey],
          },
        ])
      ),
    };
  };

  const buildComputedAnalysis = () => {
    const comparison = compareRecords(compareA, compareB);
    return { comparison: { directlyComparable: comparison.comparable, reasons: comparison.reasons, accuracyDifference: comparison.change },
      taskComparisons: Object.fromEntries(Object.keys(GAME_NAME_MAP).map((task) => { const h = taskHistory(selectedPatientRecords, task); return [task, { currentRecordId: h.latest?.id, previousRecordId: h.previous?.id, comparable: h.comparison.comparable, accuracyDifference: h.comparison.change, reasons: h.comparison.reasons }]; })),
      classification: "尚無臨床風險分級", instructions: "以觀察摘要、資料證據、解讀限制三段回答。缺值不補零；不使用 80/60 閾值推論能力、風險或自動升降難度。" };
  };

  const callClinicalAssistant = async (question) => {
    const conversationHistory = assistantMessages
      .slice(-10)
      .filter((message) => message?.content)
      .map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: String(message.content),
      }));

    const assistantContext = buildAssistantContext();
    const ragQuestion = buildRagEnhancedQuestion(question, assistantContext);

    const response = await fetch("/api/clinical-assistant", {
      method: "POST",
      headers: await getClinicalApiHeaders(clinicianId),
      body: JSON.stringify({
        question: ragQuestion,
        context: assistantContext,
        computedAnalysis: buildComputedAnalysis(),
        conversationHistory,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data?.error ||
        data?.answer ||
        (response.status === 500
          ? "AI 後端連線失敗，請確認 npm run server 已啟動。"
          : `AI API 請求失敗（${response.status}）`);
      const error = new Error(message);
      error.status = response.status;
      error.responseData = data;
      throw error;
    }

    const answer = String(data?.answer || "").trim();
    if (!answer) throw new Error("AI 沒有回傳有效答案");

    const sources = (Array.isArray(data?.sources) ? data.sources : [])
      .map((source, index) => ({
        id: String(firstDefined(source?.id, source?.documentId, `source-${index + 1}`)),
        title: String(firstDefined(source?.title, source?.name, "未命名資料來源")),
        author: firstDefined(source?.author, source?.organization, source?.publisher, null),
        year: firstDefined(source?.year, source?.publicationYear, null),
        page: firstDefined(source?.page, source?.pageNumber, null),
        url: firstDefined(source?.url, source?.sourceUrl, null),
        evidenceLevel: firstDefined(source?.evidenceLevel, source?.evidence_level, null),
        similarity: Number.isFinite(Number(source?.similarity)) ? Number(source.similarity) : null,
      }))
      .filter((source) => source.title);

    return {
      answer,
      sources,
      ragUsed: Boolean(data?.ragUsed ?? data?.rag_used ?? sources.length > 0),
    };
  };

  const generateAssistantAnswer = async (question) => {
    const query = String(question || "").trim();
    if (!query) return { answer: "請輸入想了解的問題。", sources: [], ragUsed: false };
    if (!selectedPatient || !patientSummary) {
      return {
        answer: "請先從左側選擇一位個案，我才能根據該個案資料回答。",
        sources: [],
        ragUsed: false,
      };
    }

    try {
      return await callClinicalAssistant(query);
    } catch (error) {
      if (error?.status) {
        const responseData = error.responseData || {};
        return {
          answer: String(responseData.answer || responseData.error || error.message || "AI 後端目前無法完成回答。"),
          sources: Array.isArray(responseData.sources) ? responseData.sources : [],
          ragUsed: Boolean(responseData.ragUsed),
          fallback: false,
        };
      }

      console.warn("AI 臨床助手無法使用，改用本機備援回答：", error);

      const fallbackAnswer = await generateLocalAssistantAnswer(query);

      return {
        answer: String(fallbackAnswer || "目前無法產生回覆。"),
        sources: [],
        ragUsed: false,
        fallback: true,
      };
    }
  };

  const sendAssistantQuestion = async (presetQuestion = "") => {
    const question = String(presetQuestion || assistantQuestion).trim();
    if (!question || assistantLoading) return;

    const requestOwner = ownerRef.current; const requestPatient = currentPatientRef.current;
    const emailChoice = assistantEmail.takeChoice();

    const userMessage = { id: `user-${emailChoice.requestId}`, role: "user", content: question };
    setAssistantMessages((previous) => [...previous, userMessage]);
    setAssistantQuestion("");
    setAssistantLoading(true);

    try {
      const result = await generateAssistantAnswer(question);
      if (ownerRef.current !== requestOwner || currentPatientRef.current !== requestPatient) return;
      const answerMessage = {
        id: `assistant-${emailChoice.requestId}`,
        role: "assistant",
        content: String(result?.answer || "目前無法產生回覆。"),
        sources: result?.sources || [],
        ragUsed: Boolean(result?.ragUsed),
        fallback: Boolean(result?.fallback),
      };
      setAssistantMessages((previous) => [...previous, answerMessage]);
      assistantEmail.deliver(emailChoice, {
        messageId: answerMessage.id, question, answer: answerMessage.content,
        sources: answerMessage.sources, fallback: answerMessage.fallback,
      });
    } catch (error) {
      if (ownerRef.current !== requestOwner || currentPatientRef.current !== requestPatient) return;
      console.error("AI 助手回答失敗：", error);
      setAssistantMessages((previous) => [
        ...previous,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "目前無法完成回答，請稍後再試，或改用下方快捷問題。",
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const clearAssistantChat = () => {
    setAssistantMessages([
      {
        id: `assistant-welcome-${Date.now()}`,
        role: "assistant",
        content: "對話已清除。請輸入你想了解的個案問題。",
      },
    ]);
  };

  useEffect(() => {
    setSelectedTrialIndex(null);
    setSelectedRecordIds([]);
    setAssistantMessages([
      {
        id: `assistant-patient-${Date.now()}`,
        role: "assistant",
        content: selectedPatientId
          ? "已切換個案。你可以詢問最近結果、趨勢、單題判定、訓練方向或家長說明。"
          : "請先選擇一位個案，再開始詢問。",
      },
    ]);
  }, [selectedPatientId]);

  useEffect(() => {
    if (assistantOpen) assistantMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages, assistantOpen]);

  const generateReportText = () => selectedPatient ? buildProfessionalReport({
    patientName: selectedPatient.nickname || selectedPatient.full_name || "未命名兒童",
    demographics: `年齡：${calculateAge(selectedPatient.birth_date)}｜性別：${formatGender(selectedPatient.gender)}`,
    records: selectedPatientRecords, notes: selectedPatientNotes,
    reminders: reminders.filter((r) => r.patient_id === selectedPatient.id), formatDate,
  }) : "尚無可產生的報告內容。";

  const exportRecordsToExcel = async (records, combined = false) => {
    if (!selectedPatient || records.length === 0) return;
    const exportOwner = clinicianId;
    try {
      if (combined) setExportingCombinedReport(true);
      else setExportingRecordId(records[0].id);
      const { createRecordWorkbook } = await import("../utils/clinicianExcelExport");
      const selectedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
      const patientName = selectedPatient.nickname || selectedPatient.full_name || "未命名兒童";
      const interpretationLines = [buildProfessionalReport({ patientName, records: selectedRecords, notes: selectedPatientNotes, reminders: reminders.filter((r) => r.patient_id === selectedPatient.id), formatDate })];
      const recommendationLines = ["不同任務、模式、難度與版本須分開解讀；沒有常模分類或自動升降難度建議。"];
      const workbook = createRecordWorkbook({
        patientName,
        age: calculateAge(selectedPatient.birth_date),
        gender: formatGender(selectedPatient.gender),
        records: selectedRecords,
        formatDate: (value) => formatDate(value, true),
        notes: combined ? [...interpretationLines, ...recommendationLines,
          "本報告僅供追蹤與討論參考，不等同正式診斷。不同遊戲、模式、難度、疲勞與資料筆數皆可能影響結果，需結合其他相關資料綜合判讀。"] : [],
      });
      const buffer = await workbook.xlsx.writeBuffer();
      if (ownerRef.current !== exportOwner) return;
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const suffix = combined ? "整合比較報告" : (records[0].gameKey || "GAME") + "_" + (records[0].type === "test" ? "測驗" : records[0].type === "training" ? "訓練" : "紀錄");
      const anchor = documentRefCreateAnchor(url, patientName + "_" + suffix + "_" + formatFileDate(combined ? new Date().toISOString() : records[0].date) + ".xlsx");
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Excel 匯出失敗：", error);
      window.alert("Excel 匯出失敗，請稍後再試。");
    } finally {
      if (combined) setExportingCombinedReport(false);
      else setExportingRecordId("");
    }
  };

  const exportRecordToExcel = (record) => {
    if (record) return exportRecordsToExcel([record]);
  };

  const exportSelectedRecordsToExcel = () => exportRecordsToExcel(
    selectedPatientRecords.filter((record) => selectedRecordIds.includes(record.id)), true
  );



  const renderRiskBadge = (risk) => risk ? <DataStatus tone={risk.tone}>{risk.label}</DataStatus> : null;

  return (
    <div className="clinician-dashboard-page professional-clinical" style={pageStyle}>
      <style>{responsiveCss}</style>
      <ProfessionalNavigation active={searchParams.get("section") || activePatientTab} onSelect={selectSection} onLeave={guardDraft}/>

      <ClinicianDashboardHeader clinicianName={clinicianName} onAddPatient={() => setShowAddPatient(true)} onRefresh={fetchClinicianAndPatients} onLogout={handleLogout} />

      {showAddPatient && (
        <AddPatientModal form={addPatientForm} error={addPatientError} submitting={addPatientSubmitting} onFieldChange={handleAddPatientField} onClose={closeAddPatient} onSubmit={handleClinicianAddPatient} />
      )}

      <DashboardLoadError message={loadError} hasCachedPatients={patients.length > 0} onRetry={fetchClinicianAndPatients} />
      <DashboardStats stats={dashboardStats} />

      {loading ? (
        <div style={emptyBoxStyle}>載入醫療端資料中...</div>
      ) : patients.length === 0 && !loadError ? (
        <div style={emptyBoxStyle}>目前尚未連結任何病患資料</div>
      ) : patients.length === 0 ? (
        <div style={emptyBoxStyle}>目前無法取得個案資料，請按「再試一次」。</div>
      ) : (
        <div className="clinician-dashboard-layout" style={{ ...layoutStyle, gridTemplateColumns: "310px minmax(0, 1fr)" }}>
          <aside className="clinician-dashboard-left clinician-dashboard-left-panel" style={leftPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>個案清單</h2>
                <p style={panelDescStyle}>搜尋、篩選並查看所有授權兒童</p>
              </div>
            </div>

            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜尋兒童或家長信箱"
              style={searchInputStyle}
            />

            <div style={riskFilterStyle}>
              <button onClick={() => setRiskFilter("all")} style={pillButtonStyle(riskFilter === "all")}>全部</button>
              <button onClick={() => setRiskFilter("danger")} style={pillButtonStyle(riskFilter === "danger")}>資料異常</button>
              <button onClick={() => setRiskFilter("warning")} style={pillButtonStyle(riskFilter === "warning")}>待確認</button>
              <button onClick={() => setRiskFilter("safe")} style={pillButtonStyle(riskFilter === "safe")}>品質通過</button>
              <button onClick={() => setRiskFilter("empty")} style={pillButtonStyle(riskFilter === "empty")}>資料不足</button>
            </div>

            <div className="clinician-dashboard-patient-list" style={patientListStyle}>
              {filteredPatientCards.map(({ patient, risk, lastRecord }) => {
                const active = selectedPatient?.id === patient.id;
                return (
                  <button
                    key={patient.id}
                    onClick={() => {
                      if (patient.id !== selectedPatientId && !guardDraft()) return;
                      setSelectedPatientId(patient.id);
                      setActivePatientTab("trend");
                      setSelectedRecord(null);
                      setRecordDetailOpen(false);
                    }}
                    style={{ ...patientListItemStyle, ...(active ? activePatientListItemStyle : {}) }}
                  >
                    <div style={patientListTopStyle}>
                      <strong style={patientListNameStyle}>{patient.nickname || patient.full_name || "未命名兒童"}</strong>
                      {renderRiskBadge(risk)}
                    </div>
                    <span style={patientListMetaStyle}>{calculateAge(patient.birth_date)}｜{formatGender(patient.gender)}</span>
                    <span style={patientListMetaStyle}>最近資料：{formatDate(lastRecord?.date)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="clinician-dashboard-center clinician-dashboard-main-panel" style={centerPanelStyle}>
            {selectedPatient && patientSummary && (
              <>
                <section className="clinician-dashboard-patient-header" style={patientHeaderCardStyle}>
                  <div>
                    <div style={patientTitleRowStyle}>
                      <h2 style={patientNameStyle}>{selectedPatient.nickname || selectedPatient.full_name || "未命名兒童"}</h2>
                      {renderRiskBadge(patientSummary.risk)}
                    </div>
                    <p style={patientInfoStyle}>出生日期：{selectedPatient.birth_date || "-"}　年齡：{calculateAge(selectedPatient.birth_date)}　性別：{formatGender(selectedPatient.gender)}</p>
                    <p style={patientInfoStyle}>家長聯絡：{selectedPatient.parent_email || selectedPatient.guardian_email || selectedPatient.parent_phone || "未填寫"}</p>
                  </div>

                  <div className="clinician-dashboard-mini-stats" style={patientMiniStatsStyle}>
                    <MiniStat label="測驗" value={patientSummary.testCount} />
                    <MiniStat label="訓練" value={patientSummary.trainingCount} />
                    <MiniStat label="最近正式測驗" value={formatDate(testRecords.find((r) => describeRecord(r).complete && describeRecord(r).total > 0)?.date)} />
                    <MiniStat label="未讀提醒" value={reminders.filter((r) => r.patient_id === selectedPatient.id && r.status === "unread").length} />
                  </div>
                </section>

                <nav className="clinician-dashboard-patient-tabs" style={patientTabsStyle} aria-label="個案資料選單">
                  {[
                    { key: "trend", label: "能力趨勢", desc: "六項摘要與折線圖" },
                    { key: "records", label: "紀錄與比較", desc: "篩選、比較與 Excel" },
                    { key: "tools", label: "個案工具", desc: "提醒、備註與摘要" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setActivePatientTab(tab.key); setSearchParams({ section: tab.key }, { replace: true }); }}
                      style={patientTabButtonStyle(activePatientTab === tab.key)}
                      aria-current={activePatientTab === tab.key ? "page" : undefined}
                    >
                      <strong style={patientTabLabelStyle}>{tab.label}</strong>
                      <span style={patientTabDescStyle}>{tab.desc}</span>
                    </button>
                  ))}
                </nav>

                {activePatientTab === "trend" && (
                <section style={analysisCardStyle}>
                  <div style={sectionHeaderRowStyle}>
                    <div>
                      <h3 style={smallSectionTitleStyle}>六項作業表現</h3>
                      <p style={panelDescStyle}>顯示最近一次有效正式測驗；訓練與未完成紀錄保留在詳細資料。不同作業分開解讀。</p>
                    </div>
                  </div>

                  <ProfessionalTaskCards records={selectedPatientRecords} active={trendGameKey} onSelect={setTrendGameKey} onDetail={(record) => openRecordFromTrend({ record })}/>

                  <div style={trendSectionStyle}>
                    <div style={trendHeaderStyle}>
                      <div>
                        <h3 style={trendTitleStyle}>{GAME_NAME_MAP[trendGameKey]}趨勢</h3>
                        <p style={panelDescStyle}>顯示此遊戲有效紀錄；僅在施測條件完整且一致的相鄰點之間連線。點選可查看完整紀錄。</p>
                      </div>
                      <div style={trendSwitchStyle}>
                        {Object.keys(GAME_NAME_MAP).map((gameKey) => (
                          <button
                            type="button"
                            key={gameKey}
                            onClick={() => setTrendGameKey(gameKey)}
                            style={gameSwitchButtonStyle(trendGameKey === gameKey, GAME_THEME_MAP[gameKey])}
                          >
                            {gameKey}
                          </button>
                        ))}
                      </div>
                    </div>
                    <TrendChart
                      key={`${selectedPatient?.id || "patient"}-${trendGameKey}`}
                      data={selectedTrendData}
                      theme={GAME_THEME_MAP[trendGameKey]}
                      gameName={GAME_NAME_MAP[trendGameKey]}
                      selectedRecordId={selectedRecord?.id}
                      onSelectRecord={openRecordFromTrend}
                    />
                  </div>
                </section>
                )}

                {activePatientTab === "records" && (
                  <>
                <section style={compareCardStyle}>
                  <div className="clinician-dashboard-section-header" style={recordsHeaderStyle}>
                    <div>
                      <h3 style={smallSectionTitleStyle}>兩次測驗比較</h3>
                      <p style={panelDescStyle}>選擇兩次測驗，快速比較分數、正確率、反應時間與錯誤次數。</p>
                    </div>
                  </div>

                  {testRecords.length < 2 ? (
                    <div style={emptySmallBoxStyle}>此兒童測驗紀錄不足 2 筆，暫時無法比較。</div>
                  ) : (
                    <>
                      <div className="clinician-dashboard-compare-select" style={compareSelectRowStyle}>
                        <select value={compareA?.id || ""} onChange={(event) => setCompareAId(event.target.value)} style={selectStyle}>
                          {testRecords.map((record) => (
                            <option key={record.id} value={record.id}>{formatDate(record.date)}｜{record.gameName}</option>
                          ))}
                        </select>
                        <span style={compareArrowStyle}>比較</span>
                        <select value={compareB?.id || ""} onChange={(event) => setCompareBId(event.target.value)} style={selectStyle}>
                          {testRecords.map((record) => (
                            <option key={record.id} value={record.id}>{formatDate(record.date)}｜{record.gameName}</option>
                          ))}
                        </select>
                      </div>
                      <RecordComparison a={compareA} b={compareB} />
                    </>
                  )}
                </section>

                <section style={recordsCardStyle}>
                  <div className="clinician-dashboard-section-header" style={recordsHeaderStyle}>
                    <div>
                      <h3 style={smallSectionTitleStyle}>測驗 / 訓練詳細資料</h3>
                      <p style={panelDescStyle}>包含遊戲、能力、模式、難度、分數、星級、正確率、反應時間與 trial 詳細紀錄。</p>
                    </div>
                    <div style={filterPanelStyle}>
                      <div style={filterSectionStyle}>
                        <span style={filterLabelStyle}>類型</span>
                        {[{ key: "test", label: "測驗" }, { key: "training", label: "訓練" }].map(({ key, label }) => (
                          <label key={key} style={checkboxLabelStyle(recordTypeFilters.includes(key))}>
                            <input
                              type="checkbox"
                              checked={recordTypeFilters.includes(key)}
                              onChange={() => toggleRecordTypeFilter(key)}
                              style={checkboxInputStyle}
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      <div style={filterSectionStyle}>
                        <span style={filterLabelStyle}>遊戲</span>
                        {Object.entries(GAME_NAME_MAP).map(([gameKey, gameName]) => (
                          <label
                            key={gameKey}
                            style={checkboxLabelStyle(recordGameFilters.includes(gameKey))}
                            title={gameName}
                          >
                            <input
                              type="checkbox"
                              checked={recordGameFilters.includes(gameKey)}
                              onChange={() => toggleRecordGameFilter(gameKey)}
                              style={checkboxInputStyle}
                            />
                            <span>{gameKey}</span>
                            <span style={checkboxGameNameStyle}>{gameName}</span>
                          </label>
                        ))}
                      </div>

                      <div style={filterFooterStyle}>
                        <span style={filterHintStyle}>
                          未勾選時顯示全部資料；可同時勾選多個類型與遊戲。
                        </span>
                        {(recordTypeFilters.length > 0 || recordGameFilters.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRecordTypeFilters([]);
                              setRecordGameFilters([]);
                            }}
                            style={clearFilterButtonStyle}
                          >
                            清除篩選
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {(recordTypeFilters.length > 0 || recordGameFilters.length > 0) && (
                    <div style={activeFilterSummaryStyle}>
                      <strong>目前篩選：</strong>
                      <span>{recordTypeFilters.length > 0 ? recordTypeFilters.map((type) => type === "test" ? "測驗" : "訓練").join("、") : "全部類型"}</span>
                      <span> × </span>
                      <span>{recordGameFilters.length > 0 ? recordGameFilters.map((key) => `${key} ${GAME_NAME_MAP[key] || ""}`).join("、") : "全部遊戲"}</span>
                      <span style={activeFilterCountStyle}>共 {filteredRecords.length} 筆</span>
                    </div>
                  )}

                  <div style={combinedExportBarStyle}>
                    <div>
                      <strong style={recordActionTitleStyle}>整合／比較 Excel</strong>
                      <span style={recordActionHintStyle}>勾選需要的測驗或訓練，可跨遊戲整合；通過任務、模式、難度、版本與題次條件比對才計算差值。Excel 包含摘要、逐題、原始資料、定義與限制。</span>
                    </div>
                    <div style={combinedExportActionsStyle}>
                      <span style={selectedCountBadgeStyle}>已選 {selectedRecordIds.length} 筆</span>
                      <button
                        type="button"
                        onClick={() => setSelectedRecordIds(filteredRecords.map((record) => record.id))}
                        disabled={filteredRecords.length === 0}
                        style={secondaryActionButtonStyle}
                      >
                        全選篩選結果
                      </button>
                      <button type="button" onClick={() => setSelectedRecordIds([])} disabled={selectedRecordIds.length === 0} style={secondaryActionButtonStyle}>
                        清除
                      </button>
                      <button
                        type="button"
                        onClick={exportSelectedRecordsToExcel}
                        disabled={selectedRecordIds.length === 0 || exportingCombinedReport}
                        style={{ ...excelButtonStyle, opacity: selectedRecordIds.length === 0 || exportingCombinedReport ? 0.55 : 1 }}
                      >
                        {exportingCombinedReport ? "整合中…" : "輸出整合 Excel"}
                      </button>
                    </div>
                  </div>

                  {selectedRecord && (
                    <div ref={recordDetailRef} className="clinician-dashboard-record-accordion" style={recordAccordionWrapStyle}>
                      <TaskMetricDetail record={selectedRecord}/>
                      <button
                        type="button"
                        onClick={() => setRecordDetailOpen((prev) => !prev)}
                        style={recordAccordionHeaderStyle}
                        aria-expanded={recordDetailOpen}
                      >
                        <span style={recordAccordionTitleStyle}>
                          {recordDetailOpen ? "▼" : "▶"} 目前查看：{selectedRecord.gameName}｜{formatDate(selectedRecord.date)}
                        </span>
                        <span style={recordAccordionHintStyle}>
                          {recordDetailOpen ? "點此收合詳細 trial 紀錄" : "點此展開詳細 trial 紀錄"}
                        </span>
                      </button>

                      {recordDetailOpen && (
                        <div style={recordAccordionBodyStyle}>
                          <div className="clinician-dashboard-record-actions" style={recordActionBarStyle}>
                            <div>
                              <strong style={recordActionTitleStyle}>該次完整紀錄</strong>
                              <span style={recordActionHintStyle}>此紀錄可由折線圖資料點或下方表格開啟；先查看完整摘要，再決定是否深入某一題。</span>
                            </div>
                            <div style={recordHeaderButtonGroupStyle}>
                              <button type="button" onClick={askAboutSelectedRecord} style={askRecordButtonStyle}>
                                詢問此次紀錄
                              </button>
                              <button
                                type="button"
                                onClick={() => exportRecordToExcel(selectedRecord)}
                                disabled={exportingRecordId === selectedRecord.id}
                                style={{ ...excelButtonStyle, opacity: exportingRecordId === selectedRecord.id ? 0.65 : 1 }}
                              >
                                {exportingRecordId === selectedRecord.id ? "產生中…" : "輸出 Excel"}
                              </button>
                            </div>
                          </div>
                          <div className="clinician-dashboard-detail-grid" style={recordDetailGridStyle}>
                            <InfoItem label="資料來源" value={selectedRecord.sourceTable} />
                            <InfoItem label="紀錄 ID" value={selectedRecord.id} />
                            <InfoItem label="遊戲" value={selectedRecord.gameName} />
                            <InfoItem label="能力" value={selectedRecord.ability} />
                            <InfoItem label="類型" value={selectedRecord.type === "test" ? "測驗" : selectedRecord.type === "training" ? "訓練" : "紀錄"} />
                            <InfoItem label="建立時間" value={formatDate(selectedRecord.date, true)} />
                            <InfoItem label="難度" value={formatDifficulty(selectedRecord.difficulty, selectedRecord.gameKey)} />
                            <InfoItem label="分數" value={metricText(selectedRecord.score)} />
                            <InfoItem label="星級" value={selectedRecord.stars != null ? `${metricText(selectedRecord.stars, "", 0)} 星` : "未記錄"} />
                            <InfoItem label="正確率" value={formatAccuracy(selectedRecord.correct, selectedRecord.total)} />
                            <InfoItem label="完成題數" value={selectedRecord.total ?? "資料不足"} />
                            <InfoItem label="正確題數" value={selectedRecord.correct ?? "資料不足"} />
                            <InfoItem label="錯誤題數" value={selectedRecord.wrong ?? selectedRecord.errors ?? "未記錄"} />
                            <InfoItem label="逾時題數" value={selectedRecord.timeout ?? "未記錄"} />
                            <InfoItem label="正確有效 RT" value={formatReactionTime(selectedRecord.avgRt, { n: describeRecord(selectedRecord).rtN })} />
                            {selectedRecord.gameKey === "DCCS" && <>
                              <InfoItem label="實際 MOUSE 提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="每題作答上限" value={selectedRecord.answerTimeLimitMs != null ? `${selectedRecord.answerTimeLimitMs / 1000} 秒` : "未記錄"} />
                              <InfoItem label="反向規則作答題數" value={selectedRecord.reverseRuleTrials != null ? `${selectedRecord.reverseRuleTrials} 題` : "未記錄"} />
                            </>}
                            {selectedRecord.gameKey === "SRT" && <>
                              <InfoItem label="反應時間標準差" value={selectedRecord.rtStd != null ? metricText(selectedRecord.rtStd, " ms") : "資料不足"} />
                              <InfoItem label="反應時間變異係數" value={selectedRecord.rtCV != null ? metricText(selectedRecord.rtCV) : "資料不足"} />
                              <InfoItem label="實際提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="後段標準差變化" value={selectedRecord.rtStdIncrease != null ? metricText(selectedRecord.rtStdIncrease, " ms") : "資料不足"} />
                              <InfoItem label="後段變異係數變化" value={selectedRecord.rtCVIncrease != null ? metricText(selectedRecord.rtCVIncrease) : "資料不足"} />
                            </>}
                            {selectedRecord.gameKey === "CBT" && <>
                              <InfoItem label="實際提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="等待提示次數" value={selectedRecord.idleHintCount != null ? `${selectedRecord.idleHintCount} 次` : "未記錄"} />
                              <InfoItem label="第二步答案提示次數" value={selectedRecord.wrongAnswerHintCount != null ? `${selectedRecord.wrongAnswerHintCount} 次` : "未記錄"} />
                              <InfoItem label="提前點擊（播放中）" value={selectedRecord.earlyClickCount != null ? `${selectedRecord.earlyClickCount} 次` : "未記錄"} />
                              <InfoItem label="提前點擊判讀" value="需確認是否理解播放已結束，不能僅據此判定衝動" />
                            </>}
                            {selectedRecord.gameKey === "ARI" && <>
                              <InfoItem label="實際 MOUSE 提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="等待提示次數" value={selectedRecord.idleHintCount != null ? `${selectedRecord.idleHintCount} 次` : "未記錄"} />
                              <InfoItem label="連錯提示次數" value={selectedRecord.consecutiveErrorHintCount != null ? `${selectedRecord.consecutiveErrorHintCount} 次` : "未記錄"} />
                              <InfoItem label="動物聲音重播次數" value={selectedRecord.replayCount != null ? `${selectedRecord.replayCount} 次` : "未記錄"} />
                              <InfoItem label="每題作答上限" value={selectedRecord.answerTimeLimitMs != null ? `${selectedRecord.answerTimeLimitMs / 1000} 秒` : "未記錄"} />
                            </>}
                            {selectedRecord.gameKey === "LB" && <>
                              <InfoItem label="實際 MOUSE 提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="等待提示次數" value={selectedRecord.idleHintCount != null ? `${selectedRecord.idleHintCount} 次` : "未記錄"} />
                              <InfoItem label="規則錯誤提示次數" value={selectedRecord.ruleErrorHintCount != null ? `${selectedRecord.ruleErrorHintCount} 次` : "未記錄"} />
                              <InfoItem label="每個門牌作答上限" value={selectedRecord.answerTimeLimit != null ? `${selectedRecord.answerTimeLimit} 秒` : "未記錄"} />
                            </>}
                            <InfoItem label="逐題資料" value={Array.isArray(selectedRecord.trials) ? `${selectedRecord.trials.length} 筆` : "0 筆"} />
                            {selectedRecord.gameKey === "PM" && <>
                              <InfoItem label="實際提醒次數" value={selectedRecord.promptCount != null ? `${selectedRecord.promptCount} 次` : "未記錄"} />
                              <InfoItem label="可能混淆的錯選" value={selectedRecord.possibleConfusionCount != null ? `${selectedRecord.possibleConfusionCount} 個` : "未記錄"} />
                              <InfoItem label="相近外形錯選" value={selectedRecord.visualConfusionCount != null ? `${selectedRecord.visualConfusionCount} 個` : "未記錄"} />
                              <InfoItem label="同類物品錯選" value={selectedRecord.categoryConfusionCount != null ? `${selectedRecord.categoryConfusionCount} 個` : "未記錄"} />
                              <InfoItem label="其他錯選" value={selectedRecord.unrelatedWrongCount != null ? `${selectedRecord.unrelatedWrongCount} 個` : "未記錄"} />
                              <InfoItem label="混淆判讀" value="依錯選物件與漏選目標的外形群組或素材分類標示可能關聯，不能確認實際錯誤原因" />
                            </>}
                          </div>
                          <div style={trialReviewSectionStyle}>
                            <div style={trialReviewHeaderStyle}>
                              <div>
                                <strong style={trialReviewTitleStyle}>逐題紀錄（進階查看）</strong>
                                <span style={trialReviewHintStyle}>先確認該次完整結果；需要深入時再選擇某一題，交由臨床助手解釋欄位、刺激與判定原因。</span>
                              </div>
                              {selectedTrial && (
                                <button type="button" onClick={() => setAssistantOpen(true)} style={askTrialButtonStyle}>詢問此題</button>
                              )}
                            </div>

                            {Array.isArray(selectedRecord.trials) && selectedRecord.trials.length > 0 ? (
                              <div className="clinician-dashboard-trial-layout" style={trialReviewLayoutStyle}>
                                <div style={trialListStyle}>
                                  {selectedRecord.trials.map((trial, index) => {
                                    const outcome = getTrialOutcome(trial);
                                    const active = selectedTrialIndex === index;
                                    return (
                                      <button
                                        type="button"
                                        key={`trial-${index}`}
                                        onClick={() => setSelectedTrialIndex(index)}
                                        style={{ ...trialListButtonStyle, ...(active ? activeTrialListButtonStyle : {}) }}
                                      >
                                        <span>第 {index + 1} 題</span>
                                        <span style={trialOutcomeBadgeStyle(outcome.tone)}>{outcome.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div style={trialPreviewPanelStyle}>
                                  {selectedTrial ? (
                                    <>
                                      {firstTrialImage(selectedTrial) ? (
                                        <img src={firstTrialImage(selectedTrial)} alt={`第 ${(selectedTrialIndex || 0) + 1} 題圖片`} style={trialPreviewImageStyle} />
                                      ) : (
                                        <div style={trialImagePlaceholderStyle}>此 trial 沒有儲存圖片或截圖 URL</div>
                                      )}
                                      <p style={trialLocalSummaryStyle}>{buildTrialDataExplanation(selectedTrial, selectedRecord, selectedTrialIndex || 0)}</p>
                                      <div style={trialQuickQuestionRowStyle}>
                                        {["解釋這張圖片", "為什麼這題這樣判定？", "這題的點擊位置代表什麼？", "請用專業方式說明此 trial"].map((question) => (
                                          <button
                                            type="button"
                                            key={question}
                                            onClick={() => {
                                              setAssistantQuestion(question);
                                              setAssistantOpen(true);
                                            }}
                                            style={trialQuickQuestionButtonStyle}
                                          >
                                            {question}
                                          </button>
                                        ))}
                                      </div>
                                      <details style={trialJsonDetailsStyle}>
                                        <summary style={trialJsonSummaryStyle}>展開此題原始 JSON</summary>
                                        <pre style={jsonBoxStyle}>{JSON.stringify(selectedTrial, null, 2)}</pre>
                                      </details>
                                    </>
                                  ) : (
                                    <div style={trialImagePlaceholderStyle}>請先從左側選擇一題</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={trialImagePlaceholderStyle}>此筆紀錄沒有可用的 trial 資料</div>
                            )}

                            <details style={allRawDetailsStyle}>
                              <summary style={trialJsonSummaryStyle}>展開此筆完整原始資料</summary>
                              <pre style={jsonBoxStyle}>{JSON.stringify(selectedRecord.raw, null, 2)}</pre>
                            </details>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <ProfessionalRecords key={recordFilterSignature} records={visibleRecords} selectedIds={selectedRecordIds}
                    onToggle={(id) => setSelectedRecordIds((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id])}
                    onOpen={(record) => { setSelectedRecord(record); setRecordDetailOpen(true); }} onExport={exportRecordToExcel}
                    exportingId={exportingRecordId} formatDate={formatDate}/>
                  {filteredRecords.length === 0 && <div style={emptyTableStyle}>目前沒有符合條件的資料</div>}

                  {filteredRecords.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                      <div style={{ fontSize: 13, color: "#607086", fontWeight: 700 }}>
                        共 {filteredRecords.length} 筆，第 {Math.min(recordPage, recordTotalPages)} / {recordTotalPages} 頁
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={pageSizeBadgeStyle}>每頁固定 10 筆</span>

                        <button
                          type="button"
                          onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
                          disabled={recordPage <= 1}
                          style={{ ...pillButtonStyle(false), opacity: recordPage <= 1 ? 0.45 : 1, cursor: recordPage <= 1 ? "not-allowed" : "pointer" }}
                        >
                          上一頁
                        </button>

                        {Array.from({ length: recordTotalPages }, (_, index) => index + 1)
                          .filter((page) => page === 1 || page === recordTotalPages || Math.abs(page - recordPage) <= 1)
                          .map((page, index, pages) => (
                            <span key={page} style={{ display: "contents" }}>
                              {index > 0 && page - pages[index - 1] > 1 && <span style={{ color: "#8a98aa" }}>…</span>}
                              <button
                                type="button"
                                onClick={() => setRecordPage(page)}
                                style={pillButtonStyle(recordPage === page)}
                              >
                                {page}
                              </button>
                            </span>
                          ))}

                        <button
                          type="button"
                          onClick={() => setRecordPage((page) => Math.min(recordTotalPages, page + 1))}
                          disabled={recordPage >= recordTotalPages}
                          style={{ ...pillButtonStyle(false), opacity: recordPage >= recordTotalPages ? 0.45 : 1, cursor: recordPage >= recordTotalPages ? "not-allowed" : "pointer" }}
                        >
                          下一頁
                        </button>
                      </div>
                    </div>
                  )}
                </section>
                  </>
                )}

                {activePatientTab === "tools" && (
                  <section style={analysisCardStyle}>
                    <div style={toolSectionHeaderStyle}>
                      <div>
                        <h3 style={smallSectionTitleStyle}>個案追蹤工具</h3>
                        <p style={panelDescStyle}>建立家長提醒、紀錄醫療備註，並整理個案報告摘要。提醒依建立類型呈現；備註屬人工觀察，與客觀測驗指標分開記錄。</p>
                      </div>
                    </div>

                    <div className="clinician-dashboard-tool-grid" style={toolGridStyle}>
                      <section style={reminderCardStyle}>
                        <h3 style={smallSectionTitleStyle}>家長提醒</h3>
                        <p style={panelDescStyle}>可建立回診、檢查、訓練或重新測驗提醒。</p>
                        <select value={reminderTemplate} onChange={(event) => setReminderTemplate(event.target.value)} style={selectStyle}>
                          {REMINDER_TEMPLATES.map((template) => (
                            <option key={template.key} value={template.key}>{template.label}</option>
                          ))}
                        </select>
                        <textarea
                          aria-label="提醒內容"
                          maxLength={5000}
                          value={reminderMessage}
                          onChange={(event) => setReminderMessage(event.target.value)}
                          style={textareaStyle}
                          rows={5}
                        />
                        <button onClick={handleCreateReminder} style={primaryButtonStyle}>建立提醒</button>
                        {reminderHistoryError && <p role="alert">{reminderHistoryError}</p>}
                        <h4>已建立提醒</h4><ul className="professional-reminder-list">{reminders.filter((r) => r.patient_id === selectedPatient.id).map((r) => <li key={r.id}><strong>{r.title || REMINDER_TEMPLATES.find((t) => t.key === r.reminder_type)?.label || "其他提醒"}</strong><p>{r.message}</p><small>{formatDate(r.created_at)}｜{{ unread: "未讀", read: "已讀", done: "已完成" }[r.status] || "狀態未記錄"}</small></li>)}</ul>
                      </section>

                      <section style={noteCardStyle}>
                        <h3 style={smallSectionTitleStyle}>醫療備註</h3>
                        <textarea
                          aria-label="醫療備註草稿"
                          maxLength={10000}
                          value={noteText}
                          onChange={(event) => updateNoteDraft(event.target.value)}
                          placeholder="輸入本次觀察、建議訓練方向或回診重點..."
                          style={textareaStyle}
                          rows={5}
                        />
                        <button onClick={handleSaveNote} disabled={noteSaving || !noteText.trim()} style={primaryButtonStyle}>{noteSaving ? "儲存中…" : "儲存備註"}</button>
                        {noteText.trim() && <p className="professional-draft-notice">尚未儲存的草稿；切換個案可保留於本次工作階段。</p>}
                        {noteError && <p role="alert">{noteError}</p>}
                        {noteHistoryError && <p role="alert">{noteHistoryError}</p>}
                        <p style={panelDescStyle}>建立者與時間依雲端紀錄顯示；目前資料表未提供修改時間或對應測驗欄位。</p>
                        <div style={noteListStyle}>
                          {!selectedPatientNotes.length && !noteHistoryError && <p>尚無已儲存的醫療備註。</p>}
                          {selectedPatientNotes.map((note) => (
                            <div key={note.id} style={noteItemStyle}>
                              <span style={noteDateStyle}>{formatDate(note.created_at)}｜建立者：{note.clinician_id === clinicianId ? clinicianName : note.clinician_id || "未記錄"}</span>
                              <p style={noteTextStyle}>{note.note}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section style={{ ...reportCardStyle, gridColumn: "1 / -1" }}>
                        <h3 style={smallSectionTitleStyle}>個案報告摘要</h3>
                        <pre style={{ ...reportBoxStyle, maxHeight: "none", minHeight: "220px" }}>{generateReportText()}</pre>
                        <button
                          onClick={() => navigator.clipboard?.writeText(generateReportText())}
                          style={secondaryButtonStyle}
                        >
                          複製報告摘要
                        </button>
                      </section>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>

       </div>
      )}

      <nav className="clinician-dashboard-research-nav" style={researchNavStyle} aria-label="研究功能選單">
        <span style={researchNavTitleStyle}>研究與分析工具</span>
        <div className="clinician-dashboard-research-nav-actions" style={researchNavActionsStyle}>
          <button onClick={() => navigate("/research-tools")} style={refreshButtonStyle}>開啟五合一研究工作台</button>
        </div>
      </nav>

      <button className="clinician-dashboard-assistant-button" onClick={() => setAssistantOpen(true)} style={assistantButtonStyle} aria-label="AI 小助手">
        <img width={184} height={184} loading="lazy" src={assistIcon} alt="AI 小助手" style={assistantIconStyle} />
      </button>

      {assistantOpen && (
        <div className="clinician-dashboard-assistant-mask" style={assistantMaskStyle} onClick={closeAssistant}>
          <div className="clinician-dashboard-assistant-panel" style={assistantPanelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={assistantHeaderStyle}>
              <div style={assistantTitleWrapStyle}>
                <img width={184} height={184} loading="lazy" src={assistIcon} alt="AI 小助手" style={assistantPanelIconStyle} />
                <div>
                  <h3 style={assistantTitleStyle}>AI 臨床摘要助手</h3>
                  <p style={assistantDescStyle}>協助摘要、比較與產生家長說明</p>
                </div>
              </div>
              <button onClick={closeAssistant} style={closeButtonStyle}>關閉</button>
            </div>

            {selectedPatient && (
              <div style={assistantContextCardStyle}>
                <div>
                  <strong style={assistantContextTitleStyle}>
                    分析對象：{selectedPatient.nickname || selectedPatient.full_name || "目前個案"}
                    {selectedTrial && selectedRecord ? `・${selectedRecord.gameName} 第 ${(selectedTrialIndex || 0) + 1} 題` : "・全部有效紀錄"}
                  </strong>
                  <span style={assistantContextHintStyle}>
                    {selectedTrial ? "回答將優先參考目前選取的圖片、trial JSON 與遊戲紀錄。" : `目前可用 ${selectedPatientRecords.length} 筆紀錄；比較時以畫面中選取的兩筆測驗為準。`}
                  </span>
                </div>
                {selectedTrial && firstTrialImage(selectedTrial) && <img loading="lazy" src={firstTrialImage(selectedTrial)} alt="目前選取 trial" style={assistantContextThumbStyle} />}
              </div>
            )}

            <AssistantEmailChoice controller={assistantEmail} disabled={assistantLoading} />
            <div style={assistantQuickRowStyle}>
              {selectedTrial && <button onClick={() => sendAssistantQuestion("請解釋這張圖片與此 trial 紀錄")} style={assistantChipStyle}>解釋目前圖片</button>}
              {selectedTrial && <button onClick={() => sendAssistantQuestion("為什麼這一題會得到目前的判定？")} style={assistantChipStyle}>說明判定原因</button>}
              <button onClick={() => sendAssistantQuestion("請告訴我最近一次測驗或訓練結果")} style={assistantChipStyle}>最近一次結果</button>
              <button onClick={() => sendAssistantQuestion("請比較這兩次測驗變化")} style={assistantChipStyle}>比較兩次測驗</button>
              <button onClick={() => sendAssistantQuestion("根據目前資料，我應該給什麼訓練建議？")} style={assistantChipStyle}>訓練建議</button>
              <button onClick={() => sendAssistantQuestion("請幫我摘要這位兒童近 30 天表現")} style={assistantChipStyle}>近 30 天摘要</button>
              <button onClick={() => sendAssistantQuestion("請產生給家長的說明文字")} style={assistantChipStyle}>家長說明</button>
              <button onClick={clearAssistantChat} style={assistantClearButtonStyle}>清除對話</button>
            </div>

            <div style={assistantChatStyle}>
              {assistantMessages.map((message) => (
                <div
                  key={message.id}
                  style={message.role === "user" ? assistantUserRowStyle : assistantAiRowStyle}
                >
                  {message.role === "assistant" && (
                    <img width={184} height={184} loading="lazy" src={assistIcon} alt="AI" style={assistantMessageIconStyle} />
                  )}
                  <div style={message.role === "user" ? assistantUserBubbleStyle : assistantAiBubbleStyle}>
                    <div>{message.content}</div>
                    <AssistantEmailStatus delivery={assistantEmail.deliveries[message.id]} onRetry={() => assistantEmail.retry(message.id)} />
                    {message.role === "assistant" && message.sources?.length > 0 && (
                      <div style={assistantSourcesStyle}>
                        <div style={assistantSourcesHeaderStyle}>專業資料來源</div>
                        {message.sources.map((source, index) => {
                          const sourceLabel = [
                            source.author,
                            source.year,
                            source.page ? `第 ${source.page} 頁` : null,
                          ]
                            .filter(Boolean)
                            .join("・");

                          const sourceContent = (
                            <>
                              <span style={assistantSourceIndexStyle}>[{index + 1}]</span>
                              <span>
                                <strong>{source.title}</strong>
                                {sourceLabel && <span style={assistantSourceMetaStyle}> {sourceLabel}</span>}
                              </span>
                            </>
                          );

                          return source.url ? (
                            <a
                              key={source.id || `${source.title}-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              style={assistantSourceLinkStyle}
                            >
                              {sourceContent}
                            </a>
                          ) : (
                            <div key={source.id || `${source.title}-${index}`} style={assistantSourceItemStyle}>
                              {sourceContent}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {message.role === "assistant" && message.fallback && (
                      <div style={assistantFallbackStyle}>目前使用系統內建資料整理，未引用外部專業知識庫。</div>
                    )}
                  </div>
                </div>
              ))}
              {assistantLoading && (
                <div style={assistantAiRowStyle}>
                  <img width={184} height={184} loading="lazy" src={assistIcon} alt="AI" style={assistantMessageIconStyle} />
                  <div style={assistantAiBubbleStyle}>正在整理目前圖片與 trial 資料…</div>
                </div>
              )}
              <div ref={assistantMessagesEndRef} />
            </div>

            <div style={assistantComposerStyle}>
              <textarea
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendAssistantQuestion();
                  }
                }}
                placeholder={selectedTrial ? "詢問目前圖片、trial 欄位或判定原因…" : "詢問個案近期表現、特定遊戲趨勢或家長說明…"}
                style={assistantTextareaStyle}
                rows={2}
                maxLength={8000}
              />
              <button
                onClick={() => sendAssistantQuestion()}
                disabled={!assistantQuestion.trim() || assistantLoading}
                style={{ ...assistantSendButtonStyle, opacity: assistantQuestion.trim() && !assistantLoading ? 1 : 0.5 }}
              >
                {assistantLoading ? "分析中" : "傳送"}
              </button>
            </div>
            <p style={assistantDisclaimerStyle}>
              AI 內容僅供臨床追蹤整理，不可取代專業診斷與醫療判斷；引用資料仍應由醫療人員確認適用性與版本。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={miniStatStyle}>
      <span style={miniStatValueStyle}>{value}</span>
      <span style={miniStatLabelStyle}>{label}</span>
    </div>
  );
}

function InfoItem({ label, value }) {
  const displayValue = value === null || value === undefined || value === "" || value === "-" ? "未記錄" : value === "adaptive_span_test" ? "自適應廣度測驗" : value;
  return (
    <div style={infoItemStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{displayValue}</strong>
    </div>
  );
}

function TrendChart({ data, theme, gameName, selectedRecordId, onSelectRecord }) {
  const valid = (data || []).filter((item) => { const d = describeRecord(item.record); return d.complete && !d.integrityError && d.total > 0; });
  const comparableCount = largestComparableCount(valid.map((item) => item.record));
  if (comparableCount < 3) return <ObservationResults observations={valid.map((item) => ({ ...item, value: formatAccuracy(item.record.correct, item.record.total) }))} comparableCount={comparableCount} onOpen={onSelectRecord}/>;
  data = valid;
  const baseWidth = 720;
  const width = Math.max(baseWidth, (data?.length || 0) * 92);
  const height = 270;
  const paddingX = 58;
  const paddingTop = 44;
  const paddingBottom = 78;
  const safeTheme = theme || GAME_THEME_MAP.SRT;

  if (!data || data.length === 0) {
    return <div style={{ ...emptySmallBoxStyle, background: safeTheme.soft, borderColor: safeTheme.border }}>尚無資料可產生趨勢圖</div>;
  }

  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : paddingX + (index * (width - paddingX * 2)) / (data.length - 1);
    const y = height - paddingBottom - (Number(item.accuracy || 0) / 100) * (height - paddingTop - paddingBottom);
    return { x, y, item };
  });

  const segments = points.slice(1).map((point, i) => ({ a: points[i], b: point })).filter(({a,b}) => compareRecords(a.item.record, b.item.record).comparable);

  return (
    <div style={trendOuterStyle}>
      <div style={trendLegendStyle}>
        <span style={{ ...trendLegendDotStyle, background: safeTheme.primary }} />
        <span>{gameName}正確率・描述性資料</span>
        <span style={{ ...trendTypeTagStyle, borderColor: safeTheme.border, color: safeTheme.dark }}>實心：測驗</span>
        <span style={{ ...trendTypeTagStyle, borderColor: safeTheme.border, color: safeTheme.dark, background: safeTheme.soft }}>空心：訓練</span>
        <span style={trendClickHintStyle}>點選資料點查看該次完整紀錄</span>
      </div>
      <div style={trendWrapStyle}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ ...trendSvgStyle, minWidth: `${width}px`, background: `linear-gradient(180deg, ${safeTheme.soft}, #ffffff)` }}
          role="img"
          aria-label={`${gameName}全部紀錄正確率趨勢圖`}
        >
          {[0, 25, 50, 75, 100].map((value) => {
            const y = height - paddingBottom - (value / 100) * (height - paddingTop - paddingBottom);
            return (
              <g key={value}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#dbe4ee" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} fontSize="13" textAnchor="end" fill="#64748b">{value}%</text>
              </g>
            );
          })}
          {segments.map(({a,b}, i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={safeTheme.primary} strokeWidth="2"/>)}
          {points.map((point, index) => {
            const isTraining = point.item.type === "training";
            const selected = selectedRecordId === point.item.recordId;
            const typeText = isTraining ? "訓練" : point.item.type === "test" ? "測驗" : "紀錄";
            const accessibleText = `${formatTrendRecordDate(point.item.date)} ${typeText}，正確率 ${metricText(point.item.accuracy, "%")}，有效反應 ${formatReactionTime(point.item.rt)}`;

            return (
              <g
                key={point.item.recordId || `${point.x}-${index}`}
                role="button"
                tabIndex="0"
                aria-label={`${accessibleText}，按下查看完整紀錄`}
                onClick={() => onSelectRecord?.(point.item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRecord?.(point.item);
                  }
                }}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <title>{`${accessibleText}\n難度：${formatDifficulty(point.item.difficulty)}\n分數：${point.item.score ?? "-"}\n點擊查看完整紀錄`}</title>
                {selected && (
                  <circle cx={point.x} cy={point.y} r="13" fill="none" stroke={safeTheme.primary} strokeWidth="3" opacity="0.35" />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={selected ? "8.5" : "7"}
                  fill={isTraining ? "#ffffff" : safeTheme.primary}
                  stroke={selected ? "#0f172a" : safeTheme.dark}
                  strokeWidth={selected ? "4" : "3"}
                />
                <text x={point.x} y={point.y - 15} fontSize="12" fontWeight="800" textAnchor="middle" fill={safeTheme.dark}>{metricText(point.item.accuracy, "%", 0)}</text>
                <text transform={`translate(${point.x - 2} ${height - 50}) rotate(-32)`} fontSize="13" textAnchor="end" fill="#64748b">{point.item.label}</text>
                <text x={point.x} y={height - 20} fontSize="13" fontWeight="700" textAnchor="middle" fill={isTraining ? "#7c3aed" : "#1f5f8b"}>{typeText}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {selectedRecordId && (
        <div style={trendSelectedHintStyle}>已選取一筆紀錄；系統已切換至「紀錄與比較」並展開該次完整紀錄。</div>
      )}
    </div>
  );
}


const responsiveCss = `
  .clinician-dashboard-page,
  .clinician-dashboard-page * {
    box-sizing: border-box;
  }

  .clinician-dashboard-table-wrap {
    -webkit-overflow-scrolling: touch;
  }

  .clinician-dashboard-table-wrap::-webkit-scrollbar {
    height: 10px;
  }

  @media (max-width: 1100px) {
    .clinician-dashboard-patient-tabs {
      grid-template-columns: 1fr !important;
    }
    .clinician-dashboard-tool-grid {
      grid-template-columns: 1fr !important;
    }
    .clinician-dashboard-game-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 900px) {
    .clinician-dashboard-trial-layout,
    .clinician-dashboard-readiness-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 680px) {
    .clinician-dashboard-game-grid,
    .clinician-dashboard-readiness-grid {
      grid-template-columns: 1fr !important;
    }

    .clinician-dashboard-research-nav-actions {
      flex-direction: column !important;
    }

    .clinician-dashboard-research-nav-actions button {
      width: 100% !important;
    }
  }

  .clinician-dashboard-table-wrap::-webkit-scrollbar-thumb {
    background: rgba(31, 95, 139, 0.34);
    border-radius: 999px;
  }

  @media (max-width: 1440px) {
    .clinician-dashboard-layout {
      grid-template-columns: 280px minmax(0, 1fr) 300px !important;
      gap: 14px !important;
    }

    .clinician-dashboard-stats {
      grid-template-columns: repeat(5, minmax(130px, 1fr)) !important;
    }
  }

  @media (max-width: 1180px) {
    .clinician-dashboard-page {
      padding: 18px !important;
    }

    .clinician-dashboard-header {
      align-items: flex-start !important;
      padding: 20px !important;
    }

    .clinician-dashboard-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-layout {
      grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.35fr) !important;
      grid-template-areas:
        "left center"
        "right center" !important;
      align-items: start !important;
    }

    .clinician-dashboard-left {
      grid-area: left !important;
      max-height: none !important;
      overflow: visible !important;
      position: sticky !important;
      top: 14px !important;
    }

    .clinician-dashboard-center {
      grid-area: center !important;
    }

    .clinician-dashboard-right {
      grid-area: right !important;
    }

    .clinician-dashboard-patient-header {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .clinician-dashboard-mini-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-top-grid {
      grid-template-columns: 1fr !important;
    }

    .clinician-dashboard-game-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-compare-result {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (min-width: 1181px) {
    .clinician-dashboard-game-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
  }

  @media (min-width: 681px) and (max-width: 1180px) {
    .clinician-dashboard-game-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 900px) {
    .clinician-dashboard-page {
      padding: 14px !important;
    }

    .clinician-dashboard-header {
      flex-direction: column !important;
      border-radius: 22px !important;
      gap: 14px !important;
    }

    .clinician-dashboard-header-actions {
      width: 100% !important;
      justify-content: flex-start !important;
    }

    .clinician-dashboard-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .clinician-dashboard-layout {
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
    }

    .clinician-dashboard-left {
      position: relative !important;
      top: auto !important;
      width: 100% !important;
      max-height: 360px !important;
      overflow: auto !important;
      border-radius: 22px !important;
      padding: 16px !important;
    }

    .clinician-dashboard-center,
    .clinician-dashboard-right {
      width: 100% !important;
    }

    .clinician-dashboard-patient-header {
      padding: 18px !important;
      border-radius: 22px !important;
    }

    .clinician-dashboard-mini-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-game-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .clinician-dashboard-compare-select {
      grid-template-columns: 1fr !important;
    }

    .clinician-dashboard-compare-select span {
      text-align: center !important;
    }

    .clinician-dashboard-section-header {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .clinician-dashboard-table {
      min-width: 980px !important;
    }

    .clinician-dashboard-assistant-button {
      width: 68px !important;
      height: 68px !important;
      left: 16px !important;
      bottom: 16px !important;
      border-radius: 22px !important;
    }

    .clinician-dashboard-assistant-mask {
      padding: 14px !important;
      justify-content: center !important;
    }

    .clinician-dashboard-assistant-panel {
      width: 100% !important;
      max-width: 620px !important;
      max-height: calc(100vh - 28px) !important;
      overflow: auto !important;
      border-radius: 24px !important;
    }
  }

  @media (max-width: 680px) {
    .clinician-dashboard-record-actions {
      align-items: stretch !important;
    }

    .clinician-dashboard-record-actions > div:last-child {
      justify-content: flex-start !important;
    }

    .clinician-dashboard-record-actions button {
      width: 100% !important;
    }

    .clinician-dashboard-record-accordion {
      border-radius: 16px !important;
    }
  }

  @media (max-width: 560px) {
    .clinician-dashboard-page {
      padding: 10px !important;
    }

    .clinician-dashboard-header,
    .clinician-dashboard-left,
    .clinician-dashboard-patient-header {
      border-radius: 18px !important;
    }

    .clinician-dashboard-header-actions button {
      flex: 1 1 130px !important;
    }

    .clinician-dashboard-stats {
      grid-template-columns: 1fr !important;
    }

    .clinician-dashboard-game-grid,
    .clinician-dashboard-compare-result,
    .clinician-dashboard-detail-grid {
      grid-template-columns: 1fr !important;
    }

    .clinician-dashboard-table {
      min-width: 860px !important;
      font-size: 13px !important;
    }

    .clinician-dashboard-assistant-button {
      width: 60px !important;
      height: 60px !important;
    }
  }
`;

const pageStyle = {
  minHeight: "100vh",
  position: "relative",
  background: "#F6F7F4",
  padding: "24px",
  fontFamily: "Noto Sans TC, Microsoft JhengHei, sans-serif",
  boxSizing: "border-box",
  overflowX: "hidden",
};



const researchNavStyle = {
  position: "relative",
  zIndex: 1,
  marginTop: "18px",
  padding: "16px 18px",
  borderRadius: "22px",
  background: "linear-gradient(135deg, rgba(255, 253, 244, 0.98), rgba(240, 248, 255, 0.94))",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
};
const researchNavTitleStyle = {
  display: "block",
  marginBottom: "12px",
  color: "#334155",
  fontSize: "14px",
  fontWeight: "900",
};
const researchNavActionsStyle = { display: "flex", gap: "12px", flexWrap: "wrap" };

const refreshButtonStyle = {
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(43, 108, 176, 0.28)",
  backgroundColor: "#eef7ff",
  color: "#1f5f8b",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer",
};

const layoutStyle = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "310px minmax(0, 1fr) 340px",
  gap: "18px",
  alignItems: "start",
};

const leftPanelStyle = {
  background: "rgba(255, 253, 244, 0.96)",
  borderRadius: "28px",
  padding: "20px",
  boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderTop: "4px solid rgba(247, 210, 94, 0.70)",
  maxHeight: "calc(100vh - 210px)",
  overflow: "auto",
};

const centerPanelStyle = { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 };
const panelHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "14px" };
const panelTitleStyle = { margin: 0, fontSize: "22px", color: "#1f5f8b", fontWeight: "900" };
const panelDescStyle = { margin: "6px 0 0", color: "#64748b", fontSize: "14px", lineHeight: 1.6 };

const searchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.36)",
  outline: "none",
  fontSize: "14px",
  marginBottom: "12px",
  background: "rgba(255, 255, 255, 0.92)",
};

const riskFilterStyle = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" };
const pillButtonStyle = (active) => ({
  border: active ? "1px solid rgba(31, 95, 139, 0.22)" : "1px solid rgba(148, 163, 184, 0.42)",
  background: active ? "linear-gradient(180deg, #2b6cb0, #1f5f8b)" : "rgba(255, 255, 255, 0.92)",
  color: active ? "white" : "#334155",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: "800",
  fontSize: "13px",
  cursor: "pointer",
});

const gameSwitchButtonStyle = (active, theme) => ({
  border: `1px solid ${active ? theme.border : "rgba(148,163,184,.42)"}`,
  background: active ? theme.primary : "rgba(255,255,255,.94)",
  color: active ? "#ffffff" : theme.dark,
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 900,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: active ? `0 7px 16px ${theme.primary}33` : "none",
});

const combinedExportBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", margin: "16px 0", padding: "14px 16px", borderRadius: "16px", border: "1px solid rgba(37, 99, 235, 0.2)", background: "rgba(239, 246, 255, 0.82)" };
const combinedExportActionsStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const selectedCountBadgeStyle = { padding: "8px 11px", borderRadius: "999px", background: "#ffffff", color: "#1d4ed8", fontWeight: 900, fontSize: "13px", border: "1px solid #bfdbfe" };
const secondaryActionButtonStyle = { border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", borderRadius: "10px", padding: "9px 12px", fontWeight: 800, cursor: "pointer" };

const patientListStyle = { display: "flex", flexDirection: "column", gap: "12px" };
const patientListItemStyle = {
  width: "100%",
  textAlign: "left",
  border: "1px solid rgba(148, 163, 184, 0.26)",
  background: "rgba(255, 250, 240, 0.94)",
  borderRadius: "18px",
  padding: "14px",
  cursor: "pointer",
  transition: "0.18s ease",
};
const activePatientListItemStyle = { background: "linear-gradient(135deg, #fff7d6, #f0f8ff)", border: "1px solid rgba(43, 108, 176, 0.48)", boxShadow: "0 10px 22px rgba(37, 99, 235, 0.14)" };
const patientListTopStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" };
const patientListNameStyle = { color: "#1f5f8b", fontSize: "17px" };
const patientListMetaStyle = { display: "block", marginTop: "8px", color: "#64748b", fontSize: "13px" };

const patientHeaderCardStyle = {
  background: "linear-gradient(135deg, rgba(255, 253, 244, 0.98), rgba(240, 248, 255, 0.93))",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderLeft: "6px solid rgba(43, 108, 176, 0.64)",
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "center",
};

const patientTitleRowStyle = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const patientNameStyle = { margin: 0, fontSize: "28px", color: "#1f5f8b" };
const patientInfoStyle = { margin: "8px 0 0", color: "#475569", fontSize: "15px" };
const patientMiniStatsStyle = { display: "grid", gridTemplateColumns: "repeat(4, 92px)", gap: "10px" };
const miniStatStyle = { background: "rgba(255, 255, 255, 0.72)", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: "16px", padding: "12px", textAlign: "center" };
const miniStatValueStyle = { display: "block", color: "#1f5f8b", fontSize: "20px", fontWeight: "900" };
const miniStatLabelStyle = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "4px" };

const activeFilterSummaryStyle = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", margin: "12px 0", padding: "10px 14px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a5f", fontSize: "13px", fontWeight: 700 };
const activeFilterCountStyle = { marginLeft: "auto", padding: "4px 9px", borderRadius: "999px", background: "#ffffff", border: "1px solid #93c5fd", color: "#1d4ed8", whiteSpace: "nowrap" };
const toolSectionHeaderStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "18px" };
const toolGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px", alignItems: "start" };
const patientTabsStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", padding: "10px", borderRadius: "20px", background: "rgba(241,245,249,.82)", border: "1px solid rgba(148,163,184,.24)", boxShadow: "0 10px 24px rgba(51,65,85,.07)" };
const patientTabButtonStyle = (active) => ({ border: active ? "1px solid #60a5fa" : "1px solid transparent", borderRadius: "14px", padding: "12px 14px", background: active ? "linear-gradient(135deg,#eff6ff,#ffffff)" : "transparent", color: active ? "#1d4ed8" : "#475569", cursor: "pointer", textAlign: "left", boxShadow: active ? "0 8px 18px rgba(37,99,235,.10)" : "none" });
const patientTabLabelStyle = { display: "block", fontSize: "14px", fontWeight: 900 };
const patientTabDescStyle = { display: "block", marginTop: "4px", fontSize: "11px", lineHeight: 1.4, color: "#64748b", fontWeight: 700 };



const analysisCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "24px", padding: "20px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const smallSectionTitleStyle = { margin: 0, fontSize: "20px", color: "#1f5f8b", fontWeight: "900" };
const trendOuterStyle = { width: "100%", marginTop: "14px" };
const trendWrapStyle = { width: "100%", marginTop: "10px", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", borderRadius: "18px" };
const trendLegendStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", color: "#475569", fontSize: "12px", fontWeight: 800 };
const trendLegendDotStyle = { width: "10px", height: "10px", borderRadius: "999px" };
const trendTypeTagStyle = { display: "inline-flex", alignItems: "center", padding: "4px 8px", border: "1px solid", borderRadius: "999px", background: "#ffffff", fontSize: "11px", fontWeight: 800 };
const trendSvgStyle = { width: "100%", height: "190px", background: "rgba(255, 255, 255, 0.82)", borderRadius: "18px", border: "1px solid rgba(148, 163, 184, 0.24)" };



const sectionHeaderRowStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };








const trendSectionStyle = { marginTop: "20px", paddingTop: "18px", borderTop: "1px solid rgba(148,163,184,.24)" };
const trendHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" };
const trendTitleStyle = { margin: 0, color: "#1f5f8b", fontSize: "18px", fontWeight: 900 };
const trendSwitchStyle = { display: "flex", gap: "7px", flexWrap: "wrap", justifyContent: "flex-end" };

const compareCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "28px", padding: "20px", boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const compareSelectRowStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", alignItems: "center", marginBottom: "14px" };
const compareArrowStyle = { color: "#7c5b2a", fontWeight: "800" };






const recordsCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "28px", padding: "20px", boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const recordsHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "16px" };
const filterPanelStyle = { display: "grid", gap: "10px", justifyItems: "end", maxWidth: "820px" };
const filterSectionStyle = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" };
const filterLabelStyle = { fontSize: "13px", fontWeight: 900, color: "#51647a", marginRight: "2px" };
const checkboxLabelStyle = (active) => ({ display: "inline-flex", alignItems: "center", gap: "7px", minHeight: "38px", padding: "7px 10px", border: active ? "1px solid rgba(31,95,139,.48)" : "1px solid rgba(148,163,184,.34)", borderRadius: "12px", background: active ? "#e8f4ff" : "rgba(255,255,255,.84)", color: active ? "#1f5f8b" : "#334155", fontSize: "13px", fontWeight: 800, cursor: "pointer", userSelect: "none", boxShadow: active ? "0 4px 12px rgba(31,95,139,.10)" : "none" });
const checkboxInputStyle = { width: "17px", height: "17px", accentColor: "#1f5f8b", cursor: "pointer", flex: "0 0 auto" };
const checkboxGameNameStyle = { color: "#64748b", fontWeight: 700 };
const filterFooterStyle = { width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" };
const filterHintStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const clearFilterButtonStyle = { border: "1px solid rgba(43,108,176,.28)", background: "#eef7ff", color: "#1f5f8b", borderRadius: "10px", padding: "7px 10px", fontSize: "12px", fontWeight: 900, cursor: "pointer" };
const pageSizeBadgeStyle = { display: "inline-flex", alignItems: "center", minHeight: "34px", padding: "0 11px", borderRadius: "10px", background: "#f1f5f9", color: "#51647a", fontSize: "13px", fontWeight: 800, border: "1px solid rgba(148,163,184,.28)" };







const recordActionBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "12px 14px", marginBottom: "14px", borderRadius: "14px", background: "linear-gradient(135deg,#f8fafc,#eef7ff)", border: "1px solid rgba(43,108,176,.20)", flexWrap: "wrap" };
const recordActionTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "14px", fontWeight: 900 };
const recordActionHintStyle = { display: "block", marginTop: "3px", color: "#64748b", fontSize: "12px", fontWeight: 700 };
const excelButtonStyle = { border: "none", borderRadius: "11px", background: "linear-gradient(180deg,#2b6cb0,#1f5f8b)", color: "#fff", padding: "10px 14px", fontSize: "13px", fontWeight: 900, cursor: "pointer" };



const recordAccordionWrapStyle = { marginBottom: "16px", border: "1px solid rgba(43, 108, 176, 0.24)", borderRadius: "20px", overflow: "hidden", background: "rgba(240, 248, 255, 0.72)", boxShadow: "0 10px 24px rgba(37, 99, 235, 0.08)" };
const recordAccordionHeaderStyle = { width: "100%", border: "none", background: "linear-gradient(135deg, rgba(224, 242, 254, 0.96), rgba(255, 247, 214, 0.92))", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", textAlign: "left", cursor: "pointer" };
const recordAccordionTitleStyle = { color: "#1f5f8b", fontSize: "15px", fontWeight: "900", lineHeight: 1.5 };
const recordAccordionHintStyle = { color: "#7c5b2a", fontSize: "13px", fontWeight: "800", whiteSpace: "nowrap" };
const recordAccordionBodyStyle = { padding: "16px", borderTop: "1px solid rgba(148, 163, 184, 0.24)", background: "rgba(255, 255, 255, 0.72)" };
const emptyTableStyle = { padding: "22px", color: "#7c5b2a", textAlign: "center" };

const recordDetailGridStyle = { display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: "12px", marginBottom: "16px" };
const infoItemStyle = { background: "rgba(255, 255, 255, 0.78)", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: "16px", padding: "13px" };
const infoLabelStyle = { display: "block", color: "#64748b", fontSize: "12px", marginBottom: "6px" };
const infoValueStyle = { color: "#1f5f8b", fontSize: "14px" };
const closeButtonStyle = { border: "2px solid #f7d774", background: "white", color: "#334155", borderRadius: "12px", padding: "9px 14px", fontWeight: "800", cursor: "pointer" };
const jsonBoxStyle = { background: "#0f172a", color: "#e2e8f0", borderRadius: "18px", padding: "16px", overflow: "auto", maxHeight: "360px", fontSize: "12px", lineHeight: 1.6 };

const reminderCardStyle = { background: "rgba(255, 253, 244, 0.96)", border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(43, 108, 176, 0.52)", borderRadius: "24px", padding: "18px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)" };
const noteCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "24px", padding: "18px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const reportCardStyle = { background: "rgba(255, 253, 244, 0.96)", border: "1px solid rgba(148, 163, 184, 0.22)", borderRadius: "24px", padding: "18px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)" };
const selectStyle = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(148, 163, 184, 0.36)", borderRadius: "14px", padding: "11px 12px", fontSize: "14px", outline: "none", background: "white" };
const textareaStyle = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(148, 163, 184, 0.36)", borderRadius: "14px", padding: "12px", fontSize: "14px", outline: "none", resize: "vertical", marginTop: "10px", color: "#334155", lineHeight: 1.6, background: "rgba(255, 255, 255, 0.92)" };
const primaryButtonStyle = { width: "100%", border: "none", background: "linear-gradient(180deg, #2b6cb0, #1f5f8b)", color: "white", borderRadius: "14px", padding: "11px 18px", fontWeight: "800", cursor: "pointer", marginTop: "10px" };
const secondaryButtonStyle = { width: "100%", border: "1px solid rgba(43, 108, 176, 0.28)", background: "#eef7ff", color: "#1f5f8b", borderRadius: "14px", padding: "11px 18px", fontWeight: "800", cursor: "pointer", marginTop: "10px" };
const noteListStyle = { display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" };
const noteItemStyle = { background: "rgba(255, 255, 255, 0.78)", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: "14px", padding: "11px" };
const noteDateStyle = { color: "#64748b", fontSize: "12px" };
const noteTextStyle = { margin: "6px 0 0", color: "#334155", fontSize: "14px", lineHeight: 1.6 };
const reportBoxStyle = { whiteSpace: "pre-wrap", background: "rgba(255, 255, 255, 0.86)", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: "16px", padding: "12px", color: "#334155", fontSize: "13px", lineHeight: 1.6, maxHeight: "220px", overflow: "auto" };










const emptyBoxStyle = { position: "relative", zIndex: 1, background: "rgba(255, 253, 238, 0.94)", border: "4px solid rgba(255, 230, 139, 0.72)", borderRadius: "30px", padding: "34px", color: "#7c5b2a", textAlign: "center", boxShadow: "0 14px 34px rgba(91, 63, 26, 0.14)" };
const emptySmallBoxStyle = { background: "#fffaf0", border: "1px dashed #cbd5e1", borderRadius: "16px", padding: "18px", color: "#7c5b2a", textAlign: "center", fontSize: "14px" };

const assistantButtonStyle = {
  position: "fixed",
  left: "28px",
  bottom: "28px",
  zIndex: 20,
  width: "82px",
  height: "82px",
  borderRadius: "28px",
  border: "4px solid #ffe07a",
  background: "rgba(255, 253, 244, 0.97)",
  boxShadow: "0 18px 36px rgba(51, 65, 85, 0.18)",
  cursor: "pointer",
  padding: "10px",
};
const assistantIconStyle = { width: "100%", height: "100%", objectFit: "contain" };
const trialReviewSectionStyle = { marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(148,163,184,.28)" };
const trialReviewHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "12px" };
const trialReviewTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "15px", fontWeight: 900 };
const trialReviewHintStyle = { display: "block", marginTop: "3px", color: "#64748b", fontSize: "12px", fontWeight: 700 };
const recordHeaderButtonGroupStyle = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" };
const askRecordButtonStyle = { border: "1px solid #1f5f8b", borderRadius: "10px", padding: "10px 14px", background: "#eaf4fb", color: "#1f5f8b", fontWeight: 900, cursor: "pointer" };
const trendClickHintStyle = { marginLeft: "auto", color: "#475569", fontSize: "12px", fontWeight: 800, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "999px", padding: "5px 9px" };
const trendSelectedHintStyle = { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: "12px", fontWeight: 800, lineHeight: 1.5 };
const askTrialButtonStyle = { border: "none", borderRadius: "10px", padding: "9px 13px", background: "#1f5f8b", color: "#fff", fontWeight: 900, cursor: "pointer" };
const trialReviewLayoutStyle = { display: "grid", gridTemplateColumns: "190px minmax(0,1fr)", gap: "12px", alignItems: "start" };
const trialListStyle = { display: "flex", flexDirection: "column", gap: "7px", maxHeight: "440px", overflowY: "auto", paddingRight: "3px" };
const trialListButtonStyle = { width: "100%", border: "1px solid rgba(148,163,184,.28)", borderRadius: "11px", background: "#fff", padding: "9px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", color: "#334155", fontWeight: 800, cursor: "pointer", textAlign: "left" };
const activeTrialListButtonStyle = { borderColor: "#60a5fa", background: "#eff6ff", color: "#1d4ed8", boxShadow: "0 5px 14px rgba(37,99,235,.10)" };
const trialOutcomeBadgeStyle = (tone) => ({ borderRadius: "999px", padding: "3px 7px", fontSize: "10px", fontWeight: 900, background: tone === "success" ? "#dcfce7" : tone === "danger" ? "#fee2e2" : tone === "warning" ? "#fef3c7" : "#e2e8f0", color: tone === "success" ? "#166534" : tone === "danger" ? "#991b1b" : tone === "warning" ? "#92400e" : "#475569" });
const trialPreviewPanelStyle = { minWidth: 0, border: "1px solid rgba(148,163,184,.24)", borderRadius: "15px", padding: "12px", background: "rgba(255,255,255,.86)" };
const trialPreviewImageStyle = { display: "block", width: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "12px", background: "#0f172a", border: "1px solid rgba(148,163,184,.28)" };
const trialImagePlaceholderStyle = { minHeight: "100px", display: "grid", placeItems: "center", border: "1px dashed rgba(148,163,184,.55)", borderRadius: "12px", padding: "16px", color: "#64748b", background: "#f8fafc", textAlign: "center", fontWeight: 700 };
const trialLocalSummaryStyle = { margin: "12px 0 0", color: "#334155", lineHeight: 1.75, fontSize: "13px", fontWeight: 650 };
const trialQuickQuestionRowStyle = { display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "12px" };
const trialQuickQuestionButtonStyle = { border: "1px solid rgba(43,108,176,.25)", borderRadius: "999px", padding: "7px 10px", background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 850, cursor: "pointer" };
const trialJsonDetailsStyle = { marginTop: "12px" };
const allRawDetailsStyle = { marginTop: "12px" };
const trialJsonSummaryStyle = { cursor: "pointer", color: "#475569", fontSize: "12px", fontWeight: 850, padding: "7px 0" };
const assistantContextCardStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", margin: "10px 14px 0", padding: "10px 12px", borderRadius: "13px", background: "linear-gradient(135deg,#eef7ff,#f8fafc)", border: "1px solid rgba(43,108,176,.22)" };
const assistantContextTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "13px", fontWeight: 900 };
const assistantContextHintStyle = { display: "block", marginTop: "3px", color: "#64748b", fontSize: "11px", fontWeight: 700 };
const assistantContextThumbStyle = { width: "58px", height: "58px", objectFit: "cover", borderRadius: "9px", border: "1px solid rgba(148,163,184,.30)", background: "#0f172a", flex: "0 0 auto" };

const assistantMaskStyle = { position: "fixed", inset: 0, zIndex: 30, background: "rgba(63, 47, 31, 0.32)", display: "flex", alignItems: "flex-end", justifyContent: "flex-start", padding: "28px" };
const assistantPanelStyle = { width: "540px", maxWidth: "calc(100vw - 32px)", height: "min(720px, calc(100vh - 48px))", display: "flex", flexDirection: "column", background: "rgba(255, 253, 238, 0.98)", borderRadius: "30px", padding: "20px", boxShadow: "0 24px 60px rgba(63, 47, 31, 0.28)", border: "5px solid #ffe07a" };
const assistantHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "14px" };
const assistantTitleWrapStyle = { display: "flex", alignItems: "center", gap: "12px" };
const assistantPanelIconStyle = { width: "54px", height: "54px", objectFit: "contain" };
const assistantTitleStyle = { margin: 0, color: "#2b6cb0", fontSize: "20px", fontWeight: "900" };
const assistantDescStyle = { margin: "4px 0 0", color: "#7c5b2a", fontSize: "13px", fontWeight: "700" };
const assistantQuickRowStyle = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" };
const assistantChipStyle = { border: "2px solid #f7c948", background: "#fff7c2", color: "#7c4a03", borderRadius: "999px", padding: "8px 11px", cursor: "pointer", fontWeight: "800", fontSize: "12px" };
const assistantTextareaStyle = { flex: 1, width: "100%", boxSizing: "border-box", border: "2px solid #f7d774", borderRadius: "16px", padding: "12px", fontSize: "14px", outline: "none", resize: "none", color: "#334155", lineHeight: 1.6 };
const assistantChatStyle = { flex: 1, minHeight: 0, overflowY: "auto", background: "#fffaf0", border: "2px solid #f7d774", borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "14px" };
const assistantAiRowStyle = { display: "flex", alignItems: "flex-start", gap: "8px", justifyContent: "flex-start" };
const assistantUserRowStyle = { display: "flex", justifyContent: "flex-end" };
const assistantMessageIconStyle = { width: "30px", height: "30px", objectFit: "contain", flexShrink: 0 };
const assistantAiBubbleStyle = { maxWidth: "82%", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px 18px 18px 18px", padding: "10px 12px", color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", boxShadow: "0 3px 10px rgba(51, 65, 85, 0.06)" };
const assistantSourcesStyle = { marginTop: "10px", paddingTop: "9px", borderTop: "1px solid #e2e8f0", whiteSpace: "normal" };
const assistantSourcesHeaderStyle = { marginBottom: "5px", color: "#475569", fontSize: "12px", fontWeight: 800 };
const assistantSourceItemStyle = { display: "flex", alignItems: "flex-start", gap: "6px", padding: "4px 0", color: "#475569", fontSize: "11px", lineHeight: 1.55 };
const assistantSourceLinkStyle = { ...assistantSourceItemStyle, color: "#0f766e", textDecoration: "none" };
const assistantSourceIndexStyle = { flex: "0 0 auto", color: "#64748b", fontWeight: 800 };
const assistantSourceMetaStyle = { color: "#64748b", fontWeight: 500 };
const assistantFallbackStyle = { marginTop: "8px", padding: "6px 8px", borderRadius: "8px", background: "#fff7ed", color: "#9a3412", fontSize: "10px", lineHeight: 1.5, whiteSpace: "normal" };
const assistantUserBubbleStyle = { maxWidth: "82%", background: "#2b6cb0", borderRadius: "18px 6px 18px 18px", padding: "10px 12px", color: "#ffffff", lineHeight: 1.7, whiteSpace: "pre-wrap" };
const assistantComposerStyle = { display: "flex", alignItems: "flex-end", gap: "10px", marginTop: "12px" };
const assistantSendButtonStyle = { border: 0, background: "#2b6cb0", color: "#ffffff", borderRadius: "14px", padding: "12px 16px", fontWeight: "900", cursor: "pointer", flexShrink: 0 };
const assistantClearButtonStyle = { border: "1px solid #cbd5e1", background: "#ffffff", color: "#64748b", borderRadius: "999px", padding: "8px 11px", cursor: "pointer", fontWeight: "800", fontSize: "12px" };
const assistantDisclaimerStyle = { margin: "8px 2px 0", color: "#8b6b3f", fontSize: "11px", lineHeight: 1.5 };

export default ClinicianDashboard;
