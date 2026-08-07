// src/pages/ResultPage_SRT.jsx

import React, { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT/SRT_background.webp";
import homeBackBtn from "../asset/SRT/back.webp";
import homeAgainBtn from "../asset/SRT/again.webp";
import {
  calculateSrtScore,
  getStoredSrtResult,
} from "../utils/srtScoring";

const HAT_GAME_ROUTE = "/hat-sticker-game";
const HAT_REWARD_MIN_COMPLETIONS = 5;
const HAT_REWARD_MAX_COMPLETIONS = 8;

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function randomHatRewardInterval() {
  return (
    Math.floor(
      Math.random() *
        (HAT_REWARD_MAX_COMPLETIONS - HAT_REWARD_MIN_COMPLETIONS + 1)
    ) + HAT_REWARD_MIN_COMPLETIONS
  );
}

function resolveResultChildId(summaryData = {}) {
  const directChildId =
    summaryData?.childId ||
    summaryData?.child?.id ||
    summaryData?.currentChild?.id;

  if (directChildId) return String(directChildId);

  const idKeys = [
    "currentChildId",
    "selectedChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of idKeys) {
    const value = localStorage.getItem(key);
    if (value && value !== "null" && value !== "undefined") {
      return String(value);
    }
  }

  const objectKeys = ["currentChild", "selectedChild", "activeChild"];

  for (const key of objectKeys) {
    const parsed = safeJsonParse(localStorage.getItem(key), null);
    if (parsed?.childId || parsed?.id) {
      return String(parsed.childId || parsed.id);
    }
  }

  return "unassigned";
}

function evaluateHatReward({ childId, resultToken }) {
  const storageKey = `hatRewardSchedule_${childId}`;
  const stored = safeJsonParse(localStorage.getItem(storageKey), {});
  const processedTokens = Array.isArray(stored?.processedTokens)
    ? stored.processedTokens
    : [];

  if (processedTokens.includes(resultToken)) {
    return { shouldOpenHatGame: false, alreadyProcessed: true };
  }

  const currentRemaining = Number.isFinite(Number(stored?.remaining))
    ? Math.max(1, Number(stored.remaining))
    : randomHatRewardInterval();

  const nextRemaining = currentRemaining - 1;
  const shouldOpenHatGame = nextRemaining <= 0;
  const nextProcessedTokens = [...processedTokens, resultToken].slice(-30);

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      remaining: shouldOpenHatGame
        ? randomHatRewardInterval()
        : nextRemaining,
      processedTokens: nextProcessedTokens,
      lastCompletedAt: new Date().toISOString(),
      lastTriggeredAt: shouldOpenHatGame
        ? new Date().toISOString()
        : stored?.lastTriggeredAt || null,
    })
  );

  return { shouldOpenHatGame, alreadyProcessed: false };
}

const ResultPage_SRT = ({
  mode = "test",
  score = 0,
  avgRT = 0,
  rtRecords = [],
  trialRecords = [],
  totalSpawn = 0,
  missCount = 0,
  summaryData = {},
  starResult = null,
  scoring: providedScoring = null,
  aiAnalysis: providedAiAnalysis = null,
  recommendation: providedRecommendation = null,
  parentSummary: providedParentSummary = "",
  clinicianSummary: providedClinicianSummary = "",
  onRestart,
  onBackToMenu,
}) => {
  const navigate = useNavigate();
  const backActionLockedRef = useRef(false);
  const rewardResultTokenRef = useRef(null);

  const normalizedRecords = useMemo(() => {
    if (Array.isArray(trialRecords) && trialRecords.length > 0) {
      return trialRecords.map((record, index) => {
        const normalizedAction =
          record.trainingAction === "correctReject"
            ? "correctAvoid"
            : record.trainingAction === "falseAlarm"
            ? "clickedRotten"
            : record.trainingAction || null;

        const inferredCorrect =
          normalizedAction === "hit" || normalizedAction === "correctAvoid";

        return {
        trialIndex: record.trialIndex ?? record.trial ?? index + 1,
        isCorrect:
          record.isCorrect !== undefined
            ? record.isCorrect
            : inferredCorrect || record.hit === true,
        reactionTime:
          typeof record.reactionTime === "number"
            ? record.reactionTime
            : null,
        timeout: record.timeout === true,
        missed:
          record.missed === true ||
          record.miss === true ||
          record.timeout === true,
        falseClick: record.falseClick === true,
        clickedRotten:
          record.clickedRotten === true || normalizedAction === "clickedRotten",
        trainingAction: normalizedAction,
        targetType: record.targetType || "normal",
        assisted: record.assisted === true,
        assistType: record.assistType || null,
        assistShownAt:
          typeof record.assistShownAt === "number" ? record.assistShownAt : null,
        reactionAfterAssist:
          typeof record.reactionAfterAssist === "number"
            ? record.reactionAfterAssist
            : null,
        segment: record.segment || null,
        falseClickType: record.falseClickType || null,
        positionX: record.positionX ?? null,
        positionY: record.positionY ?? null,
        timestamp: record.timestamp || null,
      };
      });
    }

    if (Array.isArray(rtRecords) && rtRecords.length > 0) {
      return rtRecords.map((reactionTime, index) => ({
        trialIndex: index + 1,
        isCorrect: Number.isFinite(Number(reactionTime)),
        reactionTime: Number.isFinite(Number(reactionTime)) ? Number(reactionTime) : null,
        timeout: false,
        missed: false,
        falseClick: false,
        clickedRotten: false,
        targetType: "normal",
        assisted: false,
        assistType: null,
        assistShownAt: null,
        reactionAfterAssist: null,
        segment: null,
        falseClickType: null,
      }));
    }

    return [];
  }, [trialRecords, rtRecords]);

  const scoringResult = useMemo(() => {
    if (providedScoring?.summary && providedScoring?.childView) {
      return providedScoring;
    }

    if (normalizedRecords.length > 0) {
      return calculateSrtScore(normalizedRecords);
    }

    const stored = getStoredSrtResult();

    if (stored?.scoring) return stored.scoring;
    if (stored?.summary && stored?.childView) return stored;

    return calculateSrtScore([]);
  }, [normalizedRecords, providedScoring]);

  const summary = useMemo(() => scoringResult?.summary || {}, [scoringResult]);
  const childView = scoringResult?.childView || {};
  const parentView = scoringResult?.parentView || {};

  const isTrainingMode = mode === "training" || summaryData?.mode === "training";

  const resolvedTrainingData = useMemo(() => {
    const embeddedAnalysis = summaryData?.aiAnalysis || {};
    const analysis = providedAiAnalysis || embeddedAnalysis;
    const metrics = analysis?.metrics || {};
    const segmentAnalysis =
      analysis?.segmentAnalysis ||
      analysis?.longAttentionMetrics ||
      summaryData?.longAttentionMetrics ||
      {};
    const recommendation =
      providedRecommendation ||
      analysis?.recommendation ||
      summaryData?.recommendation ||
      summaryData?.aiRecommendation ||
      null;

    return {
      ...summaryData,
      mode: isTrainingMode ? "training" : summaryData?.mode,
      scoring: providedScoring || summaryData?.scoring || null,
      aiAnalysis: analysis,
      recommendation,
      aiRecommendation: recommendation || summaryData?.aiRecommendation || null,
      parentSummary:
        providedParentSummary ||
        analysis?.parentSummary ||
        summaryData?.parentSummary ||
        "",
      clinicianSummary:
        providedClinicianSummary ||
        analysis?.clinicianSummary ||
        summaryData?.clinicianSummary ||
        "",
      recommendedDifficulty:
        recommendation?.nextDifficulty ||
        analysis?.nextDifficulty ||
        summaryData?.recommendedDifficulty,
      nextDifficulty:
        recommendation?.nextDifficulty ||
        analysis?.nextDifficulty ||
        summaryData?.nextDifficulty,
      accuracy:
        metrics?.accuracy ??
        summaryData?.accuracy ??
        scoringResult?.summary?.accuracyPercent ??
        0,
      avgRT:
        metrics?.avgRT ??
        summaryData?.avgRT ??
        scoringResult?.summary?.avgReactionTime ??
        avgRT,
      hitCount:
        metrics?.hitCount ??
        summaryData?.hitCount ??
        scoringResult?.summary?.correctCount ??
        0,
      missCount:
        metrics?.missCount ??
        summaryData?.missCount ??
        scoringResult?.summary?.missedCount ??
        0,
      correctAvoidCount:
        metrics?.correctAvoidCount ??
        summaryData?.correctAvoidCount ??
        summaryData?.correctRejectCount ??
        scoringResult?.summary?.rottenAvoidedCount ??
        0,
      clickedRottenCount:
        metrics?.clickedRottenCount ??
        summaryData?.clickedRottenCount ??
        summaryData?.falseAlarmCount ??
        scoringResult?.summary?.clickedRottenCount ??
        0,
      assistedRate:
        metrics?.assistedRate ??
        summaryData?.assistedRate ??
        scoringResult?.summary?.assistedRate ??
        0,
      rtCV:
        metrics?.rtCV ??
        summaryData?.rtCV ??
        scoringResult?.summary?.rtCV ??
        0,
      rtStd:
        metrics?.rtStd ??
        summaryData?.rtStd ??
        scoringResult?.summary?.rtStd ??
        0,
      attentionDrop:
        segmentAnalysis?.attentionDrop ??
        summaryData?.attentionDrop ??
        scoringResult?.summary?.attentionDrop ??
        0,
      fatigueLevel:
        analysis?.fatigueLevel || summaryData?.fatigueLevel || "low",
      attentionLevel:
        analysis?.attentionLevel || summaryData?.attentionLevel || "stable",
      impulseLevel:
        analysis?.impulseLevel || summaryData?.impulseLevel || "low",
      assistedNeed:
        analysis?.assistedNeed || summaryData?.assistedNeed || "low",
      longAttentionMetrics: segmentAnalysis,
    };
  }, [
    summaryData,
    providedAiAnalysis,
    providedRecommendation,
    providedParentSummary,
    providedClinicianSummary,
    providedScoring,
    scoringResult,
    isTrainingMode,
    avgRT,
  ]);

  const stars = Math.max(
    0,
    Math.min(
      3,
      Number(
        (isTrainingMode ? providedScoring?.stars : childView.stars) ||
          scoringResult?.stars ||
          starResult?.stars ||
          starResult?.star ||
          1
      ) || 1
    )
  );

  const totalScore = scoringResult?.totalScore ?? starResult?.totalScore ?? 0;

  const displayScore = isTrainingMode
    ? resolvedTrainingData?.finalScore ?? score
    : totalScore;

  const childShortLabel = isTrainingMode
    ? getTrainingChildLabel(resolvedTrainingData?.finalScore ?? score)
    : childView.shortLabel || starResult?.level || "繼續加油";

  const abilityScores = sanitizeAbilityScores(parentView?.abilityScores, summary);

  const resultPlainSummary = isTrainingMode
    ? buildDetailedTrainingParentSummary(resolvedTrainingData)
    : parentView?.plainLanguageSummary ||
      buildTestParentSummary({ stars, summary, abilityScores });

  const oneSentenceResult = isTrainingMode
    ? buildDetailedTrainingOneSentence(resolvedTrainingData)
    : buildTestOneSentence({ stars, summary, abilityScores });

  const keyHighlights = isTrainingMode
    ? buildDetailedTrainingHighlights(resolvedTrainingData)
    : buildTestHighlights({ summary, abilityScores });

  const nextSuggestion = isTrainingMode
    ? buildDetailedTrainingNextSuggestion(resolvedTrainingData)
    : buildTestNextSuggestion({ stars, summary, abilityScores });

  const intuitiveIndicators = isTrainingMode
    ? buildTrainingIndicators(resolvedTrainingData, avgRT)
    : buildIntuitiveIndicators({ summary, abilityScores });

  const quickStats = isTrainingMode
    ? [
        {
          label: "接到橡實",
          value: `${resolvedTrainingData?.hitCount || 0} 次`,
          helper: "正確點到可以接的橡實",
        },
        {
          label: "漏接橡實",
          value: `${resolvedTrainingData?.missCount || missCount || 0} 次`,
          helper: "可以再觀察是否看得到目標",
        },
        {
          label: "平均反應",
          value: formatMsShort(resolvedTrainingData?.avgRT || avgRT || 0),
          helper: "接到橡實時的平均速度",
        },
        {
          label: "避開壞橡實",
          value: `${resolvedTrainingData?.correctAvoidCount || 0} 次`,
          helper: "看清楚後忍住不點",
        },
        {
          label: "提醒需求",
          value: getAssistLabel(resolvedTrainingData, normalizedRecords),
          helper: "長時間練習中需要小提醒的程度",
        },
        {
          label: "後段狀況",
          value: getFocusLabel(resolvedTrainingData, normalizedRecords),
          helper: "觀察後段是否仍能維持注意",
        },
      ]
    : [
        {
          label: "完成題數",
          value: `${summary?.totalTrials || totalSpawn || normalizedRecords.length || 0} 題`,
          helper: "本次有效出現的橡實數",
        },
        {
          label: "正確率",
          value: `${Math.round(summary?.accuracyPercent || 0)}%`,
          helper: "有沒有點到正確目標",
        },
        {
          label: "平均反應",
          value: formatMsShort(summary?.avgReactionTime || avgRT || 0),
          helper: "看到橡實後按下去的速度",
        },
        {
          label: "漏接/逾時",
          value: `${summary?.missCount || summary?.timeoutCount || missCount || 0} 次`,
          helper: "沒有在時間內完成的次數",
        },
      ];

  const performanceSegments = useMemo(
    () =>
      ["前段", "中段", "後段"].map((label, index) => ({
        label,
        ...getSegmentSummaryFromRecords(normalizedRecords, index, 3),
      })),
    [normalizedRecords]
  );

  const chartHasRecords = normalizedRecords.length > 0;
  const maxSegmentRt = Math.max(
    1,
    ...performanceSegments.map((segment) => segment.avgRT || 0)
  );

  const responseDistribution = useMemo(() => {
    const fromRecords = {
      hit: normalizedRecords.filter(
        (record) =>
          record.trainingAction === "hit" ||
          (record.isCorrect && record.trainingAction !== "correctAvoid")
      ).length,
      correctAvoid: normalizedRecords.filter(
        (record) => record.trainingAction === "correctAvoid"
      ).length,
      miss: normalizedRecords.filter(
        (record) => record.missed || record.timeout
      ).length,
      clickedRotten: normalizedRecords.filter(
        (record) =>
          record.clickedRotten || record.trainingAction === "clickedRotten"
      ).length,
    };

    if (normalizedRecords.length > 0) return fromRecords;

    return {
      hit: isTrainingMode
        ? safeNumber(resolvedTrainingData?.hitCount, 0)
        : safeNumber(summary?.correctCount, 0),
      correctAvoid: isTrainingMode
        ? safeNumber(resolvedTrainingData?.correctAvoidCount, 0)
        : safeNumber(summary?.rottenAvoidedCount, 0),
      miss: isTrainingMode
        ? safeNumber(resolvedTrainingData?.missCount ?? missCount, 0)
        : safeNumber(summary?.missCount ?? summary?.timeoutCount ?? missCount, 0),
      clickedRotten: isTrainingMode
        ? safeNumber(resolvedTrainingData?.clickedRottenCount, 0)
        : safeNumber(summary?.clickedRottenCount, 0),
    };
  }, [
    normalizedRecords,
    isTrainingMode,
    resolvedTrainingData,
    summary,
    missCount,
  ]);

  const distributionItems = [
    { key: "hit", label: "接到橡實", color: "#739a48" },
    { key: "correctAvoid", label: "避開壞橡實", color: "#65b8e8" },
    { key: "miss", label: "漏接/逾時", color: "#e7a62f" },
    { key: "clickedRotten", label: "誤點壞橡實", color: "#e98f7d" },
  ].map((item) => ({ ...item, value: responseDistribution[item.key] || 0 }));
  const distributionTotal = Math.max(
    1,
    distributionItems.reduce((sum, item) => sum + item.value, 0)
  );

  const handleBackToMenu = () => {
    if (backActionLockedRef.current) return;
    backActionLockedRef.current = true;

    // 帽子貼紙遊戲只允許由 SRT 訓練結果觸發。
    // TestPage_SRT 傳入 mode="test" 時，會直接執行原本的返回流程。
    if (isTrainingMode) {
      const childId = resolveResultChildId(summaryData);

      if (!rewardResultTokenRef.current) {
        const lastRecord = normalizedRecords[normalizedRecords.length - 1];
        const recordMarker =
          lastRecord?.timestamp ||
          summaryData?.finishedAt ||
          summaryData?.generatedAt ||
          `${normalizedRecords.length}-${displayScore}-${avgRT}`;

        rewardResultTokenRef.current = [
          "SRT",
          "training",
          childId,
          summaryData?.resultId || summaryData?.sessionId || "session",
          recordMarker,
        ].join(":");
      }

      try {
        const rewardDecision = evaluateHatReward({
          childId,
          resultToken: rewardResultTokenRef.current,
        });

        if (rewardDecision.shouldOpenHatGame) {
          const rewardSessionId = `SRT-${childId}-${Date.now()}`;

          navigate(HAT_GAME_ROUTE, {
            state: {
              childId,
              rewardSessionId,
              sessionId: summaryData?.sessionId || rewardSessionId,
              sourceGame: "SRT",
              sourceMode: "training",
              returnRoute: "/game-menu",
            },
          });
          return;
        }
      } catch (error) {
        console.error("SRT 帽子遊戲排程判斷失敗：", error);
      }
    }

    if (onBackToMenu) {
      onBackToMenu();
      return;
    }

    navigate(isTrainingMode ? "/game-menu" : "/test-map");
  };

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
      return;
    }

    navigate(isTrainingMode ? "/training-srt" : "/test-srt");
  };

  return (
    <div
      className="srt-result-page"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)), url(${bgImg})`,
      }}
    >
      <style>{resultPageCss}</style>

      <main className="srt-result-main-card">
        <header className="srt-result-header">
          <p className="srt-mode-tag">
            {isTrainingMode ? "練習結果" : "測驗結果"}
          </p>
          <h1 className="srt-result-main-title">
            {isTrainingMode ? "橡實練習完成" : "橡實挑戰完成"}
          </h1>
        </header>

        <section className="srt-parent-panel">
          <section className="srt-overview-card">
            <div className="srt-overview-left">
              <div className="srt-score-circle" aria-label={`${displayScore} 分`}>
                <span className="srt-score-number">{displayScore}</span>
                <span className="srt-score-unit">分</span>
              </div>

              <div className="srt-overview-text-box">
                <p className="srt-overview-label">
                  {isTrainingMode ? "這次練習" : "這次挑戰"}
                </p>
                <h2 className="srt-overview-title">{childShortLabel}</h2>
                <p className="srt-overview-desc">{oneSentenceResult}</p>
              </div>
            </div>

            <div className="srt-star-summary">
              <div className="srt-star-row" aria-label={`${stars} 顆星`}>
                {[1, 2, 3].map((star) => (
                  <span
                    key={star}
                    className={`srt-star-chip ${star <= stars ? "is-on" : ""}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p>星星代表本次完成表現</p>
              <small>請搭配下方觀察重點一起看，不是單一次診斷。</small>
            </div>
          </section>

          <section className="srt-panel-block srt-chart-summary">
            <div className="srt-section-heading-row">
              <div>
                <p className="srt-section-kicker">本次數據</p>
                <h2 className="srt-section-title">圖表摘要</h2>
              </div>
              <p>先看整體數字，再觀察前、中、後段的變化。</p>
            </div>

            <div className="srt-quick-stats">
              {quickStats.map((item) => (
                <article key={item.label} className="srt-stat-card">
                  <p className="srt-stat-label">{item.label}</p>
                  <p className="srt-stat-value">{item.value}</p>
                  <p className="srt-stat-helper">{item.helper}</p>
                </article>
              ))}
            </div>

            <div className="srt-chart-grid">
              <article className="srt-chart-card">
                <div className="srt-chart-title-row">
                  <div>
                    <h3>前、中、後段表現</h3>
                    <p>比較正確率與成功反應的平均速度</p>
                  </div>
                  <div className="srt-chart-legend" aria-label="圖例">
                    <span><i className="accuracy" />正確率</span>
                    <span><i className="reaction" />反應時間</span>
                  </div>
                </div>

                {chartHasRecords ? (
                  <div className="srt-segment-chart">
                    {performanceSegments.map((segment) => (
                      <div className="srt-segment-column" key={segment.label}>
                        <div className="srt-segment-bars">
                          <div
                            className="srt-segment-bar accuracy"
                            style={{ height: `${Math.max(4, segment.accuracy)}%` }}
                            title={`${segment.label}正確率 ${segment.accuracy}%`}
                          >
                            <span>{segment.accuracy}%</span>
                          </div>
                          <div
                            className="srt-segment-bar reaction"
                            style={{
                              height: `${Math.max(
                                4,
                                Math.round((segment.avgRT / maxSegmentRt) * 100)
                              )}%`,
                            }}
                            title={`${segment.label}平均反應 ${formatMsShort(segment.avgRT)}`}
                          >
                            <span>{formatMsShort(segment.avgRT)}</span>
                          </div>
                        </div>
                        <strong>{segment.label}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="srt-chart-empty">目前分段資料不足，完成一次完整挑戰後即可顯示趨勢。</p>
                )}
              </article>

              <article className="srt-chart-card">
                <div className="srt-chart-title-row">
                  <div>
                    <h3>作答結果分布</h3>
                    <p>呈現本次接到、避開、漏接與誤點的次數</p>
                  </div>
                </div>
                <div className="srt-distribution-track" aria-label="作答結果分布">
                  {distributionItems.map((item) =>
                    item.value > 0 ? (
                      <span
                        key={item.key}
                        style={{
                          width: `${(item.value / distributionTotal) * 100}%`,
                          backgroundColor: item.color,
                        }}
                        title={`${item.label} ${item.value} 次`}
                      />
                    ) : null
                  )}
                </div>
                <div className="srt-distribution-list">
                  {distributionItems.map((item) => (
                    <div key={item.key}>
                      <span><i style={{ backgroundColor: item.color }} />{item.label}</span>
                      <strong>{item.value} 次</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <details className="srt-collapsible-results">
            <summary>查看進階指標與解讀</summary>
            <div className="srt-collapsible-content">
          <section className="srt-panel-block">
            <h2 className="srt-section-title">結果快速解讀</h2>
            <p className="srt-parent-summary-text">{resultPlainSummary}</p>
          </section>

          <section className="srt-panel-block">
            <h2 className="srt-section-title">可以這樣看</h2>
            <p className="srt-parent-intro">
              不需要先懂專有名詞，只要看每張卡片的「孩子在做什麼」和「代表什麼」。
            </p>

            <div className="srt-highlight-grid">
              {keyHighlights.map((item) => (
                <article key={item.title} className="srt-observation-card">
                  <div className="srt-observation-top">
                    <span className={`srt-status-pill ${item.tone}`}>{item.badge}</span>
                    <div>
                      <p className="srt-card-label">觀察重點</p>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="srt-panel-block">
            <h2 className="srt-section-title">
              {isTrainingMode ? "這次練習看什麼？" : "孩子這次主要表現"}
            </h2>
            <div className="srt-indicator-grid">
              {intuitiveIndicators.map((item) => (
                <article key={item.key || item.title} className="srt-observation-card">
                  <div className="srt-observation-top">
                    <span className="srt-status-pill neutral">
                      {item.status || item.value}
                    </span>
                    <div>
                      <p className="srt-card-label">孩子在做什麼</p>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  {item.value !== undefined && !isTrainingMode && (
                    <>
                      <p className="srt-indicator-score">{item.value} / 100</p>
                      <div className="srt-ability-track" aria-hidden="true">
                        <span style={{ width: `${clampPercent(item.value)}%` }} />
                      </div>
                    </>
                  )}
                  <p>{item.description || item.desc}</p>
                  {item.advice && <p className="srt-card-meaning">{item.advice}</p>}
                </article>
              ))}
            </div>
          </section>
            </div>
          </details>

          <section className="srt-next-card">
            <h2 className="srt-section-title">下一步建議</h2>
            <h3>{nextSuggestion.title}</h3>
            <p>{nextSuggestion.text}</p>
          </section>

          <section className="srt-note-box">
            <h3>結果小提醒</h3>
            <p>
              這份結果是本次遊戲中的觀察紀錄，可以幫助了解孩子在「看見橡實、快速反應、維持注意」時的狀況；不代表醫療診斷，建議搭配多次練習或其他任務一起觀察。
            </p>
          </section>
        </section>

        <footer className="srt-action-btns">
          <button
            type="button"
            className="srt-image-button"
            onClick={handleBackToMenu}
            aria-label="回到森林"
          >
            <img src={homeBackBtn} width="532" height="177" loading="lazy" alt="回到森林" />
          </button>

          {isTrainingMode && (
            <button
              type="button"
              className="srt-image-button"
              onClick={handleRestart}
              aria-label="play again"
            >
              <img src={homeAgainBtn} width="532" height="177" loading="lazy" alt="再玩一次" />
            </button>
          )}
        </footer>
      </main>
    </div>
  );
};

function safeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safePercent(value, fallback = 0) {
  return Math.max(0, Math.min(100, safeNumber(value, fallback)));
}

function clampPercent(value) {
  return safePercent(value);
}

function averageNumbers(values = []) {
  const safeValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (safeValues.length === 0) return 0;

  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function getRtStatsFromRecords(records = []) {
  const rts = records
    .filter(
      (record) =>
        record?.trainingAction === "hit" &&
        typeof record.reactionTime === "number"
    )
    .map((record) => record.reactionTime);

  if (rts.length === 0) {
    return { avg: 0, std: 0, cv: 0, count: 0 };
  }

  const avg = averageNumbers(rts);
  const variance = averageNumbers(rts.map((rt) => Math.pow(rt - avg, 2)));
  const std = Math.sqrt(variance);

  return {
    avg: Math.round(avg),
    std: Math.round(std),
    cv: avg > 0 ? Number((std / avg).toFixed(2)) : 0,
    count: rts.length,
  };
}

function getSegmentSummaryFromRecords(records = [], segmentIndex = 0, totalSegments = 3) {
  const safeRecords = Array.isArray(records) ? records : [];
  const segmentSize = Math.ceil(safeRecords.length / totalSegments) || 1;
  const segmentRecords = safeRecords.slice(
    segmentIndex * segmentSize,
    segmentIndex * segmentSize + segmentSize
  );
  const total = segmentRecords.length;
  const hit = segmentRecords.filter((record) => record.trainingAction === "hit").length;
  const correctAvoid = segmentRecords.filter((record) => record.trainingAction === "correctAvoid").length;
  const miss = segmentRecords.filter((record) => record.missed || record.timeout).length;
  const clickedRotten = segmentRecords.filter((record) => record.trainingAction === "clickedRotten").length;
  const assisted = segmentRecords.filter((record) => record.assisted).length;
  const rtStats = getRtStatsFromRecords(segmentRecords);

  return {
    total,
    hit,
    correctAvoid,
    miss,
    clickedRotten,
    assisted,
    accuracy: total > 0 ? Math.round(((hit + correctAvoid) / total) * 100) : 0,
    missRate: total > 0 ? Math.round((miss / total) * 100) : 0,
    clickedRottenRate: total > 0 ? Math.round((clickedRotten / total) * 100) : 0,
    assistedRate: total > 0 ? Math.round((assisted / total) * 100) : 0,
    avgRT: rtStats.avg,
    rtStd: rtStats.std,
    rtCV: rtStats.cv,
  };
}

function buildFallbackLongAttentionMetrics(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const firstThird = getSegmentSummaryFromRecords(safeRecords, 0, 3);
  const middleThird = getSegmentSummaryFromRecords(safeRecords, 1, 3);
  const lastThird = getSegmentSummaryFromRecords(safeRecords, 2, 3);
  const rtStats = getRtStatsFromRecords(safeRecords);
  const assistedCount = safeRecords.filter((record) => record.assisted).length;
  const rtSlowing =
    lastThird.avgRT && firstThird.avgRT ? lastThird.avgRT - firstThird.avgRT : 0;
  const missIncrease = lastThird.missRate - firstThird.missRate;
  const wrongClickIncrease = lastThird.clickedRottenRate - firstThird.clickedRottenRate;
  const assistedRateIncrease = lastThird.assistedRate - firstThird.assistedRate;

  return {
    rtStd: rtStats.std,
    rtCV: rtStats.cv,
    assistedCount,
    assistedRate:
      safeRecords.length > 0 ? Math.round((assistedCount / safeRecords.length) * 100) : 0,
    firstThird,
    middleThird,
    lastThird,
    rtSlowing,
    missIncrease,
    wrongClickIncrease,
    assistedRateIncrease,
    attentionDrop:
      Math.max(0, missIncrease) +
      Math.max(0, wrongClickIncrease) +
      Math.max(0, Math.round(rtSlowing / 100)),
  };
}

function getLongAttentionMetrics(summaryData = {}, records = []) {
  return (
    summaryData?.longAttentionMetrics ||
    summaryData?.segmentAnalysis ||
    summaryData?.aiRecommendation?.longAttentionMetrics ||
    summaryData?.aiAnalysis?.segmentAnalysis ||
    summaryData?.aiAnalysis?.longAttentionMetrics ||
    buildFallbackLongAttentionMetrics(records)
  );
}

function getFocusLabel(summaryData = {}, records = []) {
  if (summaryData?.focusLabel) return summaryData.focusLabel;
  if (summaryData?.attentionLabel) return summaryData.attentionLabel;

  const metrics = getLongAttentionMetrics(summaryData, records);

  if ((metrics.attentionDrop || 0) >= 30 || (metrics.missIncrease || 0) >= 20) {
    return "後段需要多觀察";
  }

  if ((metrics.attentionDrop || 0) >= 12 || (metrics.rtSlowing || 0) >= 250) {
    return "後段稍微變慢";
  }

  return "維持穩定";
}

function getAssistLabel(summaryData = {}, records = []) {
  if (summaryData?.assistLabel) return summaryData.assistLabel;

  const metrics = getLongAttentionMetrics(summaryData, records);
  const assistedRate = safeNumber(metrics.assistedRate, safeNumber(summaryData?.assistedRate, 0));

  if (assistedRate >= 40) return "提醒較多";
  if (assistedRate >= 20) return "偶爾需要提醒";
  return "提醒很少";
}

function getNextDifficultyLabel(summaryData = {}) {
  if (summaryData?.nextDifficultyLabel) return summaryData.nextDifficultyLabel;
  const value =
    summaryData?.recommendation?.nextDifficulty ||
    summaryData?.aiRecommendation?.nextDifficulty ||
    summaryData?.aiAnalysis?.nextDifficulty ||
    summaryData?.recommendedDifficulty ||
    summaryData?.nextDifficulty ||
    "";

  const map = {
    easy: "降低挑戰",
    medium: "維持中等",
    hard: "增加挑戰",
    "easy-1": "簡單 1",
    "easy-2": "簡單 2",
    "easy-3": "簡單 3",
    "medium-1": "普通 1",
    "medium-2": "普通 2",
    "medium-3": "普通 3",
    "hard-1": "困難 1",
    "hard-2": "困難 2",
    "hard-3": "困難 3",
  };

  return map[value] || "維持練習";
}

function sanitizeAbilityScores(rawAbilityScores = {}, summary = {}) {
  const fallbackAccuracy = safePercent(summary?.accuracyPercent, 0);

  return {
    responseAccuracy: safePercent(
      rawAbilityScores?.responseAccuracy,
      fallbackAccuracy
    ),
    reactionSpeed: safePercent(rawAbilityScores?.reactionSpeed, 0),
    responseStability: safePercent(rawAbilityScores?.responseStability, 0),
    attentionMaintenance: safePercent(rawAbilityScores?.attentionMaintenance, 0),
    inhibitionControl: safePercent(rawAbilityScores?.inhibitionControl, 100),
    rewardSearch: safePercent(rawAbilityScores?.rewardSearch, 100),
  };
}


function getSimpleStatus(value) {
  if (value >= 80) return "表現良好";
  if (value >= 60) return "可以再練習";
  return "需要多觀察";
}

function formatMsWithSeconds(ms) {
  const safeMs = safeNumber(ms, 0);
  return `${Math.round(safeMs)} ms（約 ${(safeMs / 1000).toFixed(2)} 秒）`;
}

function getTrainingChildLabel(score) {
  if (score >= 35) return "橡實小高手";
  if (score >= 18) return "幫忙得不錯";
  return "再練一次會更好";
}

function getDetailedTrainingStars(summaryData = {}) {
  const directStars =
    summaryData?.stars ??
    summaryData?.star ??
    summaryData?.scoring?.stars ??
    summaryData?.starResult?.stars ??
    summaryData?.starResult?.star;

  if (Number.isFinite(Number(directStars))) {
    return Math.max(1, Math.min(3, Number(directStars)));
  }

  const scoreValue = safeNumber(summaryData?.finalScore ?? summaryData?.score, 0);
  if (scoreValue >= 35) return 3;
  if (scoreValue >= 18) return 2;
  return 1;
}

function normalizeTrainingDifficultyGroup(summaryData = {}) {
  const rawValue = String(
    summaryData?.difficulty ||
      summaryData?.difficultyKey ||
      summaryData?.difficultyLevel ||
      summaryData?.currentDifficulty ||
      summaryData?.recommendedDifficulty ||
      summaryData?.nextDifficulty ||
      summaryData?.difficultyLabel ||
      ""
  ).toLowerCase();

  if (rawValue.includes("hard") || rawValue.includes("3") || rawValue.includes("高")) {
    return "hard";
  }

  if (
    rawValue.includes("medium") ||
    rawValue.includes("normal") ||
    rawValue.includes("2") ||
    rawValue.includes("中")
  ) {
    return "medium";
  }

  return "easy";
}

function getDetailedTrainingLevelInfo(summaryData = {}) {
  const group = normalizeTrainingDifficultyGroup(summaryData);
  const label =
    summaryData?.difficultyLabel ||
    summaryData?.levelLabel ||
    summaryData?.trainingLevelLabel ||
    getNextDifficultyLabel(summaryData);

  const map = {
    easy: {
      label,
      title: "基礎反應層級",
      meaning:
        "這一層主要在建立「看到目標後啟動反應」的連結，重點不是追求很快，而是讓孩子先理解規則並願意穩定參與。",
    },
    medium: {
      label,
      title: "穩定反應層級",
      meaning:
        "這一層開始要求孩子在較多等待與干擾中保持注意，練習看清楚目標後再反應。",
    },
    hard: {
      label,
      title: "進階控制層級",
      meaning:
        "這一層同時拉高速度、持續注意與抑制控制的負荷，孩子需要在想快一點的情況下仍然維持判斷品質。",
    },
  };

  return { group, ...map[group] };
}

function getDetailedTrainingStarInfo(stars) {
  if (stars >= 3) {
    return {
      title: "目前層級表現穩定",
      meaning:
        "孩子在這個層級已能穩定完成主要要求，可以開始觀察是否準備好接受稍高一點的挑戰。",
    };
  }

  if (stars === 2) {
    return {
      title: "能力正在出現，但還需要穩定",
      meaning:
        "孩子已經抓到任務規則，也能完成一部分目標；接下來的重點是讓反應品質更平均，減少忽快忽慢或偶發錯誤。",
    };
  }

  return {
    title: "仍需要較多支持與熟悉",
    meaning:
      "孩子目前可能還在適應任務節奏，建議先降低速度壓力，以短時間、多次熟悉為主。",
  };
}

function getDetailedTrainingProfile(summaryData = {}) {
  const metrics = getLongAttentionMetrics(summaryData);
  const hitCount = safeNumber(summaryData?.hitCount, 0);
  const missCount = safeNumber(summaryData?.missCount, 0);
  const clickedRottenCount = safeNumber(summaryData?.clickedRottenCount, 0);
  const correctAvoidCount = safeNumber(summaryData?.correctAvoidCount, 0);
  const avgRT = safeNumber(summaryData?.avgRT, 0);
  const rtCV = safeNumber(summaryData?.rtCV, safeNumber(metrics?.rtCV, 0));
  const assistedRate = safeNumber(
    summaryData?.assistedRate,
    safeNumber(metrics?.assistedRate, 0)
  );
  const attentionDrop = safeNumber(
    summaryData?.attentionDrop,
    safeNumber(metrics?.attentionDrop, 0)
  );
  const totalResponseEvents = Math.max(1, hitCount + missCount);
  const missRate = Math.round((missCount / totalResponseEvents) * 100);

  if (assistedRate >= 40) {
    return {
      key: "needs_assist",
      badge: "提示",
      tone: "watch",
      title: "需要提示後比較能穩定完成",
      meaning:
        "孩子在有提醒或輔助時比較容易接上任務，代表目前可以先把提示當作橋梁，再慢慢減少提示量。",
      observation:
        "家長可以觀察孩子是需要一開始提醒，還是任務中段容易斷掉後需要重新帶回來。",
      advice:
        "下次建議維持目前層級，先固定使用簡短提示，例如「先看清楚再按」，等穩定後再逐步撤除。",
    };
  }

  if (clickedRottenCount >= 4) {
    return {
      key: "fast_but_impulsive",
      badge: "誤按",
      tone: "alert",
      title: "反應意願高，但有時會太快出手",
      meaning:
        "孩子很投入，也願意快速反應；不過遇到不能按或相似刺激時，偶爾會還沒確認清楚就先按下去。",
      observation:
        "家長可以留意孩子是否常出現「先按再說」的狀況，或在刺激突然出現時比較難等待。",
      advice:
        "下次先維持或微降層級，把目標放在少誤按，而不是更快完成。",
    };
  }

  if (missRate >= 45 || missCount > hitCount) {
    return {
      key: "miss_many",
      badge: "漏按",
      tone: "watch",
      title: "理解任務，但目標出現時容易漏掉",
      meaning:
        "孩子可能知道要做什麼，但在等待、掃描畫面或持續注意上還不夠穩定，所以有些目標沒有即時接住。",
      observation:
        "家長可以觀察孩子是否在遊戲後半段比較容易看別處、慢半拍，或需要別人提醒才回到任務。",
      advice:
        "下次建議維持目前層級，但縮短單次練習時間，先把命中目標的穩定度拉起來。",
    };
  }

  if (attentionDrop >= 20) {
    return {
      key: "late_fatigue",
      badge: "後段",
      tone: "watch",
      title: "前段能投入，後段注意力較容易下滑",
      meaning:
        "孩子一開始可以進入任務，但隨著時間拉長，反應品質可能下降，這比較像持續注意或疲勞調節的議題。",
      observation:
        "家長可以看孩子是不是越到後面越慢、越容易漏掉，或開始需要更多提醒。",
      advice:
        "下次可以用較短回合練習，中間安排明確休息，再逐步拉長時間。",
    };
  }

  if (rtCV >= 0.35) {
    return {
      key: "unstable_response",
      badge: "起伏",
      tone: "watch",
      title: "反應忽快忽慢，穩定度仍在建立",
      meaning:
        "孩子有時能很快反應，但有時會突然慢下來。這代表能力已經出現，只是還需要練習穩定維持。",
      observation:
        "家長可以觀察孩子是否容易受到畫面變化、等待時間或情緒興奮程度影響。",
      advice:
        "下次先維持目前層級，練習固定節奏與看清楚再按。",
    };
  }

  if (avgRT >= 1800 && hitCount >= missCount) {
    return {
      key: "slow_but_accurate",
      badge: "慢穩",
      tone: "good",
      title: "速度較慢，但判斷品質不錯",
      meaning:
        "孩子可能會花比較多時間確認目標，但這也代表他正在嘗試控制衝動、避免亂按。",
      observation:
        "家長可以鼓勵孩子保持看清楚的習慣，再用輕鬆方式慢慢提高速度。",
      advice:
        "下次可維持同層級，目標放在稍微縮短反應時間，而不是一次提高很多難度。",
    };
  }

  if (correctAvoidCount >= clickedRottenCount && hitCount >= missCount) {
    return {
      key: "balanced",
      badge: "穩定",
      tone: "good",
      title: "速度、正確率與等待控制較平衡",
      meaning:
        "孩子在目前層級能同時做到看到目標就反應，以及遇到不該按的刺激時忍住。",
      observation:
        "家長可以觀察孩子是否能在沒有太多提醒下完成，並維持愉快投入。",
      advice:
        "下次可以維持層級再確認一次；若仍穩定，就可以考慮小幅提高難度。",
    };
  }

  return {
    key: "developing",
    badge: "練習",
    tone: "neutral",
    title: "能力正在累積，仍需更多資料觀察",
    meaning:
      "這次表現沒有單一特別突出的錯誤型態，建議先把它視為孩子正在熟悉任務節奏的一次練習。",
    observation:
      "家長可以持續觀察孩子在不同日期是否呈現相似狀況，而不是只看單次表現。",
    advice:
      "下次建議維持目前層級，累積 2 到 3 次結果後再判斷是否調整。",
  };
}

function buildDetailedTrainingOneSentence(summaryData = {}) {
  const stars = getDetailedTrainingStars(summaryData);
  const levelInfo = getDetailedTrainingLevelInfo(summaryData);
  const profile = getDetailedTrainingProfile(summaryData);

  return `${levelInfo.title}，${stars} 星：${profile.title}。`;
}

function buildDetailedTrainingParentSummary(summaryData = {}) {
  if (summaryData?.aiParentSummary) return summaryData.aiParentSummary;
  if (summaryData?.parentSummary) return summaryData.parentSummary;

  const stars = getDetailedTrainingStars(summaryData);
  const levelInfo = getDetailedTrainingLevelInfo(summaryData);
  const starInfo = getDetailedTrainingStarInfo(stars);
  const profile = getDetailedTrainingProfile(summaryData);
  const hitCount = safeNumber(summaryData?.hitCount, 0);
  const missCount = safeNumber(summaryData?.missCount, 0);
  const clickedRottenCount = safeNumber(summaryData?.clickedRottenCount, 0);
  const avgRT = safeNumber(summaryData?.avgRT, 0);
  const rtText = avgRT ? `平均反應約 ${(avgRT / 1000).toFixed(2)} 秒` : "平均反應時間資料不足";

  return `這次訓練屬於「${levelInfo.label}」的${levelInfo.title}。${levelInfo.meaning} 本次拿到 ${stars} 星，代表${starInfo.meaning} 主要觀察到的型態是「${profile.title}」：${profile.meaning} 數據上，孩子命中 ${hitCount} 次、漏按 ${missCount} 次、誤按干擾物 ${clickedRottenCount} 次，${rtText}。${profile.observation}`;
}

function buildDetailedTrainingHighlights(summaryData = {}) {
  const stars = getDetailedTrainingStars(summaryData);
  const levelInfo = getDetailedTrainingLevelInfo(summaryData);
  const starInfo = getDetailedTrainingStarInfo(stars);
  const profile = getDetailedTrainingProfile(summaryData);
  const metrics = getLongAttentionMetrics(summaryData);
  const hitCount = safeNumber(summaryData?.hitCount, 0);
  const missCount = safeNumber(summaryData?.missCount, 0);
  const clickedRottenCount = safeNumber(summaryData?.clickedRottenCount, 0);
  const assistedRate = safeNumber(
    summaryData?.assistedRate,
    safeNumber(metrics?.assistedRate, 0)
  );

  return [
    {
      badge: levelInfo.group === "hard" ? "高" : levelInfo.group === "medium" ? "中" : "基",
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
      badge: hitCount >= missCount ? "命中" : "漏按",
      tone: hitCount >= missCount ? "good" : "watch",
      title: "目標反應狀況",
      text: `孩子這次命中 ${hitCount} 次、漏按 ${missCount} 次。這可以協助判斷孩子是能穩定接住目標，還是需要先練習等待與掃描畫面。`,
    },
    {
      badge: clickedRottenCount <= 2 ? "控制" : "誤按",
      tone: clickedRottenCount <= 2 ? "good" : "alert",
      title: "抑制控制狀況",
      text:
        clickedRottenCount <= 2
          ? "孩子大多能忍住不該按的刺激，代表目前的等待與抑制控制表現不錯。"
          : `孩子誤按干擾物 ${clickedRottenCount} 次，建議下次把重點放在「看清楚再按」。`,
    },
    {
      badge: assistedRate >= 40 ? "多" : assistedRate >= 20 ? "中" : "少",
      tone: assistedRate >= 40 ? "alert" : assistedRate >= 20 ? "watch" : "good",
      title: "提示需求",
      text:
        assistedRate >= 40
          ? "孩子目前仍需要較多提示才能維持任務，建議先保留簡短提示，再慢慢減少。"
          : assistedRate >= 20
          ? "孩子偶爾需要提示才能重新回到任務，可以觀察提示出現的時間點。"
          : "孩子多半能自己完成任務，提示需求不高。",
    },
  ];
}

function buildDetailedTrainingNextSuggestion(summaryData = {}) {
  if (summaryData?.parentNextSuggestion?.title || summaryData?.parentNextSuggestion?.text) {
    return {
      title: summaryData.parentNextSuggestion.title || "下一次訓練建議",
      text: summaryData.parentNextSuggestion.text || "建議延續目前結果調整下一次訓練。",
    };
  }

  const analyzerRecommendation =
    summaryData?.recommendation ||
    summaryData?.aiAnalysis?.recommendation ||
    null;
  const stars = getDetailedTrainingStars(summaryData);
  const levelInfo = getDetailedTrainingLevelInfo(summaryData);
  const profile = getDetailedTrainingProfile(summaryData);
  const nextDifficultyLabel = getNextDifficultyLabel(summaryData);

  if (analyzerRecommendation?.reason) {
    return {
      title: "下一次訓練建議",
      text: `系統建議「${nextDifficultyLabel}」：${analyzerRecommendation.reason}。以家長觀察來看，這次主要型態是「${profile.title}」，${profile.advice}`,
    };
  }

  if (profile.key === "balanced" && stars >= 3) {
    return {
      title: "可以小幅提高挑戰",
      text: `孩子在「${levelInfo.label}」表現穩定。下一次可以先提高一小階，或維持同層級再確認一次穩定度。`,
    };
  }

  if (stars <= 1 || profile.tone === "alert") {
    return {
      title: "先穩定，不急著升級",
      text: `${profile.advice} 若連續兩次仍出現同樣狀況，可以考慮降低一階，先讓孩子重新建立成功經驗。`,
    };
  }

  return {
    title: "維持目前層級，針對主要型態練習",
    text: `${profile.advice} 建議累積 2 到 3 次結果後，再判斷是否升級或調整訓練時間。`,
  };
}

function buildTestOneSentence({ stars, summary = {}, abilityScores = {} }) {
  if (!summary.totalTrials) {
    return "目前資料還不完整，完成一次挑戰後，這裡會用簡單文字說明孩子的表現。";
  }

  if (stars === 3) {
    return "孩子這次大多能點對橡實，反應也很穩定，可以先維持目前節奏。";
  }

  if ((abilityScores.attentionMaintenance || 0) < 60) {
    return "孩子前面表現可以，但玩到後面比較容易變慢，可能需要先縮短練習時間。";
  }

  if ((summary.rottenClickRate || 0) > 40) {
    return "孩子反應很積極，但比較容易點到壞橡實，區分目標物和干擾物的能力還可以再加強。";
  }

  if (stars === 2) {
    return "孩子已經能完成不少反應任務，下次建議先維持同樣難度，讓表現更穩。";
  }

  return "孩子還在熟悉規則，建議下一次先放慢速度，讓孩子先建立成功經驗。";
}

// eslint-disable-next-line no-unused-vars
function buildTrainingOneSentence(summaryData = {}) {
  const hitCount = summaryData?.hitCount || 0;
  const correctAvoidCount = summaryData?.correctAvoidCount || 0;

  return `孩子這次接到 ${hitCount} 顆橡實，也成功避開 ${correctAvoidCount} 顆壞橡實。這裡主要看孩子有沒有看清楚再點。`;
}

function buildTestParentSummary({ stars, summary = {}, abilityScores = {} }) {
  if (!summary.totalTrials) {
    return "目前還沒有完整結果。完成一次完整挑戰後，這裡會整理成本次結果說明。";
  }

  const accuracyText =
    (summary.accuracyPercent || 0) >= 80
      ? "孩子大多能點到正確的橡實。"
      : (summary.accuracyPercent || 0) >= 60
      ? "孩子可以完成部分任務，但偶爾會漏掉或點錯。"
      : "孩子目前還在熟悉規則，點對的比例可以再練習。";

  const speedText = summary.avgReactionTime
    ? `平均反應約 ${(summary.avgReactionTime / 1000).toFixed(2)} 秒，可以把它理解成孩子看到橡實後按下去的速度。`
    : "目前有效反應時間資料不足。";

  const attentionText =
    (abilityScores.attentionMaintenance || 0) >= 80
      ? "前後段表現差異不大，代表孩子能維持注意力。"
      : (abilityScores.attentionMaintenance || 0) >= 60
      ? "後半段稍微變慢，可能開始有一點累。"
      : "後半段明顯變慢，建議下次先不要拉太長時間。";

  return `${accuracyText}${speedText}${attentionText}`;
}

// eslint-disable-next-line no-unused-vars
function buildTrainingParentSummary(summaryData = {}) {
  if (summaryData?.aiParentSummary) return summaryData.aiParentSummary;
  if (summaryData?.parentSummary) return summaryData.parentSummary;

  const difficultyLabel = summaryData?.difficultyLabel || "普通";
  const hitCount = summaryData?.hitCount || 0;
  const missCount = summaryData?.missCount || 0;
  const correctAvoidCount = summaryData?.correctAvoidCount || 0;
  const clickedRottenCount = summaryData?.clickedRottenCount || 0;
  const avgRT = summaryData?.avgRT || 0;
  const focusLabel = getFocusLabel(summaryData);
  const assistLabel = getAssistLabel(summaryData);

  return `本次是「${difficultyLabel}」練習。孩子接到 ${hitCount} 次可以接的橡實，漏接 ${missCount} 次，平均反應約 ${(avgRT / 1000).toFixed(2)} 秒。若有壞橡實，孩子成功忍住 ${correctAvoidCount} 次，誤點 ${clickedRottenCount} 次。整體來看，專注維持狀況為「${focusLabel}」，提醒需求為「${assistLabel}」。可以把它理解成：孩子有沒有先看清楚，再決定要不要點。`;
}

function buildTestHighlights({ summary = {}, abilityScores = {} }) {
  const highlights = [];

  highlights.push({
    badge: (summary.accuracyPercent || 0) >= 80 ? "✓" : "△",
    tone: (summary.accuracyPercent || 0) >= 80 ? "good" : "watch",
    title: "有沒有點對？",
    text:
      (summary.accuracyPercent || 0) >= 80
        ? "孩子大多能正確點到橡實。"
        : "孩子偶爾會漏點或點錯，可以先放慢速度練習。",
  });

  highlights.push({
    badge: (abilityScores.reactionSpeed || 0) >= 70 ? "✓" : "△",
    tone: (abilityScores.reactionSpeed || 0) >= 70 ? "good" : "watch",
    title: "看到後點得快不快？",
    text: summary.avgReactionTime
      ? `平均約 ${(summary.avgReactionTime / 1000).toFixed(2)} 秒完成反應。`
      : "目前反應時間資料不足。",
  });

  if ((summary.rottenTotal || 0) > 0) {
    highlights.push({
      badge: (summary.rottenClickRate || 0) <= 30 ? "✓" : "!",
      tone: (summary.rottenClickRate || 0) <= 30 ? "good" : "alert",
      title: "壞橡實有沒有忍住？",
      text:
        (summary.rottenClickRate || 0) <= 30
          ? "孩子大致能忍住不點壞橡實。"
          : "孩子比較容易點到壞橡實，表示區分目標物和干擾物的能力還可以再加強。日常生活中可減少不必要的干擾物，幫助孩子提升表現。",
    });
  } else {
    highlights.push({
      badge: "☆",
      tone: "neutral",
      title: "壞橡實提醒",
      text: "這次沒有壞橡實，主要觀察點對與反應速度。",
    });
  }

  return highlights;
}

// eslint-disable-next-line no-unused-vars
function buildTrainingHighlights(summaryData = {}) {
  const hitCount = summaryData?.hitCount || 0;
  const missCount = summaryData?.missCount || 0;
  const clickedRottenCount = summaryData?.clickedRottenCount || 0;
  const focusLabel = getFocusLabel(summaryData);
  const assistLabel = getAssistLabel(summaryData);
  const metrics = getLongAttentionMetrics(summaryData);

  const highlights = [
    {
      badge: hitCount >= missCount ? "✓" : "△",
      tone: hitCount >= missCount ? "good" : "watch",
      title: "橡實接得如何？",
      text: `孩子接到 ${hitCount} 次，漏接 ${missCount} 次。`,
    },
    {
      badge: clickedRottenCount <= 2 ? "✓" : "!",
      tone: clickedRottenCount <= 2 ? "good" : "alert",
      title: "壞橡實有沒有忍住？",
      text:
        clickedRottenCount <= 2
          ? "孩子大致能忍住不點壞橡實。"
          : "孩子較容易誤點壞橡實，下次可以先降低干擾。",
    },
    {
      badge: "☆",
      tone: "neutral",
      title: "練習重點",
      text: "這個遊戲主要觀察孩子看到目標後，能不能先看清楚再反應。",
    },
  ];

  if (summaryData?.longAttentionMetrics || summaryData?.aiAnalysis?.longAttentionMetrics) {
    highlights.push({
      badge: (metrics.attentionDrop || 0) >= 20 ? "△" : "✓",
      tone: (metrics.attentionDrop || 0) >= 20 ? "watch" : "good",
      title: "後段專注有沒有維持？",
      text:
        focusLabel === "維持穩定"
          ? "前中後段變化不大，長時間練習時仍能維持注意。"
          : `後段狀況為「${focusLabel}」，可以觀察是否因時間拉長而變慢或漏接增加。`,
    });
  }

  if (summaryData?.assistedRate !== undefined || summaryData?.longAttentionMetrics?.assistedRate !== undefined) {
    highlights.push({
      badge: (metrics.assistedRate || 0) >= 40 ? "!" : (metrics.assistedRate || 0) >= 20 ? "△" : "✓",
      tone: (metrics.assistedRate || 0) >= 40 ? "alert" : (metrics.assistedRate || 0) >= 20 ? "watch" : "good",
      title: "需不需要小提醒？",
      text: `本次提醒需求為「${assistLabel}」，代表孩子在長時間練習中需要被喚回注意的程度。`,
    });
  }

  return highlights;
}

function buildTestNextSuggestion({ stars, summary = {}, abilityScores = {} }) {
  if (!summary.totalTrials) {
    return {
      title: "先完成一次完整挑戰",
      text: "完成後系統會根據孩子的點對率、反應速度與干擾表現給出建議。",
    };
  }

  if ((summary.rottenTotal || 0) > 0 && (summary.rottenClickRate || 0) > 40) {
    return {
      title: "練習區分目標與干擾物",
      text: "孩子比較容易點到壞橡實，表示區分目標物和干擾物的能力還可以再加強。日常生活中可減少不必要的干擾物，並練習「看清楚再行動」，幫助孩子提升表現。",
    };
  }

  if ((abilityScores.attentionMaintenance || 0) < 60) {
    return {
      title: "下次先縮短或維持訓練時間",
      text: "孩子玩到後面比較容易變慢，可能是疲累或專注下降。建議先維持難度，不要一次練太久。",
    };
  }

  if ((summary.accuracyPercent || 0) < 60 || stars <= 1) {
    return {
      title: "下次先降低速度，建立成功感",
      text: "孩子目前還在熟悉規則，可以先讓橡實停留久一點、物件大一點，再慢慢增加挑戰。",
    };
  }

  if (stars >= 3 && (summary.rottenClickRate || 0) <= 30) {
    return {
      title: "下次可以小幅增加挑戰",
      text: "孩子這次表現穩定，可以稍微增加速度或加入少量干擾，但不需要一次加太多。",
    };
  }

  return {
    title: "下次建議維持目前難度",
    text: "孩子已經能完成部分任務，先讓表現更穩定，再逐步增加速度或干擾。",
  };
}

// eslint-disable-next-line no-unused-vars
function buildTrainingNextSuggestion(summaryData = {}) {
  if (summaryData?.parentNextSuggestion?.title || summaryData?.parentNextSuggestion?.text) {
    return {
      title: summaryData.parentNextSuggestion.title || "下次練習建議",
      text: summaryData.parentNextSuggestion.text || "建議依照本次表現調整下次練習。",
    };
  }

  if (summaryData?.aiRecommendation?.nextTitle || summaryData?.aiRecommendation?.nextSuggestion) {
    return {
      title: summaryData.aiRecommendation.nextTitle || "下次練習建議",
      text:
        summaryData.aiRecommendation.nextSuggestion ||
        "建議依照本次表現調整下次練習。",
    };
  }

  const analyzerRecommendation =
    summaryData?.recommendation ||
    summaryData?.aiAnalysis?.recommendation ||
    null;

  if (analyzerRecommendation?.reason) {
    return {
      title:
        analyzerRecommendation.action === "upgrade"
          ? "下次可以增加一階挑戰"
          : analyzerRecommendation.action === "downgrade"
          ? "下次建議降低一階難度"
          : "下次先維持目前難度",
      text: `系統建議「${getNextDifficultyLabel(summaryData)}」：${analyzerRecommendation.reason}`,
    };
  }

  const clickedRottenCount = summaryData?.clickedRottenCount || 0;
  const missCount = summaryData?.missCount || 0;
  const hitCount = summaryData?.hitCount || 0;
  const focusLabel = getFocusLabel(summaryData);
  const assistLabel = getAssistLabel(summaryData);
  const nextDifficultyLabel = getNextDifficultyLabel(summaryData);

  if (clickedRottenCount >= 4) {
    return {
      title: "下次先減少壞橡實",
      text: "孩子比較容易點到不能點的橡實，建議先練習辨認，再增加速度。",
    };
  }

  if (missCount > hitCount) {
    return {
      title: "下次先放慢速度",
      text: "孩子漏接比較多，可以先讓橡實停留久一點，幫助孩子建立成功感。",
    };
  }

  if (focusLabel !== "維持穩定" || assistLabel === "提醒較多") {
    return {
      title: "下次先穩定完成",
      text: `本次後段狀況為「${focusLabel}」、提醒需求為「${assistLabel}」。建議下次先以「${nextDifficultyLabel}」為目標，穩定後再增加挑戰。`,
    };
  }

  return {
    title: "下次可以維持目前難度",
    text: `孩子這次能完成不少反應任務，建議先穩定練習。系統建議方向：${nextDifficultyLabel}。`,
  };
}

function buildIntuitiveIndicators({ summary = {}, abilityScores = {} }) {
  return [
    {
      key: "responseAccuracy",
      shortLabel: "點對",
      title: "有沒有點對？",
      value: clampPercent(abilityScores.responseAccuracy || 0),
      status: getSimpleStatus(abilityScores.responseAccuracy || 0),
      description: "看孩子是不是能正確點到可以接的橡實。",
      advice:
        (abilityScores.responseAccuracy || 0) >= 80
          ? "目前點對狀況不錯。"
          : "可以先放慢速度，讓孩子更容易看清楚。",
    },
    {
      key: "reactionSpeed",
      shortLabel: "速度",
      title: "看到後點得快不快？",
      value: clampPercent(abilityScores.reactionSpeed || 0),
      status: getSimpleStatus(abilityScores.reactionSpeed || 0),
      description: summary.avgReactionTime
        ? `平均約 ${(summary.avgReactionTime / 1000).toFixed(2)} 秒完成點擊。`
        : "看孩子看到橡實後，需要多久才按下去。",
      advice:
        (abilityScores.reactionSpeed || 0) >= 80
          ? "反應速度穩定，可以維持目前節奏。"
          : "可以先讓橡實停留久一點。",
    },
    {
      key: "responseStability",
      shortLabel: "穩定",
      title: "每次表現穩不穩？",
      value: clampPercent(abilityScores.responseStability || 0),
      status: getSimpleStatus(abilityScores.responseStability || 0),
      description: "看孩子每一題反應會不會忽快忽慢。",
      advice:
        (abilityScores.responseStability || 0) >= 80
          ? "反應節奏穩定。"
          : "可以先用固定速度練習，不急著加快。",
    },
    {
      key: "attentionMaintenance",
      shortLabel: "後段",
      title: "玩到後面有沒有變慢？",
      value: clampPercent(abilityScores.attentionMaintenance || 0),
      status: getSimpleStatus(abilityScores.attentionMaintenance || 0),
      description: "看孩子後半段是否比較容易累、分心或變慢。",
      advice:
        (abilityScores.attentionMaintenance || 0) >= 80
          ? "注意力維持不錯。"
          : "下次可以先縮短時間，或中間安排休息。",
    },
    {
      key: "inhibitionControl",
      shortLabel: "忍住",
      title: "壞橡實有沒有忍住？",
      value: clampPercent(abilityScores.inhibitionControl ?? 100),
      status: getSimpleStatus(abilityScores.inhibitionControl ?? 100),
      description:
        (summary.rottenTotal || 0) > 0
          ? "看孩子看到不能點的壞橡實時，有沒有忍住。"
          : "這次沒有壞橡實，所以這項暫時不影響結果。",
      advice:
        (summary.rottenTotal || 0) > 0 && (summary.rottenClickRate || 0) > 40
          ? "日常生活中可減少不必要的干擾物，並練習看清楚再行動。"
          : "目前干擾控制表現可以。",
    },
    {
      key: "rewardSearch",
      shortLabel: "金色",
      title: "金色橡實有沒有注意到？",
      value: clampPercent(abilityScores.rewardSearch ?? 100),
      status: getSimpleStatus(abilityScores.rewardSearch ?? 100),
      description:
        (summary.goldenTotal || 0) > 0
          ? "看孩子有沒有注意到比較特別、比較值得接的金色橡實。"
          : "這次沒有金色橡實，所以這項暫時不影響結果。",
      advice:
        (summary.goldenTotal || 0) > 0 && (summary.goldenHitRate || 0) < 50
          ? "可以先放慢速度，讓孩子更容易注意到金色橡實。"
          : "目前獎勵目標搜尋表現可以。",
    },
  ];
}


/*
  =========================================================
  ResultPage CSS
  =========================================================
*/


function formatMsShort(ms) {
  const safeMs = safeNumber(ms, 0);
  if (!safeMs) return "--";
  return `${(safeMs / 1000).toFixed(2)} 秒`;
}

function buildTrainingIndicators(summaryData = {}, avgRT = 0) {
  const metrics = getLongAttentionMetrics(summaryData);
  const focusLabel = getFocusLabel(summaryData);
  const assistLabel = getAssistLabel(summaryData);
  const nextDifficultyLabel = getNextDifficultyLabel(summaryData);
  const rtCV = safeNumber(summaryData?.rtCV, safeNumber(metrics.rtCV, 0));
  const assistedRate = safeNumber(summaryData?.assistedRate, safeNumber(metrics.assistedRate, 0));
  const attentionDrop = safeNumber(summaryData?.attentionDrop, safeNumber(metrics.attentionDrop, 0));

  const indicators = [
    {
      key: "difficulty",
      title: "這次難度",
      value: summaryData?.difficultyLabel || "普通",
      status: summaryData?.difficultyLabel || "普通",
      desc: "代表這次橡實出現的速度、大小與干擾程度。",
    },
    {
      key: "hit",
      title: "有沒有接到橡實？",
      value: `${summaryData?.hitCount || 0} 次`,
      status: `${summaryData?.hitCount || 0} 次`,
      desc: "孩子正確點到可以接的橡實次數。",
    },
    {
      key: "speed",
      title: "看到後點得多快？",
      value: formatMsWithSeconds(summaryData?.avgRT || avgRT || 0),
      status: formatMsShort(summaryData?.avgRT || avgRT || 0),
      desc: "這是成功接到橡實時的平均反應時間。",
    },
    {
      key: "avoid",
      title: "壞橡實有沒有忍住？",
      value: `${summaryData?.correctAvoidCount || 0} 次`,
      status: `${summaryData?.correctAvoidCount || 0} 次`,
      desc: "孩子看到壞橡實時，成功忍住沒有點的次數。",
    },
    {
      key: "golden",
      title: "金色橡實有沒有注意到？",
      value: `${summaryData?.distractorMetrics?.goldenHitCount ?? summaryData?.goldenHitCount ?? 0} 次`,
      status: `${summaryData?.distractorMetrics?.goldenHitCount ?? summaryData?.goldenHitCount ?? 0} 次`,
      desc: "孩子有沒有注意到比較特別、比較值得接的金色橡實。",
    },
    {
      key: "focus",
      title: "專心維持得如何？",
      value: focusLabel,
      status: focusLabel,
      desc:
        focusLabel === "維持穩定"
          ? "前中後段表現相對穩定，長時間練習時仍能維持注意。"
          : "這裡會看後段是否變慢、漏接是否增加，以及是否更需要提醒。",
    },
    {
      key: "assist",
      title: "需不需要小提醒？",
      value: `${assistedRate}%`,
      status: assistLabel,
      desc: "提醒比例越高，代表孩子越常需要呼吸光、晃動或背景淡閃協助回到任務。",
    },
    {
      key: "stability",
      title: "反應穩定度",
      value: rtCV ? `CV ${rtCV}` : "--",
      status: rtCV ? `CV ${rtCV}` : "--",
      desc: "這裡看反應是否忽快忽慢；數字越高，代表注意力波動可能越明顯。",
    },
    {
      key: "attentionDrop",
      title: "後段變化",
      value: attentionDrop ? `${attentionDrop}` : "穩定",
      status: attentionDrop ? `${attentionDrop}` : "穩定",
      desc: "綜合後段變慢、漏接增加與誤點變化，用來觀察長時間專注是否下降。",
    },
    {
      key: "next",
      title: "下次怎麼練？",
      value: nextDifficultyLabel,
      status: nextDifficultyLabel,
      desc:
        summaryData?.parentAdvice ||
        summaryData?.aiRecommendation?.parentAdvice ||
        "建議先穩定完成目前難度，再慢慢增加挑戰。",
    },
  ];

  return indicators;
}

const resultPageCss = `
:root {
  --srt-honey: #e7a62f;
  --srt-honey-dark: #b87818;
  --srt-cream: #fffaf0;
  --srt-cream-deep: #f6ead4;
  --srt-sky: #65b8e8;
  --srt-sky-soft: #eaf6fd;
  --srt-leaf: #739a48;
  --srt-leaf-soft: #eef5e6;
  --srt-coral: #e98f7d;
  --srt-coral-soft: #fff0ec;
  --srt-wood: #6b4226;
  --srt-wood-soft: #8a5a34;
  --srt-line: #ead8b7;
}

.srt-result-page {
  width: 100%;
  min-height: 100dvh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: clamp(12px, 2.4vw, 30px);
  box-sizing: border-box;
  font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
  color: var(--srt-wood);
}

.srt-result-main-card {
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

.srt-result-header {
  padding: clamp(22px, 4vw, 38px) clamp(18px, 4vw, 42px) 22px;
  border-bottom: 1px solid var(--srt-line);
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,248,232,.94));
}

.srt-mode-tag {
  display: inline-flex;
  margin: 0 0 9px;
  padding: 6px 12px;
  border-radius: 7px;
  background: var(--srt-sky-soft);
  border: 1px solid #b9dff4;
  color: #3b7799;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .04em;
}

.srt-result-main-title {
  margin: 0;
  color: var(--srt-wood);
  font-size: clamp(27px, 4vw, 42px);
  font-weight: 900;
  line-height: 1.22;
}

.srt-result-subtitle {
  margin: 10px 0 0;
  color: var(--srt-wood-soft);
  font-size: clamp(15px, 1.7vw, 19px);
  font-weight: 650;
}

.srt-parent-panel {
  flex: 1;
  padding: clamp(16px, 3vw, 34px);
}

.srt-overview-card,
.srt-panel-block,
.srt-next-card,
.srt-note-box {
  background: rgba(255,255,255,.96);
  border: 1px solid var(--srt-line);
  border-radius: 15px;
  box-shadow: 0 5px 16px rgba(108, 72, 31, .07);
}

.srt-overview-card {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 24px;
  padding: clamp(20px, 3vw, 30px);
  margin-bottom: 22px;
  border-top: 5px solid var(--srt-honey);
}

.srt-overview-left {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.srt-score-circle {
  width: 132px;
  height: 132px;
  min-width: 132px;
  border-radius: 18px;
  background: linear-gradient(160deg, #7fc9ef, var(--srt-sky));
  border: 3px solid #fff;
  outline: 1px solid #9fd5ef;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  box-shadow: 0 8px 18px rgba(57, 137, 181, .22);
}

.srt-score-number { font-size: 48px; font-weight: 900; line-height: 1; }
.srt-score-unit { font-size: 20px; font-weight: 800; align-self: flex-end; margin-bottom: 30px; }

.srt-overview-label,
.srt-card-label,
.srt-stat-label {
  margin: 0 0 7px;
  color: #8d6745;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .03em;
}

.srt-overview-title {
  margin: 0 0 10px;
  color: var(--srt-wood);
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 900;
  line-height: 1.25;
}

.srt-overview-desc,
.srt-parent-summary-text,
.srt-parent-intro,
.srt-observation-card p,
.srt-next-card p,
.srt-note-box p {
  margin: 0;
  color: #6f5743;
  font-size: clamp(15px, 1.7vw, 18px);
  font-weight: 500;
  line-height: 1.75;
}

.srt-star-summary {
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

.srt-star-row { display: flex; justify-content: center; gap: 8px; }
.srt-star-chip { color: #d9c8a7; font-size: 30px; line-height: 1; }
.srt-star-chip.is-on { color: var(--srt-honey); }
.srt-star-summary p { margin: 0; color: var(--srt-wood); font-size: 15px; font-weight: 800; }
.srt-star-summary small { color: #8a6a4d; font-size: 12px; line-height: 1.5; }

.srt-quick-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 18px 0 22px;
}

.srt-stat-card {
  min-height: 122px;
  padding: 18px;
  border-radius: 13px;
  background: #fff;
  border: 1px solid var(--srt-line);
  border-top: 4px solid var(--srt-leaf);
  box-sizing: border-box;
}
.srt-stat-card:nth-child(2) { border-top-color: var(--srt-sky); }
.srt-stat-card:nth-child(3) { border-top-color: var(--srt-honey); }
.srt-stat-card:nth-child(4) { border-top-color: var(--srt-coral); }
.srt-stat-card:nth-child(5) { border-top-color: #9d7ac1; }
.srt-stat-card:nth-child(6) { border-top-color: var(--srt-leaf); }

.srt-stat-value { margin: 0 0 7px; color: var(--srt-wood); font-size: clamp(23px, 2.5vw, 30px); font-weight: 900; }
.srt-stat-helper { margin: 0; color: #8b715b; font-size: 13px; line-height: 1.5; }

.srt-panel-block,
.srt-next-card,
.srt-note-box { padding: clamp(18px, 3vw, 28px); margin-bottom: 22px; }
.srt-section-title { margin: 0 0 12px; color: var(--srt-wood); font-size: clamp(20px, 2.4vw, 25px); font-weight: 900; }

.srt-chart-summary { border-top: 5px solid var(--srt-sky); }
.srt-collapsible-results { border: 1px solid var(--srt-line); border-radius: 20px; background: rgba(255,255,255,.76); overflow: hidden; }
.srt-collapsible-results > summary { padding: 18px 22px; color: var(--srt-wood); font-weight: 900; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
.srt-collapsible-results > summary::-webkit-details-marker { display: none; }
.srt-collapsible-results > summary::after { content: "+"; font-size: 26px; line-height: 1; }
.srt-collapsible-results[open] > summary::after { content: "−"; }
.srt-collapsible-results > summary:focus-visible { outline: 3px solid rgba(68,166,215,.35); outline-offset: -3px; }
.srt-collapsible-content { display: grid; gap: 18px; padding: 0 18px 18px; border-top: 1px solid var(--srt-line); }
.srt-collapsible-content > :first-child { margin-top: 18px; }
.srt-collapsible-content .srt-panel-block { box-shadow: none; }
.srt-section-heading-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.srt-section-heading-row .srt-section-title { margin-bottom: 0; }
.srt-section-heading-row > p,
.srt-section-kicker {
  margin: 0;
  color: #876c55;
  font-size: 14px;
  line-height: 1.6;
}
.srt-section-kicker {
  margin-bottom: 4px;
  color: #3d7898;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
}

.srt-chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr);
  gap: 16px;
}
.srt-chart-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid #dfd4c1;
  border-radius: 14px;
  background: #fffdf9;
}
.srt-chart-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}
.srt-chart-title-row h3 {
  margin: 0 0 5px;
  color: var(--srt-wood);
  font-size: 18px;
  font-weight: 900;
}
.srt-chart-title-row p,
.srt-chart-empty {
  margin: 0;
  color: #846b57;
  font-size: 13px;
  line-height: 1.55;
}
.srt-chart-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px 12px; }
.srt-chart-legend span,
.srt-distribution-list span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #755d49;
  font-size: 12px;
  font-weight: 700;
}
.srt-chart-legend i,
.srt-distribution-list i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}
.srt-chart-legend i.accuracy { background: var(--srt-leaf); }
.srt-chart-legend i.reaction { background: var(--srt-sky); }

.srt-segment-chart {
  height: 238px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  align-items: end;
  margin-top: 22px;
  padding: 16px 12px 0;
  border-bottom: 1px solid #dbcdb7;
  background: repeating-linear-gradient(to top, transparent 0, transparent 49px, rgba(218,203,181,.45) 50px);
}
.srt-segment-column { min-width: 0; text-align: center; }
.srt-segment-bars {
  height: 178px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 8px;
}
.srt-segment-bar {
  position: relative;
  width: min(35%, 46px);
  min-height: 4px;
  border-radius: 7px 7px 2px 2px;
  transition: height .3s ease;
}
.srt-segment-bar.accuracy { background: linear-gradient(180deg, #8db662, var(--srt-leaf)); }
.srt-segment-bar.reaction { background: linear-gradient(180deg, #8dd0f3, var(--srt-sky)); }
.srt-segment-bar span {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 5px);
  transform: translateX(-50%);
  color: #664d39;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}
.srt-segment-column > strong {
  display: block;
  padding: 9px 0;
  color: var(--srt-wood);
  font-size: 14px;
}
.srt-chart-empty { padding: 34px 10px; text-align: center; }

.srt-distribution-track {
  width: 100%;
  height: 30px;
  display: flex;
  overflow: hidden;
  margin: 28px 0 20px;
  border-radius: 9px;
  background: #eee6d9;
  box-shadow: inset 0 0 0 1px rgba(108,72,31,.08);
}
.srt-distribution-track span { min-width: 3px; }
.srt-distribution-list { display: grid; gap: 9px; }
.srt-distribution-list > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e7dac5;
}
.srt-distribution-list > div:last-child { border-bottom: 0; }
.srt-distribution-list strong { color: var(--srt-wood); font-size: 14px; }

.srt-highlight-grid,
.srt-indicator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.srt-indicator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.srt-observation-card {
  padding: 18px;
  border-radius: 13px;
  background: #fffdf8;
  border: 1px solid #eadcc5;
  box-sizing: border-box;
}
.srt-observation-card:nth-child(3n+1) { background: #fbfdf7; border-color: #d7e4c7; }
.srt-observation-card:nth-child(3n+2) { background: #f7fcff; border-color: #cfe7f4; }
.srt-observation-card:nth-child(3n) { background: #fff9f7; border-color: #f0d2ca; }

.srt-observation-top { display: flex; gap: 11px; align-items: flex-start; margin-bottom: 12px; }
.srt-observation-card h3,
.srt-next-card h3,
.srt-note-box h3 { margin: 0 0 7px; color: var(--srt-wood); font-size: 18px; font-weight: 800; line-height: 1.4; }

.srt-status-pill {
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
.srt-status-pill.good { background: var(--srt-leaf-soft); color: #547731; border-color: #c8dbaa; }
.srt-status-pill.watch { background: #fff5df; color: #98651f; border-color: #edcf91; }
.srt-status-pill.alert { background: var(--srt-coral-soft); color: #a15343; border-color: #efc0b6; }
.srt-status-pill.neutral { background: var(--srt-sky-soft); color: #3d7898; border-color: #c5e2f2; }

.srt-indicator-score { color: var(--srt-wood) !important; font-size: 22px !important; font-weight: 900 !important; margin-bottom: 6px !important; }
.srt-ability-track {
  height: 9px;
  overflow: hidden;
  margin: 0 0 12px;
  border-radius: 999px;
  background: #e7dfd2;
}
.srt-ability-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--srt-sky), var(--srt-leaf));
}
.srt-card-meaning { margin-top: 10px !important; padding-top: 10px; border-top: 1px solid #eadcc5; color: #7e6754 !important; font-size: 15px !important; }

.srt-next-card {
  background: linear-gradient(180deg, #f7fbf2, #eef5e6);
  border-left: 5px solid var(--srt-leaf);
}

.srt-note-box {
  background: linear-gradient(180deg, #fffaf3, #fff5e5);
  box-shadow: none;
  border-left: 5px solid var(--srt-honey);
}

.srt-action-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(16px, 3vw, 30px);
  padding: 18px clamp(16px, 3vw, 32px) 24px;
  border-top: 1px solid var(--srt-line);
  background: rgba(255,250,240,.98);
}

.srt-image-button {
  width: clamp(148px, 18vw, 220px);
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 12px;
  line-height: 0;
  cursor: pointer;
  transition: transform .16s ease, filter .16s ease;
}
.srt-image-button img { width: 100%; height: auto; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 5px 6px rgba(91,57,27,.2)); }
.srt-image-button:hover { transform: translateY(-2px); filter: brightness(1.03); }
.srt-image-button:active { transform: translateY(1px) scale(.98); }
.srt-image-button:focus-visible { outline: 3px solid rgba(101,184,232,.38); outline-offset: 4px; }

@media (max-width: 980px) {
  .srt-overview-card { flex-direction: column; }
  .srt-star-summary { flex-basis: auto; }
  .srt-quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .srt-highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .srt-chart-grid { grid-template-columns: 1fr; }
}

@media (max-width: 700px) {
  .srt-result-page { padding: 0; background-position: center top; }
  .srt-result-main-card { min-height: 100dvh; border-radius: 0; border-left: 0; border-right: 0; box-shadow: none; }
  .srt-result-header { padding: 20px 16px 17px; }
  .srt-parent-panel { padding: 14px; }
  .srt-overview-card { padding: 18px; gap: 18px; }
  .srt-overview-left { align-items: flex-start; gap: 15px; }
  .srt-score-circle { width: 96px; height: 96px; min-width: 96px; border-radius: 14px; }
  .srt-score-number { font-size: 36px; }
  .srt-score-unit { font-size: 16px; margin-bottom: 21px; }
  .srt-section-heading-row,
  .srt-chart-title-row { align-items: flex-start; flex-direction: column; }
  .srt-chart-legend { justify-content: flex-start; }
  .srt-chart-card { padding: 16px; }
  .srt-segment-chart { gap: 8px; padding-inline: 4px; }
  .srt-segment-bars { gap: 5px; }
  .srt-quick-stats,
  .srt-highlight-grid,
  .srt-indicator-grid { grid-template-columns: 1fr; }
  .srt-stat-card { min-height: auto; }
  .srt-action-btns { position: sticky; bottom: 0; z-index: 10; gap: 12px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); box-shadow: 0 -5px 14px rgba(91,57,27,.09); }
  .srt-image-button { width: min(44vw, 190px); }
}

@media (max-width: 420px) {
  .srt-overview-left { flex-direction: column; }
  .srt-score-circle { width: 100%; height: 82px; }
  .srt-score-unit { align-self: center; margin: 13px 0 0; }
  .srt-image-button { width: calc(50vw - 22px); }
}
`;

export default ResultPage_SRT;
