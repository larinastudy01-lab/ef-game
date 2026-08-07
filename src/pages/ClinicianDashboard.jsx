import bgImg from "../asset/home/model_background.webp";
import assistIcon from "../asset/assist.webp";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
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
  SSG: "動物聲音辨識",
  DCCS: "衣物分類",
  LB: "綿羊回家",
};

const ABILITY_BY_GAME = {
  SRT: "反應速度 / 抑制控制",
  PM: "工作記憶",
  CBT: "序列記憶 / 注意維持",
  SSG: "選擇性注意 / 抑制控制",
  DCCS: "認知彈性",
  LB: "排序能力 / 規則理解",
};

const GAME_THEME_MAP = {
  SRT: { primary: "#f97316", dark: "#c2410c", soft: "#fff7ed", border: "#fdba74" },
  PM: { primary: "#7c3aed", dark: "#5b21b6", soft: "#f5f3ff", border: "#c4b5fd" },
  CBT: { primary: "#0891b2", dark: "#0e7490", soft: "#ecfeff", border: "#67e8f9" },
  SSG: { primary: "#e11d48", dark: "#be123c", soft: "#fff1f2", border: "#fda4af" },
  DCCS: { primary: "#16a34a", dark: "#15803d", soft: "#f0fdf4", border: "#86efac" },
  LB: { primary: "#ca8a04", dark: "#a16207", soft: "#fefce8", border: "#fde047" },
};

const CLINICIAN_LOGIN_ROUTE = "/clinician-login";
const CLINICIAN_ROLES = ["clinician", "medical", "doctor", "醫療人員"];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isClinicianRole(role) {
  return CLINICIAN_ROLES.includes(normalizeRole(role));
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

  { key: "SSG_RESULT", gameKey: "SSG", fallbackType: "test" },
  { key: "ssgTestResult", gameKey: "SSG", fallbackType: "test" },
  { key: "latestSSGTestResult", gameKey: "SSG", fallbackType: "test" },
  { key: "ssgTrainingResult", gameKey: "SSG", fallbackType: "training" },
  { key: "latestSSGTrainingResult", gameKey: "SSG", fallbackType: "training" },

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
  return 0;
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
  if (sourceText.includes("ssg")) return "SSG";
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
    "動物聲音辨識": "SSG",
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
  if (nameText.includes("動物聲音辨識")) return "SSG";
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
  const lower = key.toLowerCase();

  let gameKey = "";
  if (lower.includes("dccs")) gameKey = "DCCS";
  else if (lower.includes("srt")) gameKey = "SRT";
  else if (lower.includes("cbt")) gameKey = "CBT";
  else if (lower.includes("ssg")) gameKey = "SSG";
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
            game_key: firstDefined(entry.game_key, entry.gameKey, item.game_key, item.gameKey, meta.gameKey),
            record_type: firstDefined(
              entry.record_type,
              entry.mode,
              entry.mode_type,
              entry.sourceMode,
              item.record_type,
              item.mode,
              meta.fallbackType
            ),
            created_at: firstDefined(
              entry.created_at,
              entry.completedAt,
              entry.finished_at,
              entry.completed_at,
              entry.endedAt,
              entry.date,
              entry.savedAt,
              entry.generatedAt,
              item.created_at,
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
  const assisted = normalizeTrialBoolean(firstDefined(trial.assisted, trial.usedAssist, trial.hintUsed));
  const falseClickCount = Number(firstDefined(trial.falseClickCount, trial.wrongTapCount, trial.errorClickCount, 0)) || 0;
  const repeatedClickCount = Number(firstDefined(trial.repeatedClickCount, trial.repeatClickCount, 0)) || 0;
  const x = firstDefined(trial.positionX, trial.clickX, trial.x, trial.clickedX);
  const y = firstDefined(trial.positionY, trial.clickY, trial.y, trial.clickedY);
  const targetType = firstDefined(trial.targetType, trial.stimulusType, trial.itemType, "-");
  const scoreValue = firstDefined(trial.scoreValue, trial.trialScore, trial.points, "-");
  const locationText = Number.isFinite(Number(x)) && Number.isFinite(Number(y))
    ? `點擊位置約在畫面水平 ${Number(x).toFixed(1)}%、垂直 ${Number(y).toFixed(1)}%。`
    : "此題沒有完整的點擊座標資料。";
  return `第 ${index + 1} 題屬於「${record?.gameName || "目前遊戲"}」，系統結果為「${outcome.label}」。目標類型為 ${targetType}，${rt != null ? `反應時間為 ${rt} ms，` : ""}誤點 ${falseClickCount} 次、重複點擊 ${repeatedClickCount} 次，${assisted === true ? "有使用提示" : assisted === false ? "未使用提示" : "提示狀態未記錄"}，本題得分 ${scoreValue}。${locationText} 單一 trial 只能說明當次作答行為，不能單獨推論整體認知能力或做出診斷。`;
}

function ClinicianDashboard() {
  const navigate = useNavigate();

  const [clinicianId, setClinicianId] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
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
  const [activePatientTab, setActivePatientTab] = useState("trend");
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
    guardianEmail: "",
    nickname: "",
    fullName: "",
    birthDate: "",
    gender: "",
  });
  const [reminderTemplate, setReminderTemplate] = useState("follow_up");
  const [reminderMessage, setReminderMessage] = useState("");
  const [noteText, setNoteText] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
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
      if (!session?.user) {
        navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
      }
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

      if (userError || !user) {
        navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

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
        fetchClinicalRecords(patientIds),
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
      setSelectedPatientId((currentId) => (
        currentId && allowedPatientIds.has(String(currentId)) ? currentId : safePatients[0]?.id || ""
      ));
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


  const fetchClinicalRecords = async (patientIds = []) => {
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
      allRecords.push(
        normalizeRecord(
          item,
          item.__localSource || "browserStorage",
          item.record_type || "session",
          item.game_key
        )
      );
    });

    return dedupeRecords(allRecords).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };


  const dedupeRecords = (items) => {
    const seen = new Set();
    return items.filter((record) => {
      const parsedTime = new Date(record.date).getTime();
      const normalizedTime = Number.isFinite(parsedTime) ? Math.floor(parsedTime / 1000) : "no-time";
      const sessionIdentity = record.sessionKey
        ? `session:${record.sessionKey}`
        : [normalizedTime, record.score, record.accuracy, record.total, record.correct, record.avgRt].join(":");
      const key = [record.patientId, record.gameKey, record.type, sessionIdentity].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fetchClinicalNotes = async (patientIds = []) => {
    if (!patientIds.length) return [];

    const { data, error } = await supabase
      .from("clinician_notes")
      .select("*")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(`clinician_notes 讀取失敗，保留既有備註：${error.message}`);
      return null;
    }

    return data || [];
  };

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

    return {
      id: `${sourceTable}-${item.id || item.__localKey || `${gameKey}-${date}`}`,
      rawId: item.id || item.__localKey || "local",
      sourceTable: item.__localKey ? `${sourceTable}:${item.__localKey}` : sourceTable,
      sessionKey: firstDefined(
        item.session_id,
        item.sessionId,
        item.result_id,
        item.resultId,
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
      gameName: item.game_name || item.gameName || item.payload?.game?.gameName || GAME_NAME_MAP[gameKey] || gameKey || "未分類",
      ability: item.ability || item.training_ability || item.trainingAbility || ABILITY_BY_GAME[gameKey] || "未分類能力",
      date,
      score,
      stars,
      accuracy,
      correct,
      total,
      errors,
      avgRt,
      duration: firstNumber(item.duration, item.duration_seconds, item.durationSeconds, item.total_time, item.totalTime, summary.duration, clinician.duration),
      difficulty: level,
      status: item.status || item.finishReason || item.reason || "已完成",
      completedLevel: firstDefined(item.completed_level, item.level_completed, item.completedLevel, item.stage, summary.completedLevel, "-"),
      raw: item,
      trials,
      metrics: { result, summary, clinician, parent, child },
    };
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

    const guardianEmail = addPatientForm.guardianEmail.trim();
    const nickname = addPatientForm.nickname.trim();

    if (!guardianEmail || !nickname || !addPatientForm.birthDate || !addPatientForm.gender) {
      setAddPatientError("請完整填寫家長 Email、孩子暱稱、生日與性別。");
      return;
    }

    setAddPatientSubmitting(true);
    setAddPatientError("");

    try {
      const { error } = await supabase.rpc("clinician_create_patient", {
        p_guardian_email: guardianEmail,
        p_nickname: nickname,
        p_full_name: addPatientForm.fullName.trim() || null,
        p_birth_date: addPatientForm.birthDate,
        p_gender: addPatientForm.gender,
      });

      if (error) throw error;

      setAddPatientForm({ guardianEmail: "", nickname: "", fullName: "", birthDate: "", gender: "" });
      setShowAddPatient(false);
      await fetchClinicianAndPatients();
    } catch (error) {
      const message = String(error?.message || "新增兒童失敗，請稍後再試。");
      setAddPatientError(
        message.includes("Could not find the function")
          ? "尚未安裝醫療端新增兒童功能，請先執行最新 Supabase migration。"
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
    () => selectedPatientRecords.filter((record) => record.type === "test"),
    [selectedPatientRecords]
  );

  const trainingRecords = useMemo(
    () => selectedPatientRecords.filter((record) => record.type === "training"),
    [selectedPatientRecords]
  );

  const dashboardStats = useMemo(() => {
    const needFollowUp = patientCards.filter(({ risk }) => risk.key === "warning" || risk.key === "danger").length;
    const newRecords = records.filter((record) => (daysSince(record.date) ?? 999) <= 7).length;

    return {
      patientCount: patients.length,
      totalTests: records.filter((record) => record.type === "test").length,
      totalTraining: records.filter((record) => record.type === "training").length,
      needFollowUp,
      newRecords,
    };
  }, [patients, records, patientCards]);

  const patientSummary = useMemo(() => {
    if (!selectedPatient) return null;

    const risk = getRiskLevel(selectedPatientRecords);
    const lastRecord = selectedPatientRecords[0] || null;
    const averageAccuracy = average(selectedPatientRecords.map((record) => record.accuracy));
    const averageRt = average(selectedPatientRecords.map((record) => record.avgRt).filter((value) => value > 0));
    const latestGameMap = buildLatestGameMap(selectedPatientRecords);
    const gameSummaryMap = buildGameSummaryMap(selectedPatientRecords);
    const trendByGame = Object.keys(GAME_NAME_MAP).reduce((result, gameKey) => {
      result[gameKey] = buildGameTrendData(selectedPatientRecords, gameKey);
      return result;
    }, {});

    return {
      risk,
      lastRecord,
      averageAccuracy,
      averageRt,
      testCount: testRecords.length,
      trainingCount: trainingRecords.length,
      latestGameMap,
      gameSummaryMap,
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

  useEffect(() => {
    setSelectedTrialIndex(null);
  }, [selectedRecord]);

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

  function getRiskLevel(patientRecords) {
    if (!patientRecords || patientRecords.length === 0) {
      return { key: "empty", label: "資料不足", tone: "empty", text: "尚無紀錄，建議安排初次測驗。" };
    }

    const lastRecord = patientRecords[0];
    const diff = daysSince(lastRecord.date) ?? 999;
    const recent = patientRecords.slice(0, 3);
    const recentAccuracy = average(recent.map((record) => record.accuracy));
    const hasLowAccuracy = recentAccuracy > 0 && recentAccuracy < 60;
    const hasLongNoData = diff >= 21;
    const needFollowUp = diff >= 14;
    const latestTwo = patientRecords.slice(0, 2);
    const hasDrop = latestTwo.length >= 2 && Number(latestTwo[0].accuracy) + 10 < Number(latestTwo[1].accuracy);

    if (hasLongNoData || hasLowAccuracy || hasDrop) {
      return { key: "danger", label: "高度關注", tone: "danger", text: "近期表現下降或長時間未更新，建議優先追蹤。" };
    }

    if (needFollowUp) {
      return { key: "warning", label: "需要注意", tone: "warning", text: "已有一段時間無新資料，建議提醒家長補做。" };
    }

    return { key: "safe", label: "正常追蹤", tone: "safe", text: "近期仍有資料更新，可持續追蹤。" };
  }

  function average(values) {
    const cleanValues = values.map(Number).filter((value) => !Number.isNaN(value));
    if (cleanValues.length === 0) return 0;
    return Math.round(cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length);
  }

  function buildLatestGameMap(patientRecords) {
    const map = {};
    patientRecords.forEach((record) => {
      if (!map[record.gameKey]) map[record.gameKey] = record;
    });
    return map;
  }

  function buildGameTrendData(patientRecords, gameKey) {
    return [...patientRecords]
      .filter((record) => record.gameKey === gameKey)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .map((record, index) => ({
        recordId: record.id,
        label: formatTrendLabel(record.date, index),
        accuracy: Number(record.accuracy || 0),
        rt: Number(record.avgRt || 0),
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

  function buildGameSummaryMap(patientRecords) {
    return Object.keys(GAME_NAME_MAP).reduce((result, gameKey) => {
      const gameRecords = patientRecords
        .filter((record) => record.gameKey === gameKey)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const latest = gameRecords[0] || null;
      const previous = gameRecords[1] || null;
      const averageAccuracy = average(gameRecords.map((record) => record.accuracy));
      const change = latest && previous
        ? Number(latest.accuracy || 0) - Number(previous.accuracy || 0)
        : null;

      result[gameKey] = {
        latest,
        count: gameRecords.length,
        averageAccuracy,
        change,
      };
      return result;
    }, {});
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

    const { error } = await supabase.from("parent_reminders").insert({
      patient_id: selectedPatient.id,
      clinician_id: clinicianId,
      reminder_type: reminderTemplate,
      title: template.label,
      message,
      status: "unread",
    });

    if (error) {
      console.error("parent_reminders 新增失敗：", error);
      alert("提醒建立失敗，請確認 parent_reminders 的 RLS 權限與資料表欄位。");
      return;
    }

    setReminderMessage(personalizeTemplate(template.text, selectedPatient));
    alert("已送出提醒給家長端。");
  };

  const handleSaveNote = async () => {
    if (!selectedPatient || !noteText.trim()) return;

    const notePayload = {
      patient_id: selectedPatient.id,
      clinician_id: clinicianId,
      note: noteText.trim(),
    };

    const { data, error } = await supabase.from("clinician_notes").insert(notePayload).select("*").single();

    if (error) {
      console.warn("clinician_notes 新增失敗，改以本機暫存顯示：", error);
      const localNote = {
        ...notePayload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [localNote, ...prev]);
      setNoteText("");
      return;
    }

    setNotes((prev) => [data, ...prev]);
    setNoteText("");
  };

  const generateLocalAssistantAnswer = async (question) => {
    const query = String(question || "").trim();
    if (!query) return "請輸入想了解的問題。";
    if (!selectedPatient || !patientSummary) return "請先從左側選擇一位個案，我才能根據該個案的資料回答。";

    const lower = query.toLowerCase();
    const patientName = selectedPatient.nickname || selectedPatient.full_name || "此兒童";
    const sortedRecords = [...selectedPatientRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedRecords[0] || null;

    const confidenceText = (recordCount, comparable = true) => {
      if (!comparable) return "低（紀錄條件不同，僅能描述差異）";
      if (recordCount >= 5) return "高";
      if (recordCount >= 2) return "中等";
      return "低（目前資料筆數不足）";
    };

    const recordModeLabel = (record) => record?.type === "test" ? "測驗" : record?.type === "training" ? "訓練" : "紀錄";
    const recordLine = (record) => {
      if (!record) return "尚無有效紀錄";
      return `${formatDate(record.date)}｜${record.gameName}｜${recordModeLabel(record)}｜正確率 ${record.accuracy}%｜平均反應時間 ${record.avgRt || "-"} ms｜完成 ${record.total || "-"} 題｜難度 ${record.difficulty || "-"}`;
    };

    const recommendationForRecord = (record, previousRecord = null) => {
      if (!record) return ["先完成至少一次有效測驗或訓練，再建立個別化建議。"];
      const suggestions = [];
      const accuracy = Number(record.accuracy || 0);
      const rt = Number(record.avgRt || 0);
      const sameCondition = Boolean(previousRecord && previousRecord.gameKey === record.gameKey && previousRecord.difficulty === record.difficulty);
      const accuracyDiff = sameCondition ? accuracy - Number(previousRecord.accuracy || 0) : null;
      const rtDiff = sameCondition ? rt - Number(previousRecord.avgRt || 0) : null;

      if (accuracy < 60) suggestions.push("下一次先降低一級難度或延長刺激呈現時間，確認規則理解後再逐步增加負荷。");
      else if (accuracy < 80) suggestions.push("下一次先維持目前難度，不急著升級，優先讓正確率穩定到 80% 左右。");
      else suggestions.push("若接下來 2 次仍維持高正確率，可考慮小幅提高難度，但一次只調整一項參數。");

      if (accuracyDiff !== null && rtDiff !== null && accuracyDiff < 0 && rtDiff < 0) {
        suggestions.push("本次作答變快但正確率下降，請提醒『看清楚再作答』，並觀察是否有搶答或速度—準確度取捨。");
      } else if (rt > 0 && previousRecord && rt > Number(previousRecord.avgRt || 0) * 1.25) {
        suggestions.push("反應時間較前次明顯延長，建議確認疲勞、注意力、裝置操作或環境干擾。");
      } else {
        suggestions.push("持續觀察反應時間是否穩定，以及錯誤是否集中在後半段或特定題型。");
      }

      suggestions.push("以連續 2 至 3 次同遊戲、同難度資料再判斷趨勢，避免用單次結果直接視為進步或退步。");
      return suggestions;
    };

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
          headers: { "Content-Type": "application/json" },
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

    if (lower.includes("建議") || lower.includes("怎麼做") || lower.includes("下一步") || lower.includes("訓練方向")) {
      if (!latest) return `${patientName}目前尚無有效紀錄，建議先完成一次基準測驗。`;
      const previousSameGame = sortedRecords.find((record, index) => index > 0 && record.gameKey === latest.gameKey) || null;
      const suggestions = recommendationForRecord(latest, previousSameGame);
      return `【建議結論】\n目前建議先維持或微調訓練條件，不要只因單次結果立即升降級。\n\n【依據】\n${recordLine(latest)}${previousSameGame ? `\n前一次同遊戲：${recordLine(previousSameGame)}` : "\n目前沒有第二筆同遊戲紀錄可比較。"}\n\n【下一步建議】\n${suggestions.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n【判讀信心】\n${confidenceText(previousSameGame ? 2 : 1, Boolean(previousSameGame))}\n\n以上為系統資料輔助整理，仍需結合現場觀察與專業判斷。`;
    }

    if (lower.includes("最近一次") || lower.includes("最新") || lower.includes("上一次")) {
      if (!latest) return `${patientName}目前尚無有效測驗或訓練紀錄。`;
      const sameGamePrevious = sortedRecords.find((record, index) => index > 0 && record.gameKey === latest.gameKey) || null;
      const trendText = sameGamePrevious
        ? `與前一次同遊戲相比，正確率${latest.accuracy >= sameGamePrevious.accuracy ? "增加" : "下降"} ${Math.abs(latest.accuracy - sameGamePrevious.accuracy)} 個百分點，平均反應時間${latest.avgRt <= sameGamePrevious.avgRt ? "縮短" : "增加"} ${Math.abs((latest.avgRt || 0) - (sameGamePrevious.avgRt || 0))} ms。`
        : "目前只有一筆同遊戲紀錄，尚不能判斷趨勢。";
      return `【最近一次結果】\n${recordLine(latest)}\n\n【初步解讀】\n${trendText}\n\n【資料充分度】\n${confidenceText(sameGamePrevious ? 2 : 1, Boolean(sameGamePrevious))}`;
    }

    if (lower.includes("家長")) {
      if (!latest) return `${patientName}目前尚無足夠紀錄可供說明，建議先完成至少一次測驗或訓練。`;
      return `【給家長的說明】\n${patientName}最近完成「${latest.gameName}」，本次正確率為 ${latest.accuracy}%，平均反應時間為 ${latest.avgRt || "-"} ms。這份結果主要用來觀察一段時間內的變化，單次表現可能受到疲勞、環境、理解狀況或題目難度影響。建議依原定頻率持續完成活動，並由醫療人員綜合多次紀錄判讀，不需要因單次波動過度擔心。`;
    }

    if (lower.includes("比較") || lower.includes("兩次")) {
      if (!compareA || !compareB || testRecords.length < 2) {
        return "目前沒有兩筆可比較的測驗資料，請先在「測驗比較」區選擇兩筆不同紀錄。";
      }
      const comparable = compareA.gameKey === compareB.gameKey && compareA.difficulty === compareB.difficulty;
      const accuracyDiff = compareB.accuracy - compareA.accuracy;
      const rtDiff = (compareB.avgRt || 0) - (compareA.avgRt || 0);
      const interpretation = accuracyDiff < 0 && rtDiff < 0
        ? "反應速度變快，但正確率下降，可能出現速度—準確度取捨。"
        : accuracyDiff > 0 && rtDiff <= 0
          ? "正確率提高且反應時間未增加，屬於較一致的改善訊號。"
          : "目前變化方向不一致，建議搭配更多同條件紀錄觀察。";
      return `【兩次測驗比較】\n前一次：${recordLine(compareA)}\n最近一次：${recordLine(compareB)}\n\n【變化】\n正確率：${accuracyDiff >= 0 ? "+" : ""}${accuracyDiff} 個百分點\n平均反應時間：${rtDiff >= 0 ? "+" : ""}${rtDiff} ms\n完成題數：${(compareB.total || 0) - (compareA.total || 0) >= 0 ? "+" : ""}${(compareB.total || 0) - (compareA.total || 0)} 題\n\n【解讀】\n${interpretation}${!comparable ? " 兩筆紀錄的遊戲或難度不同，因此不宜直接判定能力進步或退步。" : ""}\n\n【判讀信心】\n${confidenceText(2, comparable)}`;
    }

    const matchedGameKey = Object.keys(GAME_NAME_MAP).find((key) =>
      lower.includes(key.toLowerCase()) || lower.includes(GAME_NAME_MAP[key]) || lower.includes(ABILITY_BY_GAME[key])
    );

    if (matchedGameKey) {
      const gameRecords = sortedRecords.filter((record) => record.gameKey === matchedGameKey);
      if (!gameRecords.length) return `${patientName}目前沒有「${GAME_NAME_MAP[matchedGameKey]}」的有效紀錄。`;
      const gameLatest = gameRecords[0];
      const previous = gameRecords[1];
      const trend = previous
        ? `較前一次正確率${gameLatest.accuracy >= previous.accuracy ? "增加" : "下降"} ${Math.abs(gameLatest.accuracy - previous.accuracy)} 個百分點，反應時間${gameLatest.avgRt <= previous.avgRt ? "縮短" : "增加"} ${Math.abs((gameLatest.avgRt || 0) - (previous.avgRt || 0))} ms。`
        : "目前只有一筆紀錄，尚無法判斷趨勢。";
      return `【${GAME_NAME_MAP[matchedGameKey]}】\n主要觀察：${ABILITY_BY_GAME[matchedGameKey]}\n最近紀錄：${recordLine(gameLatest)}\n\n【趨勢】\n${trend}\n\n【判讀信心】\n${confidenceText(gameRecords.length, Boolean(previous))}`;
    }

    if (lower.includes("30") || lower.includes("近期") || lower.includes("摘要") || lower.includes("表現")) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const recentRecords = sortedRecords.filter((record) => new Date(record.date) >= cutoff);
      if (!recentRecords.length) return `${patientName}近 30 天沒有有效測驗或訓練紀錄。`;
      const recentAccuracy = Math.round(recentRecords.reduce((sum, record) => sum + Number(record.accuracy || 0), 0) / recentRecords.length);
      const games = [...new Set(recentRecords.map((record) => record.gameName))].join("、");
      return `【近 30 天摘要】\n紀錄數：${recentRecords.length} 筆\n涵蓋遊戲：${games}\n跨紀錄平均正確率：約 ${recentAccuracy}%\n最近一筆：${recordLine(recentRecords[0])}\n\n【解讀】\n跨遊戲平均只能作為概覽，各遊戲應分開判讀。建議優先查看同一遊戲、相同難度的連續變化。\n\n【資料充分度】\n${confidenceText(recentRecords.length)}`;
    }

    return `我已讀取 ${patientName} 目前的紀錄，但這個問題需要更明確的分析方向。你可以直接問：\n1. 最近一次測驗結果\n2. 比較兩次測驗\n3. 我該給什麼訓練建議\n4. 解釋目前選取的單題\n5. 產生給家長的說明`;
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
      accuracy: safeNumberValue(record.accuracy, 0),
      avgRt: safeNumberValue(record.avgRt, 0),
      total: safeNumberValue(record.total, 0),
      correct: safeNumberValue(record.correct, 0),
      wrong: safeNumberValue(record.wrong, 0),
      timeout: safeNumberValue(record.timeout, 0),
      difficulty: firstDefined(record.difficulty, record.difficultyLevel, null),
      stars: safeNumberValue(record.stars, 0),
      score: safeNumberValue(record.score, 0),
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
            averageAccuracy: average(sortedGameRecords.map((record) => record.accuracy)),
            averageReactionTime: average(
              sortedGameRecords.map((record) => record.avgRt).filter((value) => Number(value) > 0)
            ),
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
        `${gameKey}/${summary.gameName}：${summary.recordCount} 筆，測驗 ${summary.testCount}、訓練 ${summary.trainingCount}，平均正確率 ${summary.averageAccuracy}%` +
        `${summary.averageReactionTime ? `，平均反應 ${summary.averageReactionTime} ms` : ""}`
      )),
    ];

    if (context?.selectedRecord) {
      historyLines.push(
        `目前選取紀錄：${context.selectedRecord.gameName} ${context.selectedRecord.type}，正確率 ${context.selectedRecord.accuracy}%，平均反應 ${context.selectedRecord.avgRt || "-"} ms`
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
            riskLevel: patientSummary.risk?.label || null,
            testCount: safeNumberValue(patientSummary.testCount, 0),
            trainingCount: safeNumberValue(patientSummary.trainingCount, 0),
            averageAccuracy: safeNumberValue(patientSummary.averageAccuracy, 0),
            averageReactionTime: safeNumberValue(patientSummary.averageRt, 0),
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
    const result = {
      comparison: null,
      latestTrend: null,
      recent30Days: null,
    };

    if (compareA && compareB) {
      const sameGame = compareA.gameKey === compareB.gameKey;
      const sameMode = compareA.type === compareB.type;
      const sameDifficulty =
        String(firstDefined(compareA.difficulty, "")) ===
        String(firstDefined(compareB.difficulty, ""));

      result.comparison = {
        accuracyDifference:
          safeNumberValue(compareB.accuracy, 0) - safeNumberValue(compareA.accuracy, 0),
        reactionTimeDifference:
          safeNumberValue(compareB.avgRt, 0) - safeNumberValue(compareA.avgRt, 0),
        completedTrialsDifference:
          safeNumberValue(compareB.total, 0) - safeNumberValue(compareA.total, 0),
        sameGame,
        sameMode,
        sameDifficulty,
        directlyComparable: sameGame && sameMode && sameDifficulty,
      };
    }

    const sortedRecords = [...selectedPatientRecords].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
    const latest = sortedRecords[0];

    if (latest) {
      const previousSameCondition = sortedRecords.slice(1).find(
        (record) =>
          record.gameKey === latest.gameKey &&
          record.type === latest.type &&
          String(firstDefined(record.difficulty, "")) ===
            String(firstDefined(latest.difficulty, ""))
      );

      const previousSameGame = previousSameCondition || sortedRecords.slice(1).find(
        (record) => record.gameKey === latest.gameKey && record.type === latest.type
      );

      if (previousSameGame) {
        result.latestTrend = {
          currentRecordId: latest.id || null,
          previousRecordId: previousSameGame.id || null,
          accuracyDifference:
            safeNumberValue(latest.accuracy, 0) - safeNumberValue(previousSameGame.accuracy, 0),
          reactionTimeDifference:
            safeNumberValue(latest.avgRt, 0) - safeNumberValue(previousSameGame.avgRt, 0),
          sameDifficulty:
            String(firstDefined(latest.difficulty, "")) ===
            String(firstDefined(previousSameGame.difficulty, "")),
        };
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const recent = sortedRecords.filter((record) => {
      const date = new Date(record.date || 0);
      return !Number.isNaN(date.getTime()) && date >= cutoff;
    });

    if (recent.length > 0) {
      const byGame = recent.reduce((acc, record) => {
        const key = record.gameKey || "UNKNOWN";
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
      }, {});

      result.recent30Days = {
        recordCount: recent.length,
        gameCount: Object.keys(byGame).length,
        byGame: Object.fromEntries(
          Object.entries(byGame).map(([gameKey, gameRecords]) => [
            gameKey,
            {
              recordCount: gameRecords.length,
              averageAccuracy: Math.round(
                gameRecords.reduce(
                  (sum, record) => sum + safeNumberValue(record.accuracy, 0),
                  0
                ) / gameRecords.length
              ),
              averageReactionTime: Math.round(
                gameRecords.reduce(
                  (sum, record) => sum + safeNumberValue(record.avgRt, 0),
                  0
                ) / gameRecords.length
              ),
            },
          ])
        ),
      };
    }

    return result;
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
      headers: { "Content-Type": "application/json" },
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

    const userMessage = { id: `user-${Date.now()}`, role: "user", content: question };
    setAssistantMessages((previous) => [...previous, userMessage]);
    setAssistantQuestion("");
    setAssistantLoading(true);

    try {
      const result = await generateAssistantAnswer(question);
      const answerMessage = {
        id: `assistant-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: String(result?.answer || "目前無法產生回覆。"),
        sources: result?.sources || [],
        ragUsed: Boolean(result?.ragUsed),
        fallback: Boolean(result?.fallback),
      };
      setAssistantMessages((previous) => [...previous, answerMessage]);
    } catch (error) {
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

  const generateReportText = () => {
    if (!selectedPatient || !patientSummary) return "尚無可產生的報告內容。";

    const name = selectedPatient.nickname || selectedPatient.full_name || "未命名兒童";
    const lines = [
      `個案：${name}`,
      `年齡：${calculateAge(selectedPatient.birth_date)}｜性別：${formatGender(selectedPatient.gender)}`,
      `風險分級：${patientSummary.risk.label}`,
      `資料量：測驗 ${patientSummary.testCount} 筆，訓練 ${patientSummary.trainingCount} 筆`,
      `平均正確率：${patientSummary.averageAccuracy}%`,
      `平均反應時間：${patientSummary.averageRt || "-"} ms`,
      patientSummary.lastRecord
        ? `最近紀錄：${formatDate(patientSummary.lastRecord.date)}｜${patientSummary.lastRecord.gameName}｜正確率 ${patientSummary.lastRecord.accuracy}%`
        : "最近紀錄：尚無資料",
      `建議：${patientSummary.risk.text}`,
    ];

    return lines.join("\n");
  };

  const exportRecordToDocx = async (record) => {
    if (!record || !selectedPatient) return;

    try {
      setExportingRecordId(record.id);
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        HeadingLevel,
        AlignmentType,
        WidthType,
        BorderStyle,
      } = await import("docx");

      const patientName = selectedPatient.nickname || selectedPatient.full_name || "未命名兒童";
      const recordTypeLabel = record.type === "test" ? "測驗" : record.type === "training" ? "訓練" : "紀錄";
      const trials = Array.isArray(record.trials) ? record.trials : [];
      const borders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      };

      const cell = (text, bold = false) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? "-"), bold, size: 20 })] })],
      });

      const summaryRows = [
        ["個案", patientName],
        ["年齡 / 性別", `${calculateAge(selectedPatient.birth_date)} / ${formatGender(selectedPatient.gender)}`],
        ["遊戲", `${record.gameName}（${record.gameKey || "-"}）`],
        ["能力", record.ability || "-"],
        ["類型", recordTypeLabel],
        ["完成時間", formatDate(record.date)],
        ["難度", record.difficulty || "-"],
        ["分數", record.score || "-"],
        ["星級", record.stars > 0 ? `${record.stars} 星` : "-"],
        ["正確率", `${record.accuracy || 0}%`],
        ["平均反應時間", record.avgRt ? `${record.avgRt} ms` : "-"],
        ["正確 / 總題數", `${record.correct || 0} / ${record.total || "-"}`],
        ["錯誤次數", record.errors ?? "-"],
        ["資料來源", record.sourceTable || record.source || "-"],
      ];

      const summaryTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: summaryRows.map(([label, value]) => new TableRow({ children: [cell(label, true), cell(value)] })),
      });

      const trialHeader = new TableRow({
        tableHeader: true,
        children: ["題次", "結果", "反應時間", "難度", "作答 / 內容"].map((text) => cell(text, true)),
      });

      const trialRows = trials.map((trial, index) => {
        const isCorrect = trial?.isCorrect ?? trial?.correct ?? trial?.success;
        const resultLabel = isCorrect === true ? "正確" : isCorrect === false ? "錯誤" : (trial?.result || trial?.status || trial?.outcome || "-");
        const reactionTime = trial?.reactionTime ?? trial?.responseTime ?? trial?.rt ?? trial?.reaction_time;
        const difficulty = trial?.difficultyLabel ?? trial?.difficultyLevel ?? trial?.difficulty ?? record.difficulty;
        const response = trial?.selectedAnswer ?? trial?.answer ?? trial?.response ?? trial?.target ?? trial?.choice ?? trial?.clickedItem;
        return new TableRow({
          children: [
            cell(trial?.trialNumber ?? trial?.round ?? index + 1),
            cell(resultLabel),
            cell(reactionTime !== undefined && reactionTime !== null ? `${reactionTime} ms` : "-"),
            cell(difficulty || "-"),
            cell(typeof response === "object" ? JSON.stringify(response) : (response ?? "-")),
          ],
        });
      });

      const children = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: "執行功能測驗 / 訓練結果報告", bold: true, size: 34 })],
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `匯出時間：${formatDate(new Date().toISOString())}`, size: 20, color: "64748B" })] }),
        new Paragraph({ text: "基本資料與結果摘要", heading: HeadingLevel.HEADING_1 }),
        summaryTable,
        new Paragraph({ text: "逐題紀錄", heading: HeadingLevel.HEADING_1, spacing: { before: 320 } }),
      ];

      if (trialRows.length > 0) {
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders,
          rows: [trialHeader, ...trialRows],
        }));
      } else {
        children.push(new Paragraph({ text: "此筆資料沒有可用的逐題紀錄。" }));
      }


      const document = new Document({
        creator: clinicianName || "EF 幼兒認知訓練平台",
        title: `${patientName}-${record.gameName}-${recordTypeLabel}`,
        description: "單次測驗或訓練結果報告",
        sections: [{
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(document);
      const url = URL.createObjectURL(blob);
      const anchor = documentRefCreateAnchor(url, `${patientName}_${record.gameKey || "GAME"}_${recordTypeLabel}_${formatFileDate(record.date)}.docx`);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("DOCX 匯出失敗：", error);
      window.alert("DOCX 匯出失敗。請確認專案已安裝 docx 套件（npm install docx）。");
    } finally {
      setExportingRecordId("");
    }
  };

  const exportSelectedRecordsToDocx = async () => {
    if (!selectedPatient || selectedRecordIds.length === 0) return;

    const selectedRecords = selectedPatientRecords
      .filter((record) => selectedRecordIds.includes(record.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (selectedRecords.length === 0) return;

    try {
      setExportingCombinedReport(true);
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        HeadingLevel,
        AlignmentType,
        WidthType,
        BorderStyle,
      } = await import("docx");

      const patientName = selectedPatient.nickname || selectedPatient.full_name || "未命名兒童";
      const borders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "D7E0EA" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      };
      const cell = (text, bold = false) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? "-"), bold, size: 19 })] })],
      });
      const mean = (values) => {
        const valid = values.map(Number).filter(Number.isFinite);
        return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
      };
      const typeLabel = (type) => type === "test" ? "測驗" : type === "training" ? "訓練" : "紀錄";
      const testCount = selectedRecords.filter((record) => record.type === "test").length;
      const trainingCount = selectedRecords.filter((record) => record.type === "training").length;
      const avgAccuracy = mean(selectedRecords.map((record) => record.accuracy));
      const avgRt = mean(selectedRecords.map((record) => record.avgRt).filter((value) => Number(value) > 0));
      const gameGroups = Object.entries(selectedRecords.reduce((groups, record) => {
        (groups[record.gameKey] ||= []).push(record);
        return groups;
      }, {}));

      const interpretationLines = gameGroups.map(([gameKey, gameRecords]) => {
        const ordered = [...gameRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = ordered[0];
        const last = ordered[ordered.length - 1];
        const accuracyChange = Math.round((last.accuracy || 0) - (first.accuracy || 0));
        const rtChange = first.avgRt > 0 && last.avgRt > 0 ? Math.round(last.avgRt - first.avgRt) : null;
        const direction = accuracyChange > 0 ? "提升" : accuracyChange < 0 ? "下降" : "持平";
        const rtText = rtChange === null ? "反應時間資料不足" : rtChange < 0 ? `平均反應時間縮短 ${Math.abs(rtChange)} ms` : rtChange > 0 ? `平均反應時間增加 ${rtChange} ms` : "平均反應時間持平";
        return `${GAME_NAME_MAP[gameKey] || gameKey}（${ABILITY_BY_GAME[gameKey] || "相關能力"}）：共 ${ordered.length} 筆，正確率由 ${first.accuracy || 0}% 至 ${last.accuracy || 0}%（${direction} ${Math.abs(accuracyChange)} 個百分點），${rtText}。`;
      });

      const recommendationLines = [];
      if (selectedRecords.length < 2) recommendationLines.push("目前僅選取 1 筆紀錄，適合做單次摘要，不足以判斷穩定趨勢。建議後續選取相同遊戲的多次紀錄比較。");
      if (avgAccuracy < 60) recommendationLines.push("整體平均正確率偏低，建議確認規則理解、注意狀態與操作熟悉度，並從較低難度進行短時間練習。");
      else if (avgAccuracy < 80) recommendationLines.push("整體表現介於可持續練習區間，可維持目前難度並觀察錯誤型態與跨次穩定度。");
      else recommendationLines.push("整體平均正確率良好，可在維持正確率的前提下逐步增加難度，避免只以速度提升作為進步依據。");
      if (avgRt > 0) recommendationLines.push("反應時間應與正確率共同解讀；速度變快但錯誤增加，不宜直接視為能力提升。");
      if (testCount > 0 && trainingCount > 0) recommendationLines.push("本報告同時納入測驗與訓練資料；測驗較適合階段性比較，訓練資料則用於觀察練習歷程，兩者不宜直接視為完全相同的評量條件。");

      const summaryTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          ["個案", patientName],
          ["年齡 / 性別", `${calculateAge(selectedPatient.birth_date)} / ${formatGender(selectedPatient.gender)}`],
          ["選取紀錄", `${selectedRecords.length} 筆（測驗 ${testCount}、訓練 ${trainingCount}）`],
          ["涵蓋遊戲", [...new Set(selectedRecords.map((record) => record.gameName))].join("、")],
          ["期間", `${formatDate(selectedRecords[0].date)} ～ ${formatDate(selectedRecords[selectedRecords.length - 1].date)}`],
          ["平均正確率", `${avgAccuracy}%`],
          ["平均反應時間", avgRt > 0 ? `${avgRt} ms` : "-"],
        ].map(([label, value]) => new TableRow({ children: [cell(label, true), cell(value)] })),
      });

      const recordTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({ tableHeader: true, children: ["日期", "類型", "遊戲", "能力", "難度", "分數", "正確率", "平均反應"].map((text) => cell(text, true)) }),
          ...selectedRecords.map((record) => new TableRow({ children: [
            cell(formatDate(record.date)),
            cell(typeLabel(record.type)),
            cell(record.gameName),
            cell(record.ability),
            cell(record.difficulty || "-"),
            cell(record.score || "-"),
            cell(`${record.accuracy || 0}%`),
            cell(record.avgRt ? `${record.avgRt} ms` : "-"),
          ] })),
        ],
      });

      const children = [
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE, children: [new TextRun({ text: "執行功能整合與比較報告", bold: true, size: 34 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `匯出時間：${formatDate(new Date().toISOString())}`, size: 20, color: "64748B" })] }),
        new Paragraph({ text: "一、個案與選取資料摘要", heading: HeadingLevel.HEADING_1 }),
        summaryTable,
        new Paragraph({ text: "二、納入比較的紀錄", heading: HeadingLevel.HEADING_1, spacing: { before: 320 } }),
        recordTable,
        new Paragraph({ text: "三、分項趨勢與比較", heading: HeadingLevel.HEADING_1, spacing: { before: 320 } }),
        ...interpretationLines.map((text) => new Paragraph({ text, bullet: { level: 0 } })),
        new Paragraph({ text: "四、臨床參考重點", heading: HeadingLevel.HEADING_1, spacing: { before: 320 } }),
        ...recommendationLines.map((text) => new Paragraph({ text, bullet: { level: 0 } })),
        new Paragraph({ text: "五、判讀限制", heading: HeadingLevel.HEADING_1, spacing: { before: 320 } }),
        new Paragraph({ text: "本報告依平台內所選測驗與訓練結果進行描述性整合，適合用於追蹤與溝通參考，不等同正式診斷。不同遊戲、模式、難度、作答環境與資料筆數可能影響結果，應結合臨床觀察、標準化評估及其他相關資料綜合判讀。" }),
      ];

      const document = new Document({
        creator: clinicianName || "EF 幼兒認知訓練平台",
        title: `${patientName}-整合比較報告`,
        description: "多筆測驗與訓練結果整合比較報告",
        sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
      });

      const blob = await Packer.toBlob(document);
      const url = URL.createObjectURL(blob);
      const anchor = documentRefCreateAnchor(url, `${patientName}_整合比較報告_${formatFileDate(new Date().toISOString())}.docx`);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("整合 DOCX 匯出失敗：", error);
      window.alert("整合 DOCX 匯出失敗。請確認專案已安裝 docx 套件（npm install docx）。");
    } finally {
      setExportingCombinedReport(false);
    }
  };

  const renderTypeBadge = (type) => {
    const label = type === "test" ? "測驗" : type === "training" ? "訓練" : "紀錄";
    const style = type === "test" ? testBadgeStyle : type === "training" ? trainingBadgeStyle : sessionBadgeStyle;
    return <span style={{ ...badgeStyle, ...style }}>{label}</span>;
  };

  const renderRiskBadge = (risk) => {
    if (!risk) return null;
    const style = risk.tone === "danger" ? dangerBadgeStyle : risk.tone === "warning" ? warningBadgeStyle : risk.tone === "safe" ? safeBadgeStyle : emptyBadgeStyle;
    return <span style={{ ...badgeStyle, ...style }}>{risk.label}</span>;
  };

  return (
    <div className="clinician-dashboard-page" style={pageStyle}>
      <style>{responsiveCss}</style>
      <div style={backgroundOverlayStyle} />

      <header className="clinician-dashboard-header" style={headerStyle}>
        <div>
          <h1 style={titleStyle}>EF 幼兒認知訓練平台</h1>
          <p style={subtitleStyle}>醫療端｜個案追蹤、風險分級、回診提醒與詳細資料分析</p>
        </div>

        <div className="clinician-dashboard-header-actions" style={headerRightStyle}>
          <span style={userTextStyle}>您好，{clinicianName || "醫療人員"}</span>
          <button onClick={() => setShowAddPatient(true)} style={addPatientButtonStyle}>＋ 新增兒童</button>
          <button onClick={fetchClinicianAndPatients} style={refreshButtonStyle}>重新整理</button>
          <button onClick={handleLogout} style={logoutButtonStyle}>登出</button>
        </div>
      </header>

      {showAddPatient && (
        <div style={modalBackdropStyle} role="presentation" onMouseDown={closeAddPatient}>
          <form
            style={addPatientModalStyle}
            onSubmit={handleClinicianAddPatient}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinician-add-patient-title"
          >
            <div style={addPatientModalHeaderStyle}>
              <div>
                <h2 id="clinician-add-patient-title" style={addPatientModalTitleStyle}>新增兒童資料</h2>
                <p style={addPatientModalDescStyle}>孩子會綁定既有家長帳號，並自動授權給目前醫療人員。</p>
              </div>
              <button type="button" onClick={closeAddPatient} disabled={addPatientSubmitting} style={modalCloseButtonStyle}>×</button>
            </div>

            <label style={addPatientLabelStyle}>
              家長帳號 Email（必填）
              <input type="email" value={addPatientForm.guardianEmail} onChange={handleAddPatientField("guardianEmail")} style={addPatientInputStyle} disabled={addPatientSubmitting} />
            </label>
            <div style={addPatientTwoColumnStyle}>
              <label style={addPatientLabelStyle}>
                孩子暱稱（必填）
                <input value={addPatientForm.nickname} onChange={handleAddPatientField("nickname")} maxLength={12} style={addPatientInputStyle} disabled={addPatientSubmitting} />
              </label>
              <label style={addPatientLabelStyle}>
                孩子姓名（選填）
                <input value={addPatientForm.fullName} onChange={handleAddPatientField("fullName")} style={addPatientInputStyle} disabled={addPatientSubmitting} />
              </label>
              <label style={addPatientLabelStyle}>
                出生日期（必填）
                <input type="date" value={addPatientForm.birthDate} onChange={handleAddPatientField("birthDate")} max={new Date().toISOString().slice(0, 10)} style={addPatientInputStyle} disabled={addPatientSubmitting} />
              </label>
              <label style={addPatientLabelStyle}>
                性別（必填）
                <select value={addPatientForm.gender} onChange={handleAddPatientField("gender")} style={addPatientInputStyle} disabled={addPatientSubmitting}>
                  <option value="">請選擇</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                  <option value="undisclosed">暫不透露</option>
                </select>
              </label>
            </div>

            {addPatientError && <div role="alert" style={addPatientFormErrorStyle}>{addPatientError}</div>}

            <div style={addPatientModalActionsStyle}>
              <button type="button" onClick={closeAddPatient} disabled={addPatientSubmitting} style={cancelButtonStyle}>取消</button>
              <button type="submit" disabled={addPatientSubmitting} style={addPatientButtonStyle}>
                {addPatientSubmitting ? "建立中..." : "建立並連結"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loadError && (
        <div role="alert" style={loadErrorStyle}>
          <div style={loadErrorTextStyle}>
            <strong>資料更新失敗</strong>
            <span>{loadError}</span>
            {patients.length > 0 && <small>目前先保留上一次成功載入的資料。</small>}
          </div>
          <button type="button" onClick={fetchClinicianAndPatients} style={refreshButtonStyle}>再試一次</button>
        </div>
      )}

      <section className="clinician-dashboard-stats" style={statsGridStyle}>
        <StatCard title="授權病患" value={dashboardStats.patientCount} desc="目前可查看的兒童個案" />
        <StatCard title="測驗紀錄" value={dashboardStats.totalTests} desc="正式測驗資料筆數" />
        <StatCard title="訓練紀錄" value={dashboardStats.totalTraining} desc="訓練歷程資料筆數" />
        <StatCard title="近 7 天新資料" value={dashboardStats.newRecords} desc="待醫療人員查看" />
        <StatCard title="需要處理" value={dashboardStats.needFollowUp} desc="需要提醒或追蹤" danger />
      </section>

      {loading ? (
        <div style={emptyBoxStyle}>載入醫療端資料中...</div>
      ) : patients.length === 0 && !loadError ? (
        <div style={emptyBoxStyle}>目前尚未連結任何病患資料</div>
      ) : patients.length === 0 ? (
        <div style={emptyBoxStyle}>目前無法取得個案資料，請按「再試一次」。</div>
      ) : (
        <div className="clinician-dashboard-layout" style={{ ...layoutStyle, gridTemplateColumns: "310px minmax(0, 1fr)" }}>
          <aside className="clinician-dashboard-left" style={leftPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>病患清單</h2>
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
              <button onClick={() => setRiskFilter("danger")} style={pillButtonStyle(riskFilter === "danger")}>高度關注</button>
              <button onClick={() => setRiskFilter("warning")} style={pillButtonStyle(riskFilter === "warning")}>需要注意</button>
              <button onClick={() => setRiskFilter("safe")} style={pillButtonStyle(riskFilter === "safe")}>正常</button>
              <button onClick={() => setRiskFilter("empty")} style={pillButtonStyle(riskFilter === "empty")}>資料不足</button>
            </div>

            <div style={patientListStyle}>
              {filteredPatientCards.map(({ patient, risk, lastRecord }) => {
                const active = selectedPatient?.id === patient.id;
                return (
                  <button
                    key={patient.id}
                    onClick={() => {
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

          <main className="clinician-dashboard-center" style={centerPanelStyle}>
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
                    <MiniStat label="平均正確率" value={`${patientSummary.averageAccuracy}%`} />
                    <MiniStat label="平均反應" value={patientSummary.averageRt ? `${patientSummary.averageRt}ms` : "-"} />
                  </div>
                </section>

                <nav className="clinician-dashboard-patient-tabs" style={patientTabsStyle} aria-label="個案資料選單">
                  {[
                    { key: "trend", label: "能力趨勢", desc: "六項摘要與折線圖" },
                    { key: "records", label: "紀錄與比較", desc: "篩選、比較與 DOCX" },
                    { key: "tools", label: "個案工具", desc: "提醒、備註與摘要" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActivePatientTab(tab.key)}
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
                      <h3 style={smallSectionTitleStyle}>六項能力摘要</h3>
                      <p style={panelDescStyle}>每張卡片代表一款遊戲；點選卡片可切換下方趨勢圖。</p>
                    </div>
                  </div>

                  <div className="clinician-dashboard-game-grid" style={abilitySummaryGridStyle}>
                    {Object.keys(GAME_NAME_MAP).map((gameKey) => {
                      const summary = patientSummary.gameSummaryMap[gameKey];
                      const latest = summary?.latest;
                      const active = trendGameKey === gameKey;
                      const change = summary?.change;
                      return (
                        <button
                          type="button"
                          key={gameKey}
                          onClick={() => setTrendGameKey(gameKey)}
                          style={{
                            ...abilitySummaryCardStyle,
                            background: active ? GAME_THEME_MAP[gameKey].soft : "rgba(255,255,255,.86)",
                            borderColor: active ? GAME_THEME_MAP[gameKey].border : "rgba(148,163,184,.28)",
                            boxShadow: active ? `0 12px 26px ${GAME_THEME_MAP[gameKey].primary}22` : "none",
                            ...(active ? activeAbilitySummaryCardStyle : {}),
                          }}
                        >
                          <div style={abilityCardHeaderStyle}>
                            <strong style={gameMiniTitleStyle}>{GAME_NAME_MAP[gameKey]}</strong>
                            <span style={{ ...gameCodeBadgeStyle, background: GAME_THEME_MAP[gameKey].soft, color: GAME_THEME_MAP[gameKey].dark, border: `1px solid ${GAME_THEME_MAP[gameKey].border}` }}>{gameKey}</span>
                          </div>
                          <span style={gameMiniTextStyle}>{ABILITY_BY_GAME[gameKey]}</span>
                          <span style={{ ...abilityPrimaryValueStyle, color: GAME_THEME_MAP[gameKey].dark }}>{latest ? `${latest.accuracy}%` : "尚無資料"}</span>
                          <span style={abilityMetaStyle}>平均正確率：{summary?.count ? `${summary.averageAccuracy}%` : "-"}</span>
                          <span style={abilityMetaStyle}>紀錄數：{summary?.count || 0} 筆</span>
                          <span style={{ ...abilityChangeStyle, color: change == null ? "#64748b" : change > 0 ? "#15803d" : change < 0 ? "#b91c1c" : "#64748b" }}>
                            {change == null ? "尚無前次資料" : change > 0 ? `較前次 +${change}%` : change < 0 ? `較前次 ${change}%` : "與前次相同"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={trendSectionStyle}>
                    <div style={trendHeaderStyle}>
                      <div>
                        <h3 style={trendTitleStyle}>{GAME_NAME_MAP[trendGameKey]}趨勢</h3>
                        <p style={panelDescStyle}>顯示此遊戲全部測驗與訓練紀錄；點選折線圖上的資料點，會切換至「紀錄與比較」並開啟該次完整紀錄。</p>
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
                      <CompareResult a={compareA} b={compareB} />
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
                      <strong style={recordActionTitleStyle}>整合／比較 DOCX</strong>
                      <span style={recordActionHintStyle}>勾選需要的測驗或訓練，可跨遊戲整合；相同遊戲會自動比較前後變化。報告不包含原始備查 JSON。</span>
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
                        onClick={exportSelectedRecordsToDocx}
                        disabled={selectedRecordIds.length === 0 || exportingCombinedReport}
                        style={{ ...docxButtonStyle, opacity: selectedRecordIds.length === 0 || exportingCombinedReport ? 0.55 : 1 }}
                      >
                        {exportingCombinedReport ? "整合中…" : "輸出整合 DOCX"}
                      </button>
                    </div>
                  </div>

                  {selectedRecord && (
                    <div ref={recordDetailRef} className="clinician-dashboard-record-accordion" style={recordAccordionWrapStyle}>
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
                                onClick={() => exportRecordToDocx(selectedRecord)}
                                disabled={exportingRecordId === selectedRecord.id}
                                style={{ ...docxButtonStyle, opacity: exportingRecordId === selectedRecord.id ? 0.65 : 1 }}
                              >
                                {exportingRecordId === selectedRecord.id ? "產生中…" : "輸出 DOCX"}
                              </button>
                            </div>
                          </div>
                          <div className="clinician-dashboard-detail-grid" style={recordDetailGridStyle}>
                            <InfoItem label="資料來源" value={selectedRecord.sourceTable} />
                            <InfoItem label="紀錄 ID" value={selectedRecord.id} />
                            <InfoItem label="遊戲" value={selectedRecord.gameName} />
                            <InfoItem label="能力" value={selectedRecord.ability} />
                            <InfoItem label="類型" value={selectedRecord.type === "test" ? "測驗" : selectedRecord.type === "training" ? "訓練" : "紀錄"} />
                            <InfoItem label="建立時間" value={formatDate(selectedRecord.date)} />
                            <InfoItem label="難度" value={selectedRecord.difficulty ?? "-"} />
                            <InfoItem label="分數" value={selectedRecord.score ?? "-"} />
                            <InfoItem label="星級" value={selectedRecord.stars > 0 ? `${selectedRecord.stars} 星` : "-"} />
                            <InfoItem label="正確率" value={`${selectedRecord.accuracy}%`} />
                            <InfoItem label="完成題數" value={selectedRecord.total ?? "-"} />
                            <InfoItem label="正確題數" value={selectedRecord.correct ?? "-"} />
                            <InfoItem label="錯誤題數" value={selectedRecord.wrong ?? selectedRecord.errors ?? "-"} />
                            <InfoItem label="逾時題數" value={selectedRecord.timeout ?? "-"} />
                            <InfoItem label="平均反應時間" value={selectedRecord.avgRt ? `${selectedRecord.avgRt} ms` : "-"} />
                            <InfoItem label="逐題資料" value={Array.isArray(selectedRecord.trials) ? `${selectedRecord.trials.length} 筆` : "0 筆"} />
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

                  <div className="clinician-dashboard-table-wrap" style={tableWrapStyle}>
                    <table className="clinician-dashboard-table" style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>選取</th>
                          <th style={thStyle}>日期</th>
                          <th style={thStyle}>類型</th>
                          <th style={thStyle}>遊戲</th>
                          <th style={thStyle}>能力</th>
                          <th style={thStyle}>難度</th>
                          <th style={thStyle}>分數</th>
                          <th style={thStyle}>星級</th>
                          <th style={thStyle}>正確率</th>
                          <th style={thStyle}>平均反應</th>
                          <th style={thStyle}>題數</th>
                          <th style={thStyle}>詳細</th>
                        </tr>
                      </thead>
                      <tbody key={recordFilterSignature}>
                        {visibleRecords.map((record, recordIndex) => (
                          <tr
                            key={`${recordFilterSignature}-${record.id}-${record.gameKey}-${record.type}-${record.date}-${recordIndex}`}
                            style={trStyle}
                          >
                            <td style={tdStyle}>
                              <input
                                type="checkbox"
                                aria-label={`選取 ${record.gameName} ${formatDate(record.date)}`}
                                checked={selectedRecordIds.includes(record.id)}
                                onChange={() => setSelectedRecordIds((previous) => previous.includes(record.id) ? previous.filter((id) => id !== record.id) : [...previous, record.id])}
                                style={checkboxInputStyle}
                              />
                            </td>
                            <td style={tdStyle}>{formatDate(record.date)}</td>
                            <td style={tdStyle}>{renderTypeBadge(record.type)}</td>
                            <td style={tdStyle}>{record.gameName}</td>
                            <td style={tdStyle}>{record.ability}</td>
                            <td style={tdStyle}>{record.difficulty}</td>
                            <td style={tdStyle}>{record.score || "-"}</td>
                            <td style={tdStyle}>{record.stars > 0 ? `${record.stars} 星` : "-"}</td>
                            <td style={tdStyle}>{record.accuracy}%</td>
                            <td style={tdStyle}>{record.avgRt || "-"} ms</td>
                            <td style={tdStyle}>{record.correct}/{record.total || "-"}</td>
                            <td style={tdStyle}>
                              <div style={tableActionGroupStyle}>
                                <button
                                  onClick={() => {
                                    const isSameRecord = selectedRecord?.id === record.id;
                                    setSelectedRecord(record);
                                    setRecordDetailOpen(isSameRecord ? !recordDetailOpen : true);
                                  }}
                                  style={{
                                    ...tableButtonStyle,
                                    ...(selectedRecord?.id === record.id && recordDetailOpen ? activeTableButtonStyle : {}),
                                  }}
                                >
                                  {selectedRecord?.id === record.id && recordDetailOpen ? "收合" : "查看"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => exportRecordToDocx(record)}
                                  disabled={exportingRecordId === record.id}
                                  style={{ ...tableExportButtonStyle, opacity: exportingRecordId === record.id ? 0.6 : 1 }}
                                >
                                  {exportingRecordId === record.id ? "產生中" : "DOCX"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredRecords.length === 0 && <div style={emptyTableStyle}>目前沒有符合條件的資料</div>}
                  </div>

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
                        <p style={panelDescStyle}>建立家長提醒、紀錄醫療備註，並整理個案報告摘要。所有工具改為置於頁面下方，方便在同一區域完成追蹤工作。</p>
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
                          value={reminderMessage}
                          onChange={(event) => setReminderMessage(event.target.value)}
                          style={textareaStyle}
                          rows={5}
                        />
                        <button onClick={handleCreateReminder} style={primaryButtonStyle}>建立提醒</button>
                      </section>

                      <section style={noteCardStyle}>
                        <h3 style={smallSectionTitleStyle}>醫療備註</h3>
                        <textarea
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          placeholder="輸入本次觀察、建議訓練方向或回診重點..."
                          style={textareaStyle}
                          rows={5}
                        />
                        <button onClick={handleSaveNote} style={primaryButtonStyle}>儲存備註</button>
                        <div style={noteListStyle}>
                          {selectedPatientNotes.slice(0, 4).map((note) => (
                            <div key={note.id} style={noteItemStyle}>
                              <span style={noteDateStyle}>{formatDate(note.created_at)}</span>
                              <p style={noteTextStyle}>{note.note}</p>
                            </div>
                          ))}
                          {selectedPatientNotes.length === 0 && <p style={emptySmallTextStyle}>尚無醫療備註</p>}
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
          <button onClick={() => navigate("/research-statistics")} style={refreshButtonStyle}>研究統計</button>
          <button onClick={() => navigate("/ai-behavioral-analysis")} style={refreshButtonStyle}>AI 行為分析</button>
          <button onClick={() => navigate("/adaptive-recommendation-research")} style={refreshButtonStyle}>自適應建議</button>
          <button onClick={() => navigate("/longitudinal-dashboard")} style={refreshButtonStyle}>縱向追蹤儀表板</button>
          <button onClick={() => navigate("/research-professional-dashboard")} style={refreshButtonStyle}>研究工作區</button>
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

function StatCard({ title, value, desc, danger = false }) {
  return (
    <div style={{ ...statCardStyle, ...(danger ? statCardDangerStyle : {}) }}>
      <p style={statTitleStyle}>{title}</p>
      <h2 style={statValueStyle}>{value}</h2>
      <p style={statDescStyle}>{desc}</p>
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
  const displayValue = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <div style={infoItemStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{displayValue}</strong>
    </div>
  );
}

function TrendChart({ data, theme, gameName, selectedRecordId, onSelectRecord }) {
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

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div style={trendOuterStyle}>
      <div style={trendLegendStyle}>
        <span style={{ ...trendLegendDotStyle, background: safeTheme.primary }} />
        <span>{gameName}正確率</span>
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
                <text x={paddingX - 10} y={y + 4} fontSize="11" textAnchor="end" fill="#64748b">{value}%</text>
              </g>
            );
          })}
          <polyline points={polyline} fill="none" stroke={safeTheme.primary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => {
            const isTraining = point.item.type === "training";
            const selected = selectedRecordId === point.item.recordId;
            const typeText = isTraining ? "訓練" : point.item.type === "test" ? "測驗" : "紀錄";
            const accessibleText = `${formatTrendRecordDate(point.item.date)} ${typeText}，正確率 ${point.item.accuracy}%，平均反應 ${point.item.rt || 0} 毫秒`;

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
                <title>{`${accessibleText}\n難度：${point.item.difficulty ?? "-"}\n分數：${point.item.score ?? "-"}\n點擊查看完整紀錄`}</title>
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
                <text x={point.x} y={point.y - 15} fontSize="12" fontWeight="800" textAnchor="middle" fill={safeTheme.dark}>{point.item.accuracy}%</text>
                <text transform={`translate(${point.x - 2} ${height - 50}) rotate(-32)`} fontSize="10" textAnchor="end" fill="#64748b">{point.item.label}</text>
                <text x={point.x} y={height - 20} fontSize="10" fontWeight="700" textAnchor="middle" fill={isTraining ? "#7c3aed" : "#1f5f8b"}>{typeText}</text>
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

function CompareResult({ a, b }) {
  if (!a || !b) return null;

  const sameGame = a.gameKey === b.gameKey;
  const sameType = a.type === b.type;
  const sameDifficulty = String(a.difficulty ?? "") === String(b.difficulty ?? "");
  const comparable = sameGame && sameType && sameDifficulty;
  const limitations = [
    !sameGame ? "遊戲不同" : null,
    !sameType ? "模式不同" : null,
    !sameDifficulty ? "難度不同" : null,
  ].filter(Boolean);

  const rows = [
    { label: "正確率", a: `${a.accuracy}%`, b: `${b.accuracy}%`, diff: `${Number(b.accuracy || 0) - Number(a.accuracy || 0)}%` },
    { label: "平均反應時間", a: `${a.avgRt || "-"} ms`, b: `${b.avgRt || "-"} ms`, diff: `${Number(b.avgRt || 0) - Number(a.avgRt || 0)} ms` },
    { label: "錯誤次數", a: a.errors, b: b.errors, diff: Number(b.errors || 0) - Number(a.errors || 0) },
    { label: "星級", a: `${a.stars || 0} 星`, b: `${b.stars || 0} 星`, diff: `${Number(b.stars || 0) - Number(a.stars || 0)} 星` },
  ];

  return (
    <div>
      <div style={comparisonValidityStyle(comparable)}>
        <strong>{comparable ? "可直接描述本次與前次差異" : "比較條件不完全一致"}</strong>
        <span>
          {comparable
            ? "兩筆紀錄的遊戲、模式與難度一致；仍不應僅依兩筆資料判定長期趨勢。"
            : `限制：${limitations.join("、")}。數值可並列查看，但不宜直接視為能力進步或退步。`}
        </span>
      </div>

      <div className="clinician-dashboard-compare-result" style={compareResultStyle}>
      {rows.map((row) => (
        <div key={row.label} style={compareMetricStyle}>
          <span style={compareMetricLabelStyle}>{row.label}</span>
          <strong style={compareMetricValueStyle}>{row.a} → {row.b}</strong>
          <span style={compareMetricDiffStyle}>變化：{row.diff}</span>
        </div>
      ))}
      </div>
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
  background: "#f6efd9",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const backgroundOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundImage: `linear-gradient(135deg, rgba(248, 250, 252, 0.76), rgba(255, 247, 216, 0.74)), url(${bgImg})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  zIndex: 0,
  pointerEvents: "none",
};

const headerStyle = {
  position: "relative",
  zIndex: 1,
  background: "linear-gradient(135deg, rgba(255, 253, 244, 0.98), rgba(240, 248, 255, 0.94))",
  borderRadius: "28px",
  padding: "22px 28px",
  boxShadow: "0 18px 44px rgba(51, 65, 85, 0.12)",
  border: "1px solid rgba(148, 163, 184, 0.26)",
  borderTop: "5px solid rgba(43, 108, 176, 0.82)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  marginBottom: "18px",
};

const titleStyle = { margin: 0, fontSize: "30px", fontWeight: "900", color: "#1f5f8b", letterSpacing: "0.4px" };
const subtitleStyle = { margin: "8px 0 0", fontSize: "15px", color: "#64748b", fontWeight: "700" };
const headerRightStyle = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" };
const userTextStyle = { fontSize: "15px", color: "#334155", fontWeight: "700" };

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

const addPatientButtonStyle = {
  padding: "10px 16px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2f8f70, #22785d)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "900",
  cursor: "pointer",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  padding: "20px",
  background: "rgba(30, 41, 59, 0.46)",
  backdropFilter: "blur(5px)",
};

const addPatientModalStyle = {
  width: "min(620px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 40px)",
  overflow: "auto",
  padding: "24px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  borderRadius: "24px",
  background: "#fffdf6",
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)",
};

const addPatientModalHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "20px" };
const addPatientModalTitleStyle = { margin: 0, color: "#245b70", fontSize: "24px" };
const addPatientModalDescStyle = { margin: "7px 0 0", color: "#64748b", lineHeight: 1.5 };
const modalCloseButtonStyle = { width: "38px", height: "38px", border: 0, borderRadius: "50%", background: "#eef2f7", color: "#475569", fontSize: "24px", cursor: "pointer" };
const addPatientTwoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" };
const addPatientLabelStyle = { display: "grid", gap: "7px", marginBottom: "14px", color: "#475569", fontSize: "14px", fontWeight: "850" };
const addPatientInputStyle = { width: "100%", minHeight: "44px", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#fff", color: "#1e293b", fontSize: "15px" };
const addPatientFormErrorStyle = { marginTop: "4px", padding: "10px 12px", borderRadius: "12px", background: "#fff1f2", color: "#a12b3a", fontWeight: "800" };
const addPatientModalActionsStyle = { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" };
const cancelButtonStyle = { padding: "10px 16px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#fff", color: "#475569", fontWeight: "850", cursor: "pointer" };

const loadErrorStyle = {
  position: "relative",
  zIndex: 2,
  marginBottom: "16px",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  border: "1px solid #f4a6a6",
  borderRadius: "16px",
  background: "rgba(255, 241, 241, 0.97)",
  color: "#8f2929",
  boxShadow: "0 10px 22px rgba(127, 29, 29, 0.08)",
};

const loadErrorTextStyle = {
  display: "grid",
  gap: "3px",
};

const logoutButtonStyle = {
  padding: "10px 16px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#8b6f61",
  color: "white",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer",
};

const statsGridStyle = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(150px, 1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const statCardStyle = {
  background: "rgba(255, 253, 244, 0.96)",
  borderRadius: "22px",
  padding: "16px 18px",
  boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderLeft: "5px solid rgba(43, 108, 176, 0.42)",
};

const statCardDangerStyle = { border: "1px solid #fecaca", borderLeft: "5px solid #ef4444", background: "#fff8f8" };
const statTitleStyle = { margin: 0, color: "#64748b", fontSize: "14px", fontWeight: "800" };
const statValueStyle = { margin: "8px 0 4px", color: "#1f5f8b", fontSize: "30px" };
const statDescStyle = { margin: 0, color: "#7c5b2a", fontSize: "13px" };

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

const comparisonValidityStyle = (valid) => ({ display: "grid", gap: "4px", marginBottom: "12px", padding: "11px 13px", borderRadius: "13px", border: valid ? "1px solid #86efac" : "1px solid #fde68a", background: valid ? "#f0fdf4" : "#fffbeb", color: valid ? "#166534" : "#92400e", fontSize: "13px", lineHeight: 1.5 });

const analysisCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "24px", padding: "20px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const smallSectionTitleStyle = { margin: 0, fontSize: "20px", color: "#1f5f8b", fontWeight: "900" };
const trendOuterStyle = { width: "100%", marginTop: "14px" };
const trendWrapStyle = { width: "100%", marginTop: "10px", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", borderRadius: "18px" };
const trendLegendStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", color: "#475569", fontSize: "12px", fontWeight: 800 };
const trendLegendDotStyle = { width: "10px", height: "10px", borderRadius: "999px" };
const trendTypeTagStyle = { display: "inline-flex", alignItems: "center", padding: "4px 8px", border: "1px solid", borderRadius: "999px", background: "#ffffff", fontSize: "11px", fontWeight: 800 };
const trendSvgStyle = { width: "100%", height: "190px", background: "rgba(255, 255, 255, 0.82)", borderRadius: "18px", border: "1px solid rgba(148, 163, 184, 0.24)" };

const gameMiniTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "14px" };
const gameMiniTextStyle = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "5px", minHeight: "30px" };
const sectionHeaderRowStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };
const abilitySummaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginTop: "16px" };
const abilitySummaryCardStyle = { textAlign: "left", border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(255,255,255,.82)", borderRadius: "18px", padding: "14px", cursor: "pointer", transition: ".18s ease", color: "inherit" };
const activeAbilitySummaryCardStyle = { border: "1px solid rgba(31,95,139,.58)", background: "linear-gradient(145deg,#edf7ff,#fffdf5)", boxShadow: "0 10px 22px rgba(31,95,139,.13)", transform: "translateY(-1px)" };
const abilityCardHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const gameCodeBadgeStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "42px", padding: "4px 7px", borderRadius: "999px", background: "#e0f2fe", color: "#0369a1", fontSize: "11px", fontWeight: 900 };
const abilityPrimaryValueStyle = { display: "block", marginTop: "10px", color: "#1f5f8b", fontSize: "24px", fontWeight: 900 };
const abilityMetaStyle = { display: "block", marginTop: "5px", color: "#64748b", fontSize: "12px", fontWeight: 700 };
const abilityChangeStyle = { display: "block", marginTop: "8px", fontSize: "12px", fontWeight: 900 };
const trendSectionStyle = { marginTop: "20px", paddingTop: "18px", borderTop: "1px solid rgba(148,163,184,.24)" };
const trendHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" };
const trendTitleStyle = { margin: 0, color: "#1f5f8b", fontSize: "18px", fontWeight: 900 };
const trendSwitchStyle = { display: "flex", gap: "7px", flexWrap: "wrap", justifyContent: "flex-end" };

const compareCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "28px", padding: "20px", boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const compareSelectRowStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", alignItems: "center", marginBottom: "14px" };
const compareArrowStyle = { color: "#7c5b2a", fontWeight: "800" };
const compareResultStyle = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" };
const compareMetricStyle = { background: "rgba(255, 255, 255, 0.78)", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: "16px", padding: "13px" };
const compareMetricLabelStyle = { display: "block", color: "#64748b", fontSize: "12px" };
const compareMetricValueStyle = { display: "block", color: "#1f5f8b", fontSize: "15px", marginTop: "6px" };
const compareMetricDiffStyle = { display: "block", color: "#1f5f8b", fontSize: "12px", marginTop: "6px", fontWeight: "900" };

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
const tableWrapStyle = { overflowX: "auto", border: "1px solid rgba(148, 163, 184, 0.26)", borderRadius: "18px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1120px", fontSize: "14px", background: "rgba(255, 255, 255, 0.66)" };
const thStyle = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const trStyle = { borderBottom: "1px solid #eef2f7" };
const tdStyle = { padding: "13px 12px", color: "#334155", verticalAlign: "middle", whiteSpace: "nowrap" };
const tableButtonStyle = { border: "1px solid rgba(3, 105, 161, 0.16)", background: "#e0f2fe", color: "#0369a1", borderRadius: "10px", padding: "8px 12px", fontWeight: "800", cursor: "pointer" };
const activeTableButtonStyle = { background: "linear-gradient(180deg, #2b6cb0, #1f5f8b)", color: "white", border: "1px solid rgba(31, 95, 139, 0.32)" };
const recordActionBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "12px 14px", marginBottom: "14px", borderRadius: "14px", background: "linear-gradient(135deg,#f8fafc,#eef7ff)", border: "1px solid rgba(43,108,176,.20)", flexWrap: "wrap" };
const recordActionTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "14px", fontWeight: 900 };
const recordActionHintStyle = { display: "block", marginTop: "3px", color: "#64748b", fontSize: "12px", fontWeight: 700 };
const docxButtonStyle = { border: "none", borderRadius: "11px", background: "linear-gradient(180deg,#2b6cb0,#1f5f8b)", color: "#fff", padding: "10px 14px", fontSize: "13px", fontWeight: 900, cursor: "pointer" };
const tableActionGroupStyle = { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" };
const tableExportButtonStyle = { border: "1px solid rgba(22,163,74,.30)", borderRadius: "9px", background: "#f0fdf4", color: "#15803d", padding: "7px 9px", fontSize: "12px", fontWeight: 900, cursor: "pointer" };

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

const badgeStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 9px", borderRadius: "999px", fontSize: "12px", fontWeight: "800", whiteSpace: "nowrap" };
const testBadgeStyle = { background: "#dbeafe", color: "#1d4ed8" };
const trainingBadgeStyle = { background: "#dcfce7", color: "#15803d" };
const sessionBadgeStyle = { background: "#f1f5f9", color: "#475569" };
const safeBadgeStyle = { background: "#dcfce7", color: "#166534" };
const warningBadgeStyle = { background: "#fef3c7", color: "#92400e" };
const dangerBadgeStyle = { background: "#fee2e2", color: "#b91c1c" };
const emptyBadgeStyle = { background: "#f1f5f9", color: "#7c5b2a" };

const emptyBoxStyle = { position: "relative", zIndex: 1, background: "rgba(255, 253, 238, 0.94)", border: "4px solid rgba(255, 230, 139, 0.72)", borderRadius: "30px", padding: "34px", color: "#7c5b2a", textAlign: "center", boxShadow: "0 14px 34px rgba(91, 63, 26, 0.14)" };
const emptySmallTextStyle = { color: "#7c5b2a", margin: 0, fontSize: "14px" };
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
