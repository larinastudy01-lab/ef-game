import bgImg from "../asset/Home_background.png";
import assistIcon from "../asset/assist.png";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const RECORD_SOURCES = [
  { table: "game_results", fallbackType: "session" },
  { table: "test_results", fallbackType: "test" },
  { table: "training_results", fallbackType: "training" },
  { table: "game_sessions", fallbackType: "session" },
  { table: "srt_results", fallbackType: "test", gameKey: "SRT" },
  { table: "pm_results", fallbackType: "test", gameKey: "PM" },
  { table: "cbt_results", fallbackType: "test", gameKey: "CBT" },
  { table: "dpt_results", fallbackType: "test", gameKey: "DPT" },
  { table: "dccs_results", fallbackType: "test", gameKey: "DCCS" },
  { table: "lb_results", fallbackType: "test", gameKey: "LB" },
];

const GAME_NAME_MAP = {
  SRT: "松鼠接橡實",
  PM: "圖片記憶",
  CBT: "跳石橋",
  DPT: "拍蒼蠅",
  DCCS: "衣物分類",
  LB: "綿羊回家",
};

const ABILITY_BY_GAME = {
  SRT: "反應速度 / 抑制控制",
  PM: "工作記憶",
  CBT: "序列記憶 / 注意維持",
  DPT: "選擇性注意 / 抑制控制",
  DCCS: "認知彈性",
  LB: "排序能力 / 規則理解",
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
  { key: "srtTrainingResult", gameKey: "SRT", fallbackType: "training" },
  { key: "PM_RESULT", gameKey: "PM", fallbackType: "test" },
  { key: "pmTestResult", gameKey: "PM", fallbackType: "test" },
  { key: "pmTrainingResult", gameKey: "PM", fallbackType: "training" },
  { key: "CBT_RESULT", gameKey: "CBT", fallbackType: "test" },
  { key: "cbtTestResult", gameKey: "CBT", fallbackType: "test" },
  { key: "cbtTrainingResult", gameKey: "CBT", fallbackType: "training" },
  { key: "dptTestResult", gameKey: "DPT", fallbackType: "test" },
  { key: "dptTrainingResult", gameKey: "DPT", fallbackType: "training" },
  { key: "DPT_RESULT", gameKey: "DPT", fallbackType: "test" },
  { key: "DCCS_RESULT", gameKey: "DCCS", fallbackType: "test" },
  { key: "dccsTestResult", gameKey: "DCCS", fallbackType: "test" },
  { key: "dccsTrainingResult", gameKey: "DCCS", fallbackType: "training" },
  { key: "LB_RESULT", gameKey: "LB", fallbackType: "test" },
  { key: "lbTestResult", gameKey: "LB", fallbackType: "test" },
  { key: "lbTrainingResult", gameKey: "LB", fallbackType: "training" },
];

const LOCAL_PATIENT_KEYS = [
  "selectedPatientId",
  "selectedChildId",
  "currentPatientId",
  "currentChildId",
  "patientId",
  "childId",
];

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

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
  const candidates = [
    sourceGameKey,
    item.game_key,
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
  if (sourceText.includes("dpt")) return "DPT";
  if (sourceText.includes("lb")) return "LB";
  if (sourceText.includes("picture") || sourceText.includes("pm")) return "PM";

  const raw = firstDefined(...candidates, "未分類");
  return String(raw).toUpperCase();
}

function getTrialLogs(item = {}) {
  const summaryData = asObject(item.summary_data);
  const resultData = asObject(item.result_data);
  const clinicianMetrics = asObject(item.clinician_metrics);

  return firstArray(
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
    item.cbtHistory
  );
}


function getMetricsObjects(item = {}) {
  const summaryData = asObject(item.summary_data);
  const resultData = asObject(item.result_data);
  const scoringData = asObject(item.scoring_data);
  const clinicianMetricsData = asObject(item.clinician_metrics);
  const parentMetricsData = asObject(item.parent_metrics);
  const childViewData = asObject(item.child_view);

  const result = firstObject(
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
    item.summary,
    result.summary,
    item.summaryData,
    summaryData,
    resultData.summary,
    scoringData.summary
  );

  const clinician = firstObject(
    item.clinicianMetrics,
    result.clinicianMetrics,
    clinicianMetricsData,
    summaryData.clinicianMetrics,
    resultData.clinicianMetrics
  );

  const parent = firstObject(
    item.parentMetrics,
    result.parentMetrics,
    result.parentView,
    item.parentView,
    parentMetricsData,
    summaryData.parentMetrics,
    resultData.parentMetrics
  );

  const child = firstObject(
    item.childView,
    result.childView,
    childViewData,
    summaryData.childView,
    resultData.childView
  );

  return { result, summary, clinician, parent, child };
}


function readLocalResultPayloads(patientIds = []) {
  if (typeof window === "undefined") return [];

  const patientSet = new Set((patientIds || []).map(String));
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

  const storedPatientId = getStoredPatientId();
  const payloads = [];

  LOCAL_RESULT_KEYS.forEach((meta) => {
    [
      { storage: window.localStorage, source: "localStorage" },
      { storage: window.sessionStorage, source: "sessionStorage" },
    ].forEach(({ storage, source }) => {
      const raw = getStorageValue(storage, meta.key);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        list.forEach((item, index) => {
          if (!item || typeof item !== "object") return;
          const patientId = firstDefined(
            item.patient_id,
            item.patientId,
            item.child_id,
            item.childId,
            item.profile?.patient_id,
            item.profile?.patientId,
            item.config?.patient_id,
            item.config?.patientId,
            storedPatientId
          );

          if (patientSet.size > 0 && patientId && !patientSet.has(String(patientId))) return;

          payloads.push({
            ...item,
            id: item.id || `${meta.key}-${index}`,
            patient_id: patientId || storedPatientId || patientIds[0] || "",
            game_key: firstDefined(item.game_key, item.gameKey, meta.gameKey),
            record_type: firstDefined(item.record_type, item.mode, item.mode_type, meta.fallbackType),
            created_at: firstDefined(item.created_at, item.finished_at, item.completed_at, item.date, item.savedAt, new Date().toISOString()),
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

function ClinicianDashboard() {
  const navigate = useNavigate();

  const [clinicianId, setClinicianId] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reminderTemplate, setReminderTemplate] = useState("follow_up");
  const [reminderMessage, setReminderMessage] = useState("");
  const [noteText, setNoteText] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("請幫我摘要這位兒童近 30 天表現");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchClinicianAndPatients();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
      }
    });

    return () => {
      isMountedRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const fetchClinicianAndPatients = async () => {
    try {
      setLoading(true);

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
      if (accessError || patientIds.length === 0) {
        if (!isMountedRef.current) return;
        setClinicianId(user.id);
        setClinicianName(profileData.full_name || "醫療人員");
        setPatients([]);
        setRecords([]);
        setNotes([]);
        setSelectedPatientId("");
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

      if (!isMountedRef.current) return;

      if (patientResult.error) {
        console.warn("patients 讀取失敗，已清空前端列表：", patientResult.error.message);
        setPatients([]);
        setRecords([]);
        setNotes([]);
        setSelectedPatientId("");
        return;
      }

      const safePatients = patientResult.data || [];
      const allowedPatientIds = new Set(safePatients.map((patient) => String(patient.id)));
      const safeRecords = clinicalRecords.filter((record) => allowedPatientIds.has(String(record.patientId)));
      const safeNotes = clinicalNotes.filter((note) => allowedPatientIds.has(String(note.patient_id)));
      const firstId = selectedPatientId && allowedPatientIds.has(String(selectedPatientId))
        ? selectedPatientId
        : safePatients[0]?.id || "";

      setClinicianId(user.id);
      setClinicianName(profileData.full_name || "醫療人員");
      setPatients(safePatients);
      setRecords(safeRecords);
      setNotes(safeNotes);
      setSelectedPatientId(firstId);
    } catch (error) {
      console.error("fetchClinicianAndPatients 發生錯誤：", error);
    } finally {
      if (isMountedRef.current) setLoading(false);
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
          console.warn(`${source.table} 尚未建立、RLS 未授權或讀取失敗，先略過：`, error.message);
          return [];
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

    return dedupeRecords(allRecords).sort((a, b) => new Date(b.date) - new Date(a.date));
  };


  const dedupeRecords = (items) => {
    const seen = new Set();
    return items.filter((record) => {
      const key = [
        record.patientId,
        record.gameKey,
        record.type,
        record.rawId,
        record.date,
        record.score,
        record.accuracy,
      ].join("|");

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
      console.warn("clinician_notes 尚未建立或讀取失敗，先略過：", error.message);
      return [];
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
      item.created_at,
      item.finished_at,
      item.completed_at,
      item.updated_at,
      item.date,
      item.savedAt,
      item.timestamp,
      new Date().toISOString()
    );

    return {
      id: `${sourceTable}-${item.id || item.__localKey || `${gameKey}-${date}`}`,
      rawId: item.id || item.__localKey || "local",
      sourceTable: item.__localKey ? `${sourceTable}:${item.__localKey}` : sourceTable,
      patientId: firstDefined(item.patient_id, item.patientId, item.child_id, item.childId, item.config?.patientId, item.config?.patient_id, ""),
      type,
      gameKey,
      gameName: item.game_name || item.gameName || GAME_NAME_MAP[gameKey] || gameKey || "未分類",
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

  const cancelSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakClinicalSummary = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("此瀏覽器不支援語音朗讀功能。");
      return;
    }

    cancelSpeech();
    const utterance = new SpeechSynthesisUtterance(generateClinicalSummary());
    utterance.lang = "zh-TW";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  const closeAssistant = () => {
    cancelSpeech();
    setAssistantOpen(false);
  };

  const handleLogout = async () => {
    cancelSpeech();
    await supabase.auth.signOut();
    navigate(CLINICIAN_LOGIN_ROUTE, { replace: true });
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "-";

    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (today.getDate() < birth.getDate()) months--;
    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} 歲 ${months} 個月`;
  };

  const formatGender = (gender) => {
    if (!gender) return "未填寫";
    if (gender === "male") return "男";
    if (gender === "female") return "女";
    return gender;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
  };

  const daysSince = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
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

  const visibleRecords = useMemo(() => {
    if (recordTypeFilter === "all") return selectedPatientRecords;
    return selectedPatientRecords.filter((record) => record.type === recordTypeFilter);
  }, [selectedPatientRecords, recordTypeFilter]);

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
    const trend = buildTrendData(selectedPatientRecords);

    return {
      risk,
      lastRecord,
      averageAccuracy,
      averageRt,
      testCount: testRecords.length,
      trainingCount: trainingRecords.length,
      latestGameMap,
      trend,
    };
  }, [selectedPatient, selectedPatientRecords, testRecords, trainingRecords]);

  const todoItems = useMemo(() => {
    const items = [];

    patientCards.forEach(({ patient, records: patientRecords, risk }) => {
      const name = patient.nickname || patient.full_name || "未命名兒童";
      const lastRecord = patientRecords[0] || null;
      const recentRecords = patientRecords.filter((record) => (daysSince(record.date) ?? 999) <= 7);

      if (!lastRecord) {
        items.push({ tone: "danger", text: `${name} 尚無任何測驗 / 訓練資料，建議安排初次評估。` });
      } else if (risk.key === "danger") {
        items.push({ tone: "danger", text: `${name} 已超過 21 天沒有新資料，建議提醒回診或檢查。` });
      } else if (risk.key === "warning") {
        items.push({ tone: "warning", text: `${name} 需要追蹤，建議提醒家長本週補做訓練或測驗。` });
      }

      if (recentRecords.length > 0) {
        items.push({ tone: "safe", text: `${name} 近 7 天有 ${recentRecords.length} 筆新資料可查看。` });
      }
    });

    return items.slice(0, 8);
  }, [patientCards]);

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
  }, [selectedPatientId, reminderTemplate]);

  useEffect(() => {
    setCompareAId(testRecords[1]?.id || testRecords[0]?.id || "");
    setCompareBId(testRecords[0]?.id || "");
  }, [selectedPatientId, testRecords.length]);

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

  function buildTrendData(patientRecords) {
    return [...patientRecords]
      .reverse()
      .slice(-8)
      .map((record) => ({
        label: formatShortDate(record.date),
        accuracy: Number(record.accuracy || 0),
        rt: Number(record.avgRt || 0),
        game: record.gameName,
      }));
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
      message,
      status: "pending",
    });

    if (error) {
      alert("提醒內容已產生，但 parent_reminders 資料表尚未建立或無法寫入。可以先複製提醒文字給家長。\n\n" + message);
      return;
    }

    alert("已建立家長提醒。提醒內容：\n\n" + message);
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
      const localNote = {
        ...notePayload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [localNote, ...prev]);
      setNoteText("");
      alert("備註已暫時顯示在畫面上，但 clinician_notes 資料表尚未建立或無法寫入。請之後補上資料表。 ");
      return;
    }

    setNotes((prev) => [data, ...prev]);
    setNoteText("");
  };

  const generateClinicalSummary = () => {
    if (!selectedPatient || !patientSummary) return "目前尚未選擇個案。";

    const name = selectedPatient.nickname || selectedPatient.full_name || "此兒童";
    const last = patientSummary.lastRecord;
    const risk = patientSummary.risk;
    const accuracy = patientSummary.averageAccuracy;
    const rt = patientSummary.averageRt;
    const latestText = last
      ? `最近一次資料為 ${formatDate(last.date)} 的「${last.gameName}」，正確率 ${last.accuracy}%，平均反應時間 ${last.avgRt || "-"} ms。`
      : "目前尚無測驗或訓練資料。";

    return `${name} 目前風險分級為「${risk.label}」。${latestText} 目前共有 ${patientSummary.testCount} 筆測驗與 ${patientSummary.trainingCount} 筆訓練資料，整體平均正確率約 ${accuracy}%，平均反應時間約 ${rt || "-"} ms。建議後續可優先觀察反應時間是否穩定、錯誤率是否下降，以及訓練完成率是否持續。`;
  };

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
          <button onClick={fetchClinicianAndPatients} style={refreshButtonStyle}>重新整理</button>
          <button onClick={handleLogout} style={logoutButtonStyle}>登出</button>
        </div>
      </header>

      <section className="clinician-dashboard-stats" style={statsGridStyle}>
        <StatCard title="授權病患" value={dashboardStats.patientCount} desc="目前可查看的兒童個案" />
        <StatCard title="測驗紀錄" value={dashboardStats.totalTests} desc="正式測驗資料筆數" />
        <StatCard title="訓練紀錄" value={dashboardStats.totalTraining} desc="訓練歷程資料筆數" />
        <StatCard title="近 7 天新資料" value={dashboardStats.newRecords} desc="待醫療人員查看" />
        <StatCard title="需要處理" value={dashboardStats.needFollowUp} desc="需要提醒或追蹤" danger />
      </section>

      {loading ? (
        <div style={emptyBoxStyle}>載入醫療端資料中...</div>
      ) : patients.length === 0 ? (
        <div style={emptyBoxStyle}>目前尚未連結任何病患資料</div>
      ) : (
        <div className="clinician-dashboard-layout" style={layoutStyle}>
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
                      setSelectedRecord(null);
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

                <section className="clinician-dashboard-top-grid" style={topGridStyle}>
                  <div style={analysisCardStyle}>
                    <h3 style={smallSectionTitleStyle}>能力趨勢圖</h3>
                    <p style={panelDescStyle}>顯示近期 8 筆資料的正確率變化。</p>
                    <TrendChart data={patientSummary.trend} />
                  </div>

                  <div style={analysisCardStyle}>
                    <h3 style={smallSectionTitleStyle}>各遊戲最近表現</h3>
                    <div className="clinician-dashboard-game-grid" style={gameGridStyle}>
                      {Object.keys(GAME_NAME_MAP).map((gameKey) => {
                        const record = patientSummary.latestGameMap[gameKey];
                        return (
                          <div key={gameKey} style={gameMiniCardStyle}>
                            <strong style={gameMiniTitleStyle}>{GAME_NAME_MAP[gameKey]}</strong>
                            <span style={gameMiniTextStyle}>{ABILITY_BY_GAME[gameKey]}</span>
                            <span style={gameMiniValueStyle}>{record ? `${record.accuracy}%` : "尚無資料"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

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
                    <div style={filterGroupStyle}>
                      <button onClick={() => setRecordTypeFilter("all")} style={pillButtonStyle(recordTypeFilter === "all")}>全部</button>
                      <button onClick={() => setRecordTypeFilter("test")} style={pillButtonStyle(recordTypeFilter === "test")}>測驗</button>
                      <button onClick={() => setRecordTypeFilter("training")} style={pillButtonStyle(recordTypeFilter === "training")}>訓練</button>
                    </div>
                  </div>

                  <div className="clinician-dashboard-table-wrap" style={tableWrapStyle}>
                    <table className="clinician-dashboard-table" style={tableStyle}>
                      <thead>
                        <tr>
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
                      <tbody>
                        {visibleRecords.map((record) => (
                          <tr key={record.id} style={trStyle}>
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
                            <td style={tdStyle}><button onClick={() => setSelectedRecord(record)} style={tableButtonStyle}>查看</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleRecords.length === 0 && <div style={emptyTableStyle}>目前沒有符合條件的資料</div>}
                  </div>
                </section>

                {selectedRecord && (
                  <section style={recordDetailCardStyle}>
                    <div className="clinician-dashboard-section-header" style={recordsHeaderStyle}>
                      <h3 style={smallSectionTitleStyle}>單筆紀錄詳細內容</h3>
                      <button onClick={() => setSelectedRecord(null)} style={closeButtonStyle}>關閉</button>
                    </div>
                    <div className="clinician-dashboard-detail-grid" style={recordDetailGridStyle}>
                      <InfoItem label="資料來源" value={selectedRecord.sourceTable} />
                      <InfoItem label="遊戲" value={selectedRecord.gameName} />
                      <InfoItem label="能力" value={selectedRecord.ability} />
                      <InfoItem label="類型" value={selectedRecord.type === "test" ? "測驗" : selectedRecord.type === "training" ? "訓練" : "紀錄"} />
                      <InfoItem label="建立時間" value={formatDate(selectedRecord.date)} />
                      <InfoItem label="分數" value={selectedRecord.score || "-"} />
                      <InfoItem label="星級" value={selectedRecord.stars > 0 ? `${selectedRecord.stars} 星` : "-"} />
                      <InfoItem label="正確率" value={`${selectedRecord.accuracy}%`} />
                      <InfoItem label="錯誤次數" value={selectedRecord.errors} />
                      <InfoItem label="平均反應時間" value={`${selectedRecord.avgRt || "-"} ms`} />
                    </div>
                    <pre style={jsonBoxStyle}>{JSON.stringify(selectedRecord.trials || selectedRecord.raw, null, 2)}</pre>
                  </section>
                )}
              </>
            )}
          </main>

          <aside className="clinician-dashboard-right" style={rightPanelStyle}>
            <section style={todoCardStyle}>
              <h3 style={smallSectionTitleStyle}>今日待處理</h3>
              <div style={todoListStyle}>
                {todoItems.length === 0 ? (
                  <p style={emptySmallTextStyle}>目前沒有急需處理的事項。</p>
                ) : (
                  todoItems.map((item, index) => (
                    <div key={`${item.text}-${index}`} style={todoItemStyle}>
                      <span style={todoDotStyle(item.tone)} />
                      <p style={todoTextStyle}>{item.text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

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
                rows={4}
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

            <section style={reportCardStyle}>
              <h3 style={smallSectionTitleStyle}>個案報告摘要</h3>
              <pre style={reportBoxStyle}>{generateReportText()}</pre>
              <button
                onClick={() => navigator.clipboard?.writeText(generateReportText())}
                style={secondaryButtonStyle}
              >
                複製報告摘要
              </button>
            </section>
          </aside>
        </div>
      )}

      <button className="clinician-dashboard-assistant-button" onClick={() => setAssistantOpen(true)} style={assistantButtonStyle} aria-label="AI 小助手">
        <img src={assistIcon} alt="AI 小助手" style={assistantIconStyle} />
      </button>

      {assistantOpen && (
        <div className="clinician-dashboard-assistant-mask" style={assistantMaskStyle} onClick={closeAssistant}>
          <div className="clinician-dashboard-assistant-panel" style={assistantPanelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={assistantHeaderStyle}>
              <div style={assistantTitleWrapStyle}>
                <img src={assistIcon} alt="AI 小助手" style={assistantPanelIconStyle} />
                <div>
                  <h3 style={assistantTitleStyle}>AI 臨床摘要助手</h3>
                  <p style={assistantDescStyle}>協助摘要、比較與產生家長說明</p>
                </div>
              </div>
              <button onClick={closeAssistant} style={closeButtonStyle}>關閉</button>
            </div>

            <div style={assistantQuickRowStyle}>
              <button onClick={() => setAssistantQuestion("請幫我摘要這位兒童近 30 天表現")} style={assistantChipStyle}>近 30 天摘要</button>
              <button onClick={() => setAssistantQuestion("請比較這兩次測驗變化")} style={assistantChipStyle}>比較兩次測驗</button>
              <button onClick={() => setAssistantQuestion("請產生給家長的說明文字")} style={assistantChipStyle}>家長說明</button>
            </div>

            <textarea
              value={assistantQuestion}
              onChange={(event) => setAssistantQuestion(event.target.value)}
              style={assistantTextareaStyle}
              rows={3}
            />

            <div style={assistantAnswerStyle}>
              <strong>AI 摘要建議</strong>
              <p>{generateClinicalSummary()}</p>
              {compareA && compareB && testRecords.length >= 2 && (
                <p>{buildCompareSentence(compareA, compareB)}</p>
              )}
              <p>後續可搭配醫療備註與家長提醒，形成完整追蹤紀錄。</p>
              <div style={assistantSpeechRowStyle}>
                <button onClick={speakClinicalSummary} style={assistantSmallButtonStyle}>朗讀摘要</button>
                <button onClick={cancelSpeech} style={assistantSmallButtonStyle}>停止朗讀</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildCompareSentence(a, b) {
  if (!a || !b || a.id === b.id) return "請選擇兩筆不同測驗資料進行比較。";
  const accuracyDiff = Number(b.accuracy || 0) - Number(a.accuracy || 0);
  const rtDiff = Number(b.avgRt || 0) - Number(a.avgRt || 0);
  const accuracyText = accuracyDiff >= 0 ? `正確率提升 ${accuracyDiff}%` : `正確率下降 ${Math.abs(accuracyDiff)}%`;
  const rtText = rtDiff <= 0 ? `反應時間縮短 ${Math.abs(rtDiff)} ms` : `反應時間增加 ${rtDiff} ms`;
  return `兩次測驗比較：${accuracyText}，${rtText}。`;
}

function StatCard({ title, value, desc, danger }) {
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
  return (
    <div style={infoItemStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value || "-"}</strong>
    </div>
  );
}

function TrendChart({ data }) {
  const width = 520;
  const height = 170;
  const padding = 24;

  if (!data || data.length === 0) {
    return <div style={emptySmallBoxStyle}>尚無足夠資料產生趨勢圖</div>;
  }

  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - (Number(item.accuracy || 0) / 100) * (height - padding * 2);
    return { x, y, item };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div style={trendWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} style={trendSvgStyle}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />
        <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${point.x}-${index}`}>
            <circle cx={point.x} cy={point.y} r="6" fill="#2563eb" />
            <text x={point.x} y={height - 4} fontSize="12" textAnchor="middle" fill="#64748b">{point.item.label}</text>
            <text x={point.x} y={point.y - 10} fontSize="12" textAnchor="middle" fill="#1e293b">{point.item.accuracy}%</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CompareResult({ a, b }) {
  if (!a || !b) return null;

  const rows = [
    { label: "正確率", a: `${a.accuracy}%`, b: `${b.accuracy}%`, diff: `${Number(b.accuracy || 0) - Number(a.accuracy || 0)}%` },
    { label: "平均反應時間", a: `${a.avgRt || "-"} ms`, b: `${b.avgRt || "-"} ms`, diff: `${Number(b.avgRt || 0) - Number(a.avgRt || 0)} ms` },
    { label: "錯誤次數", a: a.errors, b: b.errors, diff: Number(b.errors || 0) - Number(a.errors || 0) },
    { label: "星級", a: `${a.stars || 0} 星`, b: `${b.stars || 0} 星`, diff: `${Number(b.stars || 0) - Number(a.stars || 0)} 星` },
  ];

  return (
    <div className="clinician-dashboard-compare-result" style={compareResultStyle}>
      {rows.map((row) => (
        <div key={row.label} style={compareMetricStyle}>
          <span style={compareMetricLabelStyle}>{row.label}</span>
          <strong style={compareMetricValueStyle}>{row.a} → {row.b}</strong>
          <span style={compareMetricDiffStyle}>變化：{row.diff}</span>
        </div>
      ))}
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
const rightPanelStyle = { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 };
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

const topGridStyle = { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px" };
const analysisCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "24px", padding: "20px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const smallSectionTitleStyle = { margin: 0, fontSize: "20px", color: "#1f5f8b", fontWeight: "900" };
const trendWrapStyle = { width: "100%", marginTop: "16px", overflow: "hidden" };
const trendSvgStyle = { width: "100%", height: "190px", background: "rgba(255, 255, 255, 0.82)", borderRadius: "18px", border: "1px solid rgba(148, 163, 184, 0.24)" };

const gameGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "16px" };
const gameMiniCardStyle = { border: "1px solid rgba(148, 163, 184, 0.24)", background: "rgba(255, 255, 255, 0.78)", borderRadius: "16px", padding: "12px" };
const gameMiniTitleStyle = { display: "block", color: "#1f5f8b", fontSize: "14px" };
const gameMiniTextStyle = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "5px", minHeight: "30px" };
const gameMiniValueStyle = { display: "block", color: "#1f5f8b", fontWeight: "900", marginTop: "8px" };

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
const filterGroupStyle = { display: "flex", gap: "8px", flexWrap: "wrap" };
const tableWrapStyle = { overflowX: "auto", border: "1px solid rgba(148, 163, 184, 0.26)", borderRadius: "18px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1120px", fontSize: "14px", background: "rgba(255, 255, 255, 0.66)" };
const thStyle = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const trStyle = { borderBottom: "1px solid #eef2f7" };
const tdStyle = { padding: "13px 12px", color: "#334155", verticalAlign: "middle", whiteSpace: "nowrap" };
const tableButtonStyle = { border: "1px solid rgba(3, 105, 161, 0.16)", background: "#e0f2fe", color: "#0369a1", borderRadius: "10px", padding: "8px 12px", fontWeight: "800", cursor: "pointer" };
const emptyTableStyle = { padding: "22px", color: "#7c5b2a", textAlign: "center" };

const recordDetailCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "28px", padding: "20px", boxShadow: "0 18px 38px rgba(51, 65, 85, 0.11)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(43, 108, 176, 0.52)" };
const recordDetailGridStyle = { display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: "12px", marginBottom: "16px" };
const infoItemStyle = { background: "rgba(255, 255, 255, 0.78)", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: "16px", padding: "13px" };
const infoLabelStyle = { display: "block", color: "#64748b", fontSize: "12px", marginBottom: "6px" };
const infoValueStyle = { color: "#1f5f8b", fontSize: "14px" };
const closeButtonStyle = { border: "2px solid #f7d774", background: "white", color: "#334155", borderRadius: "12px", padding: "9px 14px", fontWeight: "800", cursor: "pointer" };
const jsonBoxStyle = { background: "#0f172a", color: "#e2e8f0", borderRadius: "18px", padding: "16px", overflow: "auto", maxHeight: "360px", fontSize: "12px", lineHeight: 1.6 };

const todoCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "24px", padding: "18px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)",
  border: "1px solid rgba(148, 163, 184, 0.22)", borderTop: "4px solid rgba(247, 210, 94, 0.70)" };
const todoListStyle = { display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" };
const todoItemStyle = { display: "grid", gridTemplateColumns: "10px 1fr", gap: "10px", alignItems: "start" };
const todoDotStyle = (tone) => ({ width: "9px", height: "9px", borderRadius: "999px", marginTop: "7px", background: tone === "danger" ? "#ef4444" : tone === "warning" ? "#f59e0b" : "#22c55e" });
const todoTextStyle = { margin: 0, color: "#475569", fontSize: "14px", lineHeight: 1.6 };

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
const assistantMaskStyle = { position: "fixed", inset: 0, zIndex: 30, background: "rgba(63, 47, 31, 0.32)", display: "flex", alignItems: "flex-end", justifyContent: "flex-start", padding: "28px" };
const assistantPanelStyle = { width: "460px", maxWidth: "calc(100vw - 56px)", background: "rgba(255, 253, 238, 0.98)", borderRadius: "30px", padding: "20px", boxShadow: "0 24px 60px rgba(63, 47, 31, 0.28)", border: "5px solid #ffe07a" };
const assistantHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "14px" };
const assistantTitleWrapStyle = { display: "flex", alignItems: "center", gap: "12px" };
const assistantPanelIconStyle = { width: "54px", height: "54px", objectFit: "contain" };
const assistantTitleStyle = { margin: 0, color: "#2b6cb0", fontSize: "20px", fontWeight: "900" };
const assistantDescStyle = { margin: "4px 0 0", color: "#7c5b2a", fontSize: "13px", fontWeight: "700" };
const assistantQuickRowStyle = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" };
const assistantChipStyle = { border: "2px solid #f7c948", background: "#fff7c2", color: "#7c4a03", borderRadius: "999px", padding: "8px 11px", cursor: "pointer", fontWeight: "800", fontSize: "12px" };
const assistantTextareaStyle = { width: "100%", boxSizing: "border-box", border: "2px solid #f7d774", borderRadius: "16px", padding: "12px", fontSize: "14px", outline: "none", resize: "vertical", color: "#334155", lineHeight: 1.6 };
const assistantAnswerStyle = { marginTop: "12px", background: "#fffaf0", border: "2px solid #f7d774", borderRadius: "18px", padding: "14px", color: "#334155", lineHeight: 1.7, fontSize: "14px" };
const assistantSpeechRowStyle = { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" };
const assistantSmallButtonStyle = { border: "1px solid rgba(43, 108, 176, 0.28)", background: "#eef7ff", color: "#1f5f8b", borderRadius: "12px", padding: "8px 12px", fontWeight: "800", cursor: "pointer" };

export default ClinicianDashboard;



