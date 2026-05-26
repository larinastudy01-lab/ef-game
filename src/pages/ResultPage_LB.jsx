// src/pages/ResultPage_LB.jsx

import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import calculateLBScore from "../utils/lbScoring";
import "../styles/GamePage_LB.css";

import backgroundImg from "../asset/LB/background.png";
import sheepImg from "../asset/LB/sheep.png";
import homeImg from "../asset/LB/home.png";

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
const TEST_ROUTE = "/test-lb";
const TRAINING_ROUTE = "/training-lb";
const SESSION_KEY = "LB_RESULT";
const CLICK_SOUND_SRC = "/sounds/click.mp3";

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

  const clinician = result?.clinicianMetrics || {};
  const parentMetrics = result?.parentMetrics || {};

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

  return (
    <div
      className="lb-page lb-page-with-bg lb-result-page"
      style={{ "--lb-bg-image": `url(${backgroundImg})` }}
    >
      <main className="lb-result-card">
        <header className="lb-result-header">
          <div className="lb-result-title-block">
            <h1>小羊的氣球路線完成了</h1>
          </div>

          <div className="lb-result-header-visual">
            <img
              src={sheepImg}
              alt="小羊"
              className="lb-result-header-sheep"
              draggable="false"
            />
            <img
              src={homeImg}
              alt="家"
              className="lb-result-header-home"
              draggable="false"
            />
          </div>
        </header>

        <section className="lb-result-meta-row">
          <MetaPill label="完成題數" value={`${completedTrials}/${totalTrials}`} />
          <MetaPill label="結束原因" value={finishReason} />
          <MetaPill
            label="資料來源"
            value={trialLogs.length > 0 ? "已接收逐題紀錄" : "尚無逐題紀錄"}
          />
        </section>

        <ParentView
          result={result}
          clinician={clinician}
          parentMetrics={parentMetrics}
        />

        <footer className="lb-result-bottom-row">
          <button
            type="button"
            className="lb-start-button lb-secondary-button"
            onClick={() => handleNavigate(MENU_ROUTE)}
          >
            返回主頁
          </button>

          <button
            type="button"
            className="lb-start-button lb-dark-button"
            onClick={() => handleNavigate(TRAINING_ROUTE)}
          >
            去練習
          </button>

          <button
            type="button"
            className="lb-start-button"
            onClick={() => handleNavigate(TEST_ROUTE, { clearCache: true })}
          >
            再測一次
          </button>
        </footer>
      </main>
    </div>
  );
}

function ParentView({ result, clinician, parentMetrics }) {
  const summaryCards = getParentSummaryCards(clinician, parentMetrics);

  return (
    <section className="lb-result-parent-grid">
      <div className="lb-result-card-section">
        <h2>能力雷達圖</h2>

        <RadarChart
          data={[
            {
              label: "規則理解",
              value: safeNumber(parentMetrics.ruleUnderstanding, 0),
            },
            {
              label: "規則切換",
              value: safeNumber(parentMetrics.cognitiveFlexibility, 0),
            },
            {
              label: "反應速度",
              value: safeNumber(parentMetrics.processingSpeed, 0),
            },
            {
              label: "穩定度",
              value: safeNumber(parentMetrics.attentionStability, 0),
            },
            {
              label: "抗干擾",
              value: safeNumber(parentMetrics.interferenceControl, 0),
            },
          ]}
        />

        <p className="lb-result-chart-note">
          分數越靠外圈代表表現越穩定。此圖建議搭配下方文字，不單獨作為診斷依據。
        </p>
      </div>

      <div className="lb-result-card-section">
        <h2>家長摘要</h2>

        <p className="lb-result-parent-summary">
          {result?.parentSummary || "目前資料不足，建議重新測驗一次。"}
        </p>

        <div className="lb-result-ability-list">
          {summaryCards.map((item) => (
            <AbilityBar
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))}
        </div>

        <div className="lb-result-suggestion-box">
          <strong>練習建議：</strong>
          <span>{getParentSuggestion(result, clinician)}</span>
        </div>
      </div>
    </section>
  );
}

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
