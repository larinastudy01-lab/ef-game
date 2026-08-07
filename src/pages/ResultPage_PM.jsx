import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import bgImage from "../asset/SRT/SRT_background.webp";
import clickSfx from "../asset/Click.mp3";
import homeBackBtn from "../asset/home/back.webp";
import homeAgainBtn from "../asset/home/again.webp";
import { calculatePMScore } from "../utils/pmScoring";

export default function ResultPage_PM() {
  const navigate = useNavigate();
  const location = useLocation();

  const routedResultState = useMemo(
    () => (location.state && typeof location.state === "object" ? location.state : {}),
    [location.state]
  );
  const resultState = useMemo(() => {
    if (Object.keys(routedResultState).length > 0) {
      return routedResultState;
    }

    return getStoredPMPageResult();
  }, [routedResultState]);

  const rawRecords = useMemo(
    () => (Array.isArray(resultState.records) ? resultState.records : []),
    [resultState.records]
  );
  const mode = resolveResultMode(resultState);
  const aiScore = toNullableFiniteNumber(resultState.aiScore);
  const aiDifficultyDecision =
    typeof resultState.aiDifficultyDecision === "string" ? resultState.aiDifficultyDecision : "";
  const aiTrainingSuggestion =
    typeof resultState.aiTrainingSuggestion === "string" ? resultState.aiTrainingSuggestion : "";
  const aiSubScores =
    resultState.aiSubScores && typeof resultState.aiSubScores === "object" ? resultState.aiSubScores : {};
  const plannedTotalRounds = toSafeNumber(
    resultState.plannedTotalRounds ?? resultState.scoring?.summary?.plannedTotalRounds,
    rawRecords.length
  );
  const clickAudioRef = useRef(null);

  const scoring = useMemo(() => {
    if (
      resultState.scoring &&
      typeof resultState.scoring === "object" &&
      resultState.scoring.summary
    ) {
      return resultState.scoring;
    }

    try {
      return calculatePMScore(rawRecords, {
        mode,
        plannedTotalRounds,
      });
    } catch (error) {
      console.warn("PM scoring failed:", error);
      return null;
    }
  }, [resultState.scoring, rawRecords, mode, plannedTotalRounds]);

  const summary = scoring?.summary || {};

  const stars = clampNumber(
    toSafeNumber(scoring?.stars ?? resultState.stars, 0),
    0,
    3
  );
  const totalLevels = toSafeNumber(summary.totalLevels, rawRecords.length);
  const correctCount = toSafeNumber(summary.correctCount, 0);
  const memorySpan = toSafeNumber(summary.memorySpan, 0);
  const accuracyPercent = clampNumber(toSafeNumber(summary.accuracyPercent, 0), 0, 100);
  const timeoutCount = toSafeNumber(summary.timeoutCount, 0);
  const averageCorrectReactionTime = toNullableFiniteNumber(
    summary.averageCorrectReactionTime
  );
  const wrongTapCount = toSafeNumber(summary.wrongTapCount, 0);
  const reactionTimeStd = toNullableFiniteNumber(summary.reactionTimeStd);
  const displayPlannedTotalRounds = toSafeNumber(
    summary.plannedTotalRounds,
    plannedTotalRounds
  );
  const totalRoundDisplay =
    displayPlannedTotalRounds > 0 && displayPlannedTotalRounds !== totalLevels
      ? `${totalLevels} / ${displayPlannedTotalRounds} 題`
      : `${totalLevels} 題`;
  const aiDecisionLabel = getAIDifficultyDecisionLabel(aiDifficultyDecision);
  const aiScoreTone =
    aiScore === null ? "normal" : aiScore >= 75 ? "good" : aiScore >= 50 ? "normal" : "watch";

  useEffect(() => {
    // 保留本次進入結果頁的來源模式，重新整理後仍能回到正確的森林入口。
    try {
      sessionStorage.setItem("pm_result_source_mode", mode);
    } catch (error) {
      console.warn("Unable to save PM source mode:", error);
    }

    clickAudioRef.current = new Audio(clickSfx);
    clickAudioRef.current.preload = "auto";

    return () => {
      if (clickAudioRef.current) {
        clickAudioRef.current.pause();
        clickAudioRef.current.currentTime = 0;
        clickAudioRef.current = null;
      }
    };
  }, [mode]);

  const pmTrainingContext = {
    stars,
    mode,
    totalLevels,
    correctCount,
    memorySpan,
    accuracyPercent,
    timeoutCount,
    averageCorrectReactionTime,
    wrongTapCount,
    reactionTimeStd,
    summary,
    resultState,
    rawRecords,
    aiTrainingSuggestion,
    aiDifficultyDecision,
  };

  const overview =
    mode === "training"
      ? buildDetailedPMTrainingOverview(pmTrainingContext)
      : buildResultOverview({
          stars,
          mode,
          totalLevels,
          correctCount,
          memorySpan,
          accuracyPercent,
          timeoutCount,
          averageCorrectReactionTime,
          wrongTapCount,
        });

  const simpleIndicators =
    mode === "training"
      ? buildDetailedPMTrainingIndicators(pmTrainingContext)
      : buildSimpleIndicators({
          memorySpan,
          accuracyPercent,
          averageCorrectReactionTime,
          timeoutCount,
          wrongTapCount,
          reactionTimeStd,
          totalLevels,
        });

  const nextSteps =
    mode === "training"
      ? buildDetailedPMTrainingNextSteps(pmTrainingContext)
      : buildNextSteps({
          stars,
          accuracyPercent,
          memorySpan,
          timeoutCount,
          wrongTapCount,
          averageCorrectReactionTime,
          totalLevels,
          mode,
          aiTrainingSuggestion,
        });

  const playClick = () => {
    const audio = clickAudioRef.current;

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const handleRetry = () => {
    playClick();
    clearPMResultCache();

    if (mode === "training") {
      navigate("/training-picture-memory", { replace: true });
    } else {
      navigate("/test-picture-memory", { replace: true });
    }
  };

  const handleBackMenu = () => {
    playClick();
    clearPMResultCache();

    const childId =
      resultState.childId ||
      resultState.child?.id ||
      resultState.currentChild?.id ||
      resolveCurrentChildId() ||
      "unassigned";

    // 只有 PM 訓練結果可以觸發帽子遊戲。
    // PM 測驗（TestPage_PM）永遠直接回森林，不參與累計與抽選。
    if (mode === "training") {
      const triggerResult = registerPMTrainingForHatGame({
        childId: String(childId),
        resultState,
      });

      if (triggerResult.shouldTrigger) {
        navigate("/hat-sticker-game", {
          replace: true,
          state: {
            childId: String(childId),
            gameId: "PM",
            sourceGameId: "PM",
            mode: "training",
            sourceMode: "training",
            fromResult: true,
            rewardSessionId: triggerResult.rewardSessionId,
            returnPath: "/game-menu",
          },
        });
        return;
      }
    }

    // 測驗模式，或本次訓練尚未達帽子遊戲觸發次數時，直接回森林。
    navigate(mode === "training" ? "/game-menu" : "/test-map", {
      replace: true,
      state: {
        mode,
        sourceMode: mode,
        entryMode: mode,
        fromResult: true,
        gameId: "PM",
      },
    });
  };

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <main style={styles.mainCard}>
          <header style={styles.header}>
            <p style={styles.modeTag}>
              {mode === "training" ? "練習結果" : "測驗結果"}
            </p>

            <h1 style={styles.title}>圖像記憶結果</h1>

            <p style={styles.subtitle}>
              這一頁整理本次圖像記憶任務的記憶表現、找圖正確率、作答速度與穩定度。
            </p>
          </header>

          <section style={styles.parentPanel}>
            <section style={styles.trainingPurposePanel}>
              <h2 style={styles.trainingPurposeTitle}>遊戲訓練目的</h2>
              <p style={styles.trainingPurposeText}>
                本遊戲透過「觀察－記憶－辨識」的過程，訓練孩子的視覺記憶能力，幫助孩子提升記住視覺資訊，以及從眾多物品中辨識目標物的能力。
              </p>
            </section>

            <section style={styles.heroCard}>
              <div style={styles.heroLeft}>
                <div style={styles.bigBadge}>🎒</div>

                <div>
                  <p style={styles.heroEyebrow}>本次整體狀態</p>
                  <h2 style={styles.heroTitle}>{overview.title}</h2>
                  <p style={styles.heroText}>{overview.message}</p>
                </div>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.starRow} aria-label={`${stars} 顆星`}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <span
                      key={index}
                      style={{
                        ...styles.star,
                        ...(index < stars ? styles.starActive : styles.starEmpty),
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <p style={styles.parentScoreNote}>星星代表本次完成表現</p>
                <p style={styles.starHint}>請搭配下方觀察重點一起看，單次結果不作為診斷依據。</p>
              </div>
            </section>

            <section style={styles.quickStats}>
              <StatCard label="完成題數" value={totalRoundDisplay} helper="本次實際完成與預計題數" />
              <StatCard label="找對圖片" value={`${correctCount} 題`} helper="答案完全正確的題數" />
              <StatCard label="最多記住" value={`${memorySpan} 個`} helper="一次最多記住幾個圖片" />
              <StatCard label="逾時題數" value={`${timeoutCount} 題`} helper="沒有在時間內完成" />
            </section>

            <PerformanceCharts
              memorySpan={memorySpan}
              accuracyPercent={accuracyPercent}
              correctCount={correctCount}
              totalLevels={totalLevels}
              timeoutCount={timeoutCount}
              wrongTapCount={wrongTapCount}
              averageCorrectReactionTime={averageCorrectReactionTime}
              reactionTimeStd={reactionTimeStd}
            />

            <details style={styles.detailsPanel}>
              <summary style={styles.detailsSummary}>查看進階指標與解讀</summary>
              <div style={styles.detailsContent}>
            {mode === "training" && aiScore !== null && (
              <section style={styles.aiPanel}>
                <div style={styles.aiHeader}>
                  <div>
                    <h2 style={styles.sectionTitle}>系統訓練分析</h2>
                    <p style={styles.aiIntro}>
                      系統根據正確率、反應時間、逾時、誤點與疲勞狀態，估算本次訓練難度是否合適。
                    </p>
                  </div>
                  <div style={{ ...styles.aiScoreBadge, ...styles.aiScoreTone(aiScoreTone) }}>
                    <span style={styles.aiScoreLabel}>訓練參考分數</span>
                    <strong style={styles.aiScoreValue}>{aiScore}</strong>
                  </div>
                </div>

                <div style={styles.aiInfoGrid}>
                  <StatCard
                    label="難度判斷"
                    value={aiDecisionLabel}
                    helper="下一次訓練可依此調整"
                  />
                  <StatCard
                    label="正確率分數"
                    value={`${toSafeNumber(aiSubScores.accuracyScore, 0)} 分`}
                    helper="主要反映是否記住圖片"
                  />
                  <StatCard
                    label="速度分數"
                    value={`${toSafeNumber(aiSubScores.reactionScore, 0)} 分`}
                    helper="反映作答速度是否合適"
                  />
                  <StatCard
                    label="注意與作答控制"
                    value={`${toSafeNumber(aiSubScores.focusScore, 0)} 分`}
                    helper="反映誤點與干擾影響"
                  />
                </div>

                <p style={styles.aiReferenceNote}>
                  此分析與分數僅供訓練調整參考，不代表醫療診斷或固定能力。
                </p>

                {aiTrainingSuggestion && (
                  <div style={styles.aiSuggestionBox}>
                    <span style={styles.suggestionIcon}>🤖</span>
                    <p style={styles.aiSuggestionText}>{aiTrainingSuggestion}</p>
                  </div>
                )}
              </section>
            )}

            <section style={styles.panel}>
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 style={styles.sectionTitle}>結果觀察重點</h2>
                  <p style={styles.parentIntro}>
                    以下將本次表現拆成記憶量、正確率、速度、注意力與穩定度，方便快速檢視。
                  </p>
                </div>
              </div>

              <div style={styles.abilityGrid}>
                {simpleIndicators.map((item) => (
                  <ObservationCard key={item.key} item={item} />
                ))}
              </div>
            </section>
              </div>
            </details>

            <section style={styles.suggestionPanel}>
              <h2 style={styles.sectionTitle}>下一步建議</h2>
              <div style={styles.suggestionList}>
                {nextSteps.map((step, index) => (
                  <div key={index} style={styles.suggestionItem}>
                    <span style={styles.suggestionIcon}>{step.icon || "•"}</span>
                    <p style={styles.suggestionText}>{step.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.noteBox}>
              <h3 style={styles.noteTitle}>結果說明</h3>
              <p style={styles.noteText}>
                這份結果是本次遊戲中的觀察紀錄，可用來了解「記圖片、找圖片、專心作答」時的狀況；不代表醫療診斷，建議搭配多次練習或其他任務一起觀察。
              </p>
            </section>
          </section>

          <footer style={styles.buttonRow}>
            <button
              type="button"
              style={styles.resultImageButton}
              onClick={handleBackMenu}
              aria-label="回到森林"
            >
              <img width={1024} height={341} src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
            </button>

            {mode === "training" && (
              <button
                type="button"
                style={styles.resultImageButton}
                onClick={handleRetry}
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

function StatCard({ label, value, helper }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statHelper}>{helper}</p>
    </div>
  );
}

function PerformanceCharts({
  memorySpan,
  accuracyPercent,
  correctCount,
  totalLevels,
  timeoutCount,
  wrongTapCount,
  averageCorrectReactionTime,
  reactionTimeStd,
}) {
  const completed = Math.max(0, toSafeNumber(totalLevels, 0));
  const correct = Math.max(0, toSafeNumber(correctCount, 0));
  const timeout = Math.max(0, toSafeNumber(timeoutCount, 0));
  const wrong = Math.max(0, toSafeNumber(wrongTapCount, 0));
  const resultTotal = Math.max(1, correct + wrong + timeout);
  const accuracy = clampNumber(toSafeNumber(accuracyPercent, 0), 0, 100);
  const memoryPercent = clampNumber((toSafeNumber(memorySpan, 0) / 6) * 100, 0, 100);
  const reactionSeconds =
    averageCorrectReactionTime === null
      ? null
      : Math.max(0, averageCorrectReactionTime / 1000);
  const reactionPercent =
    reactionSeconds === null ? 0 : clampNumber((reactionSeconds / 10) * 100, 0, 100);

  return (
    <section style={styles.chartPanel} aria-labelledby="pm-performance-title">
      <div style={styles.sectionHeaderRow}>
        <div>
          <h2 id="pm-performance-title" style={styles.sectionTitle}>本次表現圖表</h2>
          <p style={styles.parentIntro}>
            圖表整理本次的記憶量、正確率、作答狀況與反應穩定度，請搭配下方觀察重點一起看。
          </p>
        </div>
      </div>

      <div style={styles.chartGrid}>
        <MetricBar
          label="記憶量"
          value={`${memorySpan} 個圖片`}
          percent={memoryPercent}
          helper="本次最多一次記住幾個圖片"
          tone="memory"
        />
        <MetricBar
          label="找圖正確率"
          value={`${accuracy}%`}
          percent={accuracy}
          helper="答案完全正確的題目比例"
          tone="accuracy"
        />

        <article style={styles.chartCard}>
          <div style={styles.chartTitleRow}>
            <h3 style={styles.chartTitle}>作答結果分布</h3>
            <strong style={styles.chartValue}>{completed} 題</strong>
          </div>
          <div style={styles.stackedBar} aria-label={`答對 ${correct} 題，選錯 ${wrong} 題，逾時 ${timeout} 題`}>
            <span style={styles.stackedPart("#62b892", (correct / resultTotal) * 100)} />
            <span style={styles.stackedPart("#f3b45b", (wrong / resultTotal) * 100)} />
            <span style={styles.stackedPart("#d88972", (timeout / resultTotal) * 100)} />
          </div>
          <div style={styles.legendRow}>
            <ChartLegend color="#62b892" label={`答對 ${correct}`} />
            <ChartLegend color="#f3b45b" label={`選錯 ${wrong}`} />
            <ChartLegend color="#d88972" label={`逾時 ${timeout}`} />
          </div>
        </article>

        <article style={styles.chartCard}>
          <div style={styles.chartTitleRow}>
            <h3 style={styles.chartTitle}>反應與穩定度</h3>
            <strong style={styles.chartValue}>
              {reactionSeconds === null ? "資料不足" : `${reactionSeconds.toFixed(1)} 秒`}
            </strong>
          </div>
          <div style={styles.reactionTrack}>
            <span style={styles.reactionGoodZone} />
            {reactionSeconds !== null && <span style={styles.reactionMarker(reactionPercent)} />}
          </div>
          <div style={styles.reactionScale}><span>0 秒</span><span>3.5 秒</span><span>7.5 秒</span><span>10 秒以上</span></div>
          <p style={styles.chartHelper}>
            {reactionSeconds === null
              ? "目前沒有足夠的正確作答時間資料。"
              : `答對題平均約 ${reactionSeconds.toFixed(1)} 秒，反應起伏 ${
                  reactionTimeStd === null ? "資料不足" : `${(reactionTimeStd / 1000).toFixed(1)} 秒`
                }。`}
          </p>
        </article>
      </div>
    </section>
  );
}

function MetricBar({ label, value, percent, helper, tone }) {
  return (
    <article style={styles.chartCard}>
      <div style={styles.chartTitleRow}>
        <h3 style={styles.chartTitle}>{label}</h3>
        <strong style={styles.chartValue}>{value}</strong>
      </div>
      <div style={styles.metricTrack}>
        <span style={styles.metricFill(percent, tone)} />
      </div>
      <p style={styles.chartHelper}>{helper}</p>
    </article>
  );
}

function ChartLegend({ color, label }) {
  return <span style={styles.legendItem}><i style={styles.legendDot(color)} />{label}</span>;
}

function ObservationCard({ item }) {
  return (
    <article style={styles.abilityCard}>
      <div style={styles.abilityTop}>
        <div style={styles.abilityHeading}>
          <p style={styles.abilityLabel}>{item.title}</p>
          <p style={styles.abilityQuestion}>{item.question}</p>
        </div>
      </div>

      <div style={styles.statusPill(item.tone)}>{item.status}</div>

      <p style={styles.abilityDescription}>{item.description}</p>
      <p style={styles.abilityMeaning}>{item.meaning}</p>
    </article>
  );
}

function toSafeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNullableFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function safeJsonParse(raw, fallback = null) {
  if (!raw || typeof raw !== "string") return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function readStorageValue(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function getStoredObjectByKeys(keys = []) {
  for (const key of keys) {
    const parsed = safeJsonParse(readStorageValue(key), null);

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }

  return null;
}

function resolveCurrentChildId() {
  const possibleKeys = [
    "currentChildId",
    "selectedChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of possibleKeys) {
    const value = readStorageValue(key);
    if (value) return value;
  }

  const currentChild =
    safeJsonParse(readStorageValue("currentChild"), null) ||
    safeJsonParse(readStorageValue("selectedChild"), null) ||
    safeJsonParse(readStorageValue("activeChild"), null);

  return currentChild?.id || currentChild?.childId || currentChild?.profileId || null;
}

function getSavedPMMode() {
  try {
    const savedMode = sessionStorage.getItem("pm_result_source_mode");
    if (savedMode === "training" || savedMode === "test") {
      return savedMode;
    }
  } catch (error) {
    console.warn("Unable to read PM source mode:", error);
  }

  return null;
}

function getStoredPMPageResult() {
  const childId = resolveCurrentChildId();
  const trainingResult = getStoredObjectByKeys([
    "latestPMTrainingResult",
    "pmTrainingResult",
  ]);
  const testResult = getStoredObjectByKeys([
    ...(childId ? [`pmTestResult_${childId}`] : []),
    "latestPMTestResult",
    "pmTestResult",
    "PMTestResult",
    "pictureMemoryTestResult",
    "result_picture_memory_test",
    "ef_game_pm_test_result",
  ]);
  const savedMode = getSavedPMMode();

  if (savedMode === "training") return trainingResult || testResult || {};
  if (savedMode === "test") return testResult || trainingResult || {};

  return pickLatestResult([trainingResult, testResult]) || trainingResult || testResult || {};
}

function pickLatestResult(results = []) {
  const validResults = results.filter(Boolean);

  if (validResults.length === 0) return null;

  return validResults.reduce((latest, current) => {
    const latestTime = getResultTimestamp(latest);
    const currentTime = getResultTimestamp(current);
    return currentTime > latestTime ? current : latest;
  }, validResults[0]);
}

function getResultTimestamp(result) {
  const rawTime =
    result?.createdAt ||
    result?.endedAt ||
    result?.completedAt ||
    result?.generatedAt ||
    result?.scoring?.generatedAt;
  const timestamp = rawTime ? Date.parse(rawTime) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}


const HAT_TRIGGER_MIN_COMPLETIONS = 5;
const HAT_TRIGGER_MAX_COMPLETIONS = 8;

function createHatRewardSessionId(childId) {
  return `PM-${childId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPMResultIdentity(resultState = {}) {
  const explicitId =
    resultState.resultId ||
    resultState.sessionId ||
    resultState.trainingSessionId ||
    resultState.id;

  if (explicitId) return String(explicitId);

  const timestamp =
    resultState.completedAt ||
    resultState.endedAt ||
    resultState.createdAt ||
    resultState.generatedAt ||
    resultState.scoring?.generatedAt;

  if (timestamp) return `PM-${timestamp}`;

  const records = Array.isArray(resultState.records) ? resultState.records : [];
  const firstRecordTime =
    records[0]?.startedAt ||
    records[0]?.timestamp ||
    records[0]?.startTime ||
    "unknown";
  const lastRecordTime =
    records[records.length - 1]?.endedAt ||
    records[records.length - 1]?.timestamp ||
    records[records.length - 1]?.endTime ||
    "unknown";

  return `PM-${records.length}-${firstRecordTime}-${lastRecordTime}`;
}

function getRandomHatTriggerTarget() {
  const range = HAT_TRIGGER_MAX_COMPLETIONS - HAT_TRIGGER_MIN_COMPLETIONS + 1;
  return HAT_TRIGGER_MIN_COMPLETIONS + Math.floor(Math.random() * range);
}

function registerPMTrainingForHatGame({ childId, resultState }) {
  const safeChildId = childId || "unassigned";
  const progressKey = `hatRewardProgress_${safeChildId}`;
  const handledKey = `hatRewardHandled_PM_${safeChildId}`;
  const resultIdentity = createPMResultIdentity(resultState);

  try {
    const handledResults = safeJsonParse(localStorage.getItem(handledKey), []);
    const handledList = Array.isArray(handledResults) ? handledResults : [];

    // 同一筆結果只處理一次，避免重新整理或重複點擊造成重複累計。
    if (handledList.includes(resultIdentity)) {
      return { shouldTrigger: false, rewardSessionId: null };
    }

    const savedProgress = safeJsonParse(localStorage.getItem(progressKey), {});
    const previousCount = Math.max(0, toSafeNumber(savedProgress?.count, 0));
    const target = clampNumber(
      toSafeNumber(savedProgress?.target, getRandomHatTriggerTarget()),
      HAT_TRIGGER_MIN_COMPLETIONS,
      HAT_TRIGGER_MAX_COMPLETIONS
    );
    const nextCount = previousCount + 1;
    const shouldTrigger = nextCount >= target;
    const nextProgress = shouldTrigger
      ? {
          count: 0,
          target: getRandomHatTriggerTarget(),
          lastTriggeredAt: new Date().toISOString(),
          lastSourceGameId: "PM",
        }
      : {
          count: nextCount,
          target,
          updatedAt: new Date().toISOString(),
          lastSourceGameId: "PM",
        };

    localStorage.setItem(progressKey, JSON.stringify(nextProgress));
    localStorage.setItem(
      handledKey,
      JSON.stringify([...handledList.slice(-49), resultIdentity])
    );

    return {
      shouldTrigger,
      rewardSessionId: shouldTrigger
        ? createHatRewardSessionId(safeChildId)
        : null,
    };
  } catch (error) {
    console.warn("Unable to update PM hat-game progress:", error);
    return { shouldTrigger: false, rewardSessionId: null };
  }
}

function clearPMResultCache() {
  const cacheKeys = [
    "pm_records",
    "pm_test_records",
    "pm_training_records",
    "pm_current_records",
    "pm_answer_cache",
    "pictureMemoryRecords",
    "pictureMemoryTestRecords",
    "pictureMemoryTrainingRecords",
    "pm_answer_sequence",
    "pm_current_round",
    "pm_temp_result",
  ];

  cacheKeys.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to remove session cache: ${key}`, error);
    }
  });
}

function resolveResultMode(resultState) {
  const stateMode =
    resultState?.mode ||
    resultState?.sourceMode ||
    resultState?.entryMode ||
    resultState?.fromMode;

  if (stateMode === "training" || stateMode === "test") {
    return stateMode;
  }

  const savedMode = getSavedPMMode();
  if (savedMode) return savedMode;

  return "test";
}

function getPMDetailedStars(context = {}) {
  const stars = toSafeNumber(context.stars, 0);
  if (stars > 0) return clampNumber(stars, 1, 3);
  if (toSafeNumber(context.totalLevels, 0) <= 0) return 0;

  const accuracyPercent = toSafeNumber(context.accuracyPercent, 0);
  const memorySpan = toSafeNumber(context.memorySpan, 0);
  const timeoutCount = toSafeNumber(context.timeoutCount, 0);
  const wrongTapCount = toSafeNumber(context.wrongTapCount, 0);

  if (accuracyPercent >= 85 && memorySpan >= 5 && timeoutCount === 0 && wrongTapCount <= 1) {
    return 3;
  }

  if (accuracyPercent >= 60 && memorySpan >= 3) return 2;
  return 1;
}

function getPMDifficultyLevelFromContext(context = {}) {
  const explicitLevel =
    context.resultState?.difficultyLevel ??
    context.resultState?.currentDifficultyLevel ??
    context.resultState?.trainingDifficultyLevel ??
    context.summary?.difficultyLevel ??
    context.summary?.highestSuccessfulDifficulty;

  if (Number.isFinite(Number(explicitLevel)) && Number(explicitLevel) > 0) {
    return Math.round(Number(explicitLevel));
  }

  const recordLevels = Array.isArray(context.rawRecords)
    ? context.rawRecords
        .map(
          (record) =>
            Number(
              record?.difficultyLevel ??
                record?.internalDifficulty ??
                record?.difficultyValue
            )
        )
        .filter((level) => Number.isFinite(level) && level > 0)
    : [];

  if (recordLevels.length > 0) return Math.max(...recordLevels);

  const memorySpan = toSafeNumber(context.memorySpan, 0);
  if (memorySpan >= 5) return 5;
  if (memorySpan >= 3) return 3;
  return 1;
}

function getPMDetailedLevelInfo(context = {}) {
  const level = getPMDifficultyLevelFromContext(context);
  const label =
    context.resultState?.difficultyLabel ||
    context.resultState?.trainingDifficultyLabel ||
    context.summary?.difficultyLabel ||
    `Level ${level}`;

  if (level >= 5) {
    return {
      level,
      group: "advanced",
      label,
      title: "進階圖片記憶層級",
      meaning:
        "這一層會同時增加圖片數量、記憶負荷與搜尋壓力，孩子需要把剛看過的圖片保留在腦中，再從選項中穩定找回來。",
    };
  }

  if (level >= 3) {
    return {
      level,
      group: "middle",
      label,
      title: "穩定圖片記憶層級",
      meaning:
        "這一層開始要求孩子記住多個圖片，並在短時間內把記憶和眼前選項配對，重點是正確率與穩定搜尋。",
    };
  }

  return {
    level,
    group: "basic",
    label,
    title: "基礎圖片記憶層級",
    meaning:
      "這一層主要在建立「看過、記住、再找回」的基本流程，重點是讓孩子熟悉規則並累積成功經驗。",
  };
}

function getPMDetailedStarInfo(stars) {
  if (stars >= 3) {
    return {
      title: "目前層級表現穩定",
      meaning:
        "孩子在這個層級已能穩定記住並找回圖片，可以開始觀察是否準備好接受更多圖片或更高層級的挑戰。",
    };
  }

  if (stars === 2) {
    return {
      title: "記憶能力正在出現，但還需要穩定",
      meaning:
        "孩子已能完成一部分圖片記憶任務，但遇到圖片變多、選項相似或時間拉長時，表現可能會起伏。",
    };
  }

  if (stars === 1) {
    return {
      title: "仍需要較多熟悉與支持",
      meaning:
        "孩子目前可能還在適應圖片記憶流程，建議先降低速度壓力，用短回合練習看過後再找回。",
    };
  }

  return {
    title: "資料仍在累積",
    meaning: "這次資料不足，建議再完成一次練習後一起觀察。",
  };
}

function getPMDetailedProfile(context = {}) {
  const totalLevels = Math.max(1, toSafeNumber(context.totalLevels, 0));
  const memorySpan = toSafeNumber(context.memorySpan, 0);
  const accuracyPercent = toSafeNumber(context.accuracyPercent, 0);
  const timeoutCount = toSafeNumber(context.timeoutCount, 0);
  const wrongTapCount = toSafeNumber(context.wrongTapCount, 0);
  const reactionTimeStd = toNullableFiniteNumber(context.reactionTimeStd);
  const averageCorrectReactionTime = toNullableFiniteNumber(context.averageCorrectReactionTime);
  const summary = context.summary || {};
  const timeoutRate =
    Number.isFinite(Number(summary.timeoutRate)) && Number(summary.timeoutRate) <= 1
      ? Number(summary.timeoutRate)
      : timeoutCount / totalLevels;
  const wrongTapRate =
    Number.isFinite(Number(summary.wrongTapRate)) && Number(summary.wrongTapRate) <= 1
      ? Number(summary.wrongTapRate)
      : wrongTapCount / totalLevels;
  const deselectRate = Number.isFinite(Number(summary.deselectRate))
    ? Number(summary.deselectRate)
    : 0;

  if (toSafeNumber(context.totalLevels, 0) <= 0) {
    return {
      key: "no_data",
      status: "資料不足",
      tone: "normal",
      title: "這次還沒有足夠練習資料",
      question: "是否有完成足夠題目？",
      description: "目前題數不足，還不適合解讀記憶廣度或反應穩定度。",
      meaning: "建議再完成一次完整練習，讓結果更能代表孩子的狀態。",
      advice: "下一次先使用較低層級，確認孩子理解玩法後再開始正式紀錄。",
    };
  }

  if (timeoutRate >= 0.3 || timeoutCount >= 2) {
    return {
      key: "timeout_high",
      status: "逾時偏多",
      tone: "watch",
      title: "看過圖片後，作答時間比較容易不夠",
      question: "孩子是忘記了，還是來不及找？",
      description:
        "孩子可能有嘗試回想圖片，但在搜尋選項或做出決定時花了較多時間，因此出現逾時。",
      meaning:
        "這通常代表目前圖片數或搜尋壓力偏高，孩子需要更穩定的看圖策略與作答節奏。",
      advice:
        "下一次建議維持或降低一階，先練習看完後說出或指認關鍵特徵，再開始選答案。",
    };
  }

  if (wrongTapRate >= 0.3 || wrongTapCount >= 3) {
    return {
      key: "wrong_tap_high",
      status: "誤點偏多",
      tone: "watch",
      title: "記得方向大致存在，但選擇時容易點錯",
      question: "孩子是否太快選，或被相似圖片干擾？",
      description:
        "孩子可能有保留部分圖片印象，但遇到相似選項時，容易還沒確認完整就先點選。",
      meaning:
        "這比較像視覺搜尋與確認策略需要加強，不一定只是記不住。",
      advice:
        "下一次先提醒孩子「看完全部選項再點」，重點放在確認，而不是加快速度。",
    };
  }

  if (deselectRate >= 0.3) {
    return {
      key: "hesitant",
      status: "反覆確認",
      tone: "normal",
      title: "會反覆檢查，作答較猶豫",
      question: "孩子是否知道答案，但不太敢確定？",
      description:
        "孩子可能有記住圖片，但在選答案時會反覆取消或重新選擇，顯示信心與決策穩定度仍在建立。",
      meaning:
        "這種型態可以先鼓勵孩子說出選擇理由，幫助他把記憶線索變得更清楚。",
      advice:
        "下一次可維持目前層級，讓孩子每題先找一個最確定的圖片，再慢慢完成其餘選項。",
    };
  }

  if (memorySpan < 3 && accuracyPercent < 65) {
    return {
      key: "low_span",
      status: "負荷偏高",
      tone: "watch",
      title: "圖片數增加後，記憶負荷比較吃力",
      question: "一次記住幾個圖片最穩？",
      description:
        "孩子在少量圖片時可能可以完成，但圖片數一增加，正確率就比較容易下降。",
      meaning:
        "目前適合先把少量圖片的記憶流程練穩，再慢慢增加圖片數。",
      advice:
        "下一次建議從 2 到 3 個圖片開始，穩定後再提高到更多圖片。",
    };
  }

  if (
    averageCorrectReactionTime !== null &&
    averageCorrectReactionTime > 7500 &&
    accuracyPercent >= 60
  ) {
    return {
      key: "slow_but_accurate",
      status: "慢但準",
      tone: "good",
      title: "作答速度較慢，但找回品質不錯",
      question: "孩子是否需要較多時間確認？",
      description:
        "孩子可能會花時間回想與比對圖片，但最後仍能找對，代表記憶線索是存在的。",
      meaning:
        "這是可以接受的發展型態，下一步才是慢慢縮短搜尋時間。",
      advice:
        "下一次可維持同層級，讓孩子先保持正確，再用輕鬆方式練習稍微快一點。",
    };
  }

  if (reactionTimeStd !== null && reactionTimeStd > 3000) {
    return {
      key: "unstable_speed",
      status: "起伏較大",
      tone: "normal",
      title: "有些題很快，有些題突然慢下來",
      question: "反應是否受到圖片難度或注意力影響？",
      description:
        "孩子不是完全不會，而是反應速度不夠平均，可能受圖片相似度、疲勞或注意力波動影響。",
      meaning:
        "這代表能力已經出現，但需要更多穩定練習。",
      advice:
        "下一次建議維持目前層級，觀察慢下來的題目是否有相似特徵。",
    };
  }

  if (accuracyPercent >= 85 && memorySpan >= 5) {
    return {
      key: "balanced",
      status: "穩定",
      tone: "good",
      title: "記住、搜尋與作答都相對穩定",
      question: "孩子是否能自己完成多數題目？",
      description:
        "孩子能保留圖片記憶，也能在選項中找回正確圖片，整體表現平衡。",
      meaning:
        "目前層級對孩子來說已經接近穩定，可以考慮小幅提高挑戰。",
      advice:
        "下一次可先維持同層級確認一次，若仍穩定，再增加圖片數或提高層級。",
    };
  }

  return {
    key: "developing",
    status: "練習中",
    tone: "normal",
    title: "圖片記憶能力正在累積",
    question: "這次表現最需要穩定哪一塊？",
    description:
      "這次沒有單一特別突出的錯誤型態，孩子可能正在熟悉看圖、記住與找回的流程。",
    meaning:
      "建議累積多次結果後，再看是否固定出現同樣狀況。",
    advice:
      "下一次先維持目前層級，觀察正確率、逾時與誤點是否逐漸穩定。",
  };
}

function buildDetailedPMTrainingOverview(context = {}) {
  const stars = getPMDetailedStars(context);
  const levelInfo = getPMDetailedLevelInfo(context);
  const starInfo = getPMDetailedStarInfo(stars);
  const profile = getPMDetailedProfile(context);
  const totalLevels = toSafeNumber(context.totalLevels, 0);
  const correctCount = toSafeNumber(context.correctCount, 0);
  const memorySpan = toSafeNumber(context.memorySpan, 0);
  const accuracyPercent = toSafeNumber(context.accuracyPercent, 0);

  if (totalLevels === 0) {
    return {
      title: profile.title,
      message: profile.meaning,
    };
  }

  return {
    title: `${levelInfo.title}，${stars} 星：${profile.title}`,
    message:
      `這次屬於「${levelInfo.label}」訓練。${levelInfo.meaning} ` +
      `本次完成 ${totalLevels} 題、找對 ${correctCount} 題、最多一次記住 ${memorySpan} 個圖片，正確率約 ${accuracyPercent}%。` +
      ` ${starInfo.meaning} 主要型態是「${profile.title}」：${profile.meaning}`,
  };
}

function buildDetailedPMTrainingIndicators(context = {}) {
  const stars = getPMDetailedStars(context);
  const levelInfo = getPMDetailedLevelInfo(context);
  const starInfo = getPMDetailedStarInfo(stars);
  const profile = getPMDetailedProfile(context);
  const totalLevels = Math.max(1, toSafeNumber(context.totalLevels, 0));
  const memorySpan = toSafeNumber(context.memorySpan, 0);
  const accuracyPercent = toSafeNumber(context.accuracyPercent, 0);
  const timeoutCount = toSafeNumber(context.timeoutCount, 0);
  const wrongTapCount = toSafeNumber(context.wrongTapCount, 0);
  const reactionTimeStd = toNullableFiniteNumber(context.reactionTimeStd);
  const averageCorrectReactionTime = toNullableFiniteNumber(context.averageCorrectReactionTime);
  const summary = context.summary || {};
  const timeoutRate = Number.isFinite(Number(summary.timeoutRate))
    ? Number(summary.timeoutRate)
    : timeoutCount / totalLevels;
  const wrongTapRate = Number.isFinite(Number(summary.wrongTapRate))
    ? Number(summary.wrongTapRate)
    : wrongTapCount / totalLevels;

  return [
    {
      key: "level",
      title: levelInfo.title,
      question: `目前層級：${levelInfo.label}`,
      status: levelInfo.group === "advanced" ? "進階" : levelInfo.group === "middle" ? "穩定" : "基礎",
      tone: "normal",
      description: levelInfo.meaning,
      meaning: "家長可以把這一格當成任務負荷說明：層級越高，圖片數、搜尋壓力與記憶保持要求越高。",
    },
    {
      key: "stars",
      title: starInfo.title,
      question: "星星代表這個層級的完成品質",
      status: stars > 0 ? `${stars} 星` : "資料不足",
      tone: stars >= 3 ? "good" : stars === 2 ? "normal" : "watch",
      description: starInfo.meaning,
      meaning: "同樣星數在不同層級代表不同意義，所以要和目前層級一起看。",
    },
    {
      key: "profile",
      title: profile.title,
      question: profile.question,
      status: profile.status,
      tone: profile.tone,
      description: profile.description,
      meaning: profile.meaning,
    },
    {
      key: "memory",
      title: "記憶廣度",
      question: "一次最多能穩定記住幾個圖片？",
      status: memorySpan >= 5 ? "穩定" : memorySpan >= 3 ? "建立中" : "需支持",
      tone: memorySpan >= 5 ? "good" : memorySpan >= 3 ? "normal" : "watch",
      description: `這次最多一次記住 ${memorySpan} 個圖片，正確率約 ${accuracyPercent}%。`,
      meaning:
        memorySpan >= 5
          ? "孩子已能處理較多圖片的記憶負荷。"
          : memorySpan >= 3
          ? "孩子已能記住部分圖片，但圖片數增加時仍需要穩定。"
          : "目前可先從少量圖片練起，讓孩子熟悉看過後再找回的流程。",
    },
    {
      key: "errors",
      title: "作答錯誤型態",
      question: "是來不及、點錯，還是兩者都有？",
      status:
        timeoutRate >= 0.3
          ? "逾時"
          : wrongTapRate >= 0.3
          ? "誤點"
          : "穩定",
      tone: timeoutRate >= 0.3 || wrongTapRate >= 0.3 ? "watch" : "good",
      description: `這次逾時 ${timeoutCount} 題，誤點 ${wrongTapCount} 次。`,
      meaning:
        timeoutRate >= 0.3
          ? "逾時偏多時，下一步通常是降低搜尋壓力或延長確認時間。"
          : wrongTapRate >= 0.3
          ? "誤點偏多時，下一步通常是練習看完全部選項後再決定。"
          : "逾時與誤點都不高，代表作答流程相對穩定。",
    },
    {
      key: "speed",
      title: "反應與穩定度",
      question: "孩子找回圖片的速度是否平均？",
      status:
        averageCorrectReactionTime === null
          ? "資料不足"
          : reactionTimeStd !== null && reactionTimeStd > 3000
          ? "起伏"
          : "可觀察",
      tone:
        reactionTimeStd !== null && reactionTimeStd > 3000
          ? "normal"
          : "good",
      description:
        averageCorrectReactionTime === null
          ? "目前沒有足夠正確作答反應時間。"
          : `正確作答平均約 ${formatSeconds(averageCorrectReactionTime)} 秒，反應起伏 ${
              reactionTimeStd === null ? "資料不足" : `${(reactionTimeStd / 1000).toFixed(1)} 秒`
            }。`,
      meaning:
        reactionTimeStd !== null && reactionTimeStd > 3000
          ? "速度起伏較大時，可以觀察是否特定圖片數或相似選項讓孩子卡住。"
          : "速度若穩定，通常代表孩子有較固定的搜尋與確認策略。",
    },
  ];
}

function buildDetailedPMTrainingNextSteps(context = {}) {
  const stars = getPMDetailedStars(context);
  const levelInfo = getPMDetailedLevelInfo(context);
  const profile = getPMDetailedProfile(context);
  const aiTrainingSuggestion =
    typeof context.aiTrainingSuggestion === "string" ? context.aiTrainingSuggestion : "";
  const steps = [];

  if (aiTrainingSuggestion) {
    steps.push({
      icon: "AI",
      text: aiTrainingSuggestion,
    });
  }

  if (profile.key === "balanced" && stars >= 3) {
    steps.push({
      text: `孩子在「${levelInfo.label}」表現穩定。下一次可以先維持同層級確認一次，若仍穩定，再小幅增加圖片數或提高層級。`,
    });
  } else if (stars <= 1 || profile.tone === "watch") {
    steps.push({
      text: profile.advice,
    });
    steps.push({
      text: "先不要急著提高難度，讓孩子在目前或低一階層級累積成功經驗，會比追求更高層級更有幫助。",
    });
  } else {
    steps.push({
      text: profile.advice,
    });
    steps.push({
      text: "建議累積 2 到 3 次同層級結果，再判斷是否提高層級或增加圖片數。",
    });
  }

  if (steps.length === 0) {
    steps.push({
      text: "下一次先維持目前層級，觀察正確率、逾時與誤點是否逐漸穩定。",
    });
  }

  return steps.slice(0, 3);
}

function buildResultOverview({
  stars,
  mode,
  totalLevels,
  correctCount,
  memorySpan,
  accuracyPercent,
  timeoutCount,
  averageCorrectReactionTime,
  wrongTapCount,
}) {
  if (totalLevels === 0) {
    return {
      title: "目前資料還不夠",
      message: "建議先完成一次圖像記憶任務，再回來查看記憶與作答狀況。",
    };
  }

  const modeText = mode === "training" ? "這次練習" : "這次測驗";
  const rtText =
    averageCorrectReactionTime === null
      ? ""
      : `，答對題平均約 ${formatSeconds(averageCorrectReactionTime)} 秒完成`;

  if (stars >= 3) {
    return {
      title: "本次表現穩定",
      message: `${modeText}完成 ${totalLevels} 題、找對 ${correctCount} 題，最多可以記住 ${memorySpan} 個圖片${rtText}。整體來看，能記住圖片並找回正確答案。`,
    };
  }

  if (stars === 2) {
    return {
      title: "已經能完成任務，可以再練得更穩",
      message: `${modeText}完成 ${totalLevels} 題、找對 ${correctCount} 題，正確率約 ${accuracyPercent}%。能記住部分圖片，但遇到圖片變多、時間較短或選項較多時，可能會比較吃力。`,
    };
  }

  if (timeoutCount > 0 || wrongTapCount > 0) {
    return {
      title: "已完成任務，建議先放慢難度",
      message: `${modeText}有出現逾時或誤點的情況。這通常代表可能需要更多時間看清楚、回想圖片，或先熟悉「先看、再找」的流程。`,
    };
  }

  return {
    title: "已完成任務，建議持續觀察",
    message: `${modeText}完成 ${totalLevels} 題。可以再多進行幾次，觀察在不同圖片數量下是否能穩定找對。`,
  };
}

function buildSimpleIndicators({
  memorySpan,
  accuracyPercent,
  averageCorrectReactionTime,
  timeoutCount,
  wrongTapCount,
  reactionTimeStd,
  totalLevels,
}) {
  const timeoutRate = totalLevels > 0 ? timeoutCount / totalLevels : 0;
  const wrongTapRate = totalLevels > 0 ? wrongTapCount / totalLevels : 0;

  return [
    {
      key: "remember",
      title: "記不記得圖片",
      question: "看完後，能記住多少圖片？",
      status:
        memorySpan >= 5
          ? "表現穩定"
          : memorySpan >= 3
          ? "還不錯"
          : "可以慢慢練",
      tone: memorySpan >= 5 ? "good" : memorySpan >= 3 ? "normal" : "watch",
      description:
        memorySpan > 0
          ? `這次最多一次記住 ${memorySpan} 個圖片。`
          : "目前還沒有足夠資料判斷最多能記住幾個圖片。",
      meaning:
        memorySpan >= 5
          ? "代表可以處理較多圖片，之後可以逐步增加挑戰。"
          : memorySpan >= 3
          ? "代表已經能記住部分圖片，可以透過練習慢慢增加數量。"
          : "建議先從少量圖片開始，先熟悉記住圖片的方法。",
    },
    {
      key: "find",
      title: "有沒有找對圖片",
      question: "圖片消失後，是否能找回正確答案？",
      status:
        accuracyPercent >= 85
          ? "大多能找對"
          : accuracyPercent >= 60
          ? "有時會漏掉或選錯"
          : "需要更多練習",
      tone:
        accuracyPercent >= 85 ? "good" : accuracyPercent >= 60 ? "normal" : "watch",
      description: `這次正確率約 ${accuracyPercent}%。`,
      meaning:
        accuracyPercent >= 85
          ? "代表能把剛剛看到的圖片和作答選項連起來。"
          : accuracyPercent >= 60
          ? "代表已經抓到規則，但圖片變多時可能還需要更多回想時間。"
          : "可能是圖片數量太多、看圖時間不足，或還不熟悉遊戲流程。",
    },
    {
      key: "time",
      title: "找答案花多久",
      question: "是很快找到，還是需要比較久回想？",
      status:
        averageCorrectReactionTime === null
          ? "資料不足"
          : averageCorrectReactionTime <= 3500
          ? "找得很快"
          : averageCorrectReactionTime <= 7500
          ? "速度穩定"
          : "需要較多時間",
      tone:
        averageCorrectReactionTime === null
          ? "normal"
          : averageCorrectReactionTime <= 7500
          ? "good"
          : "watch",
      description:
        averageCorrectReactionTime === null
          ? "目前答對題的作答時間資料不足。"
          : `答對題平均約 ${formatSeconds(averageCorrectReactionTime)} 秒完成。`,
      meaning:
        averageCorrectReactionTime === null
          ? "建議完成更多題目後再觀察。"
          : averageCorrectReactionTime <= 7500
          ? "代表能在合理時間內回想並找出答案。"
          : "代表可能需要比較多時間回想，不一定是不會，可能只是需要慢一點。",
    },
    {
      key: "attention",
      title: "有沒有亂點或逾時",
      question: "作答時是否太急、點錯，或時間不夠？",
      status:
        timeoutRate >= 0.3 || wrongTapRate >= 0.5
          ? "需要觀察"
          : timeoutRate > 0 || wrongTapCount > 0
          ? "有一點波動"
          : "過程穩定",
      tone:
        timeoutRate >= 0.3 || wrongTapRate >= 0.5
          ? "watch"
          : timeoutRate > 0 || wrongTapCount > 0
          ? "normal"
          : "good",
      description: `這次有 ${timeoutCount} 題逾時，誤點 ${wrongTapCount} 次。`,
      meaning:
        timeoutRate >= 0.3
          ? "可能需要更長的作答時間，或在作答前先慢慢看。"
          : wrongTapRate >= 0.5
          ? "可能比較急著點，建議先看清楚再選。"
          : timeoutCount > 0 || wrongTapCount > 0
          ? "有少量波動是正常的，可以再觀察是否常常發生。"
          : "代表作答時較能維持注意力，也比較少衝動點擊。",
    },
    {
      key: "steady",
      title: "每一題穩不穩",
      question: "每題表現差不多，還是忽快忽慢？",
      status:
        reactionTimeStd === null
          ? "資料不足"
          : reactionTimeStd <= 1500
          ? "很穩定"
          : reactionTimeStd <= 3000
          ? "有些波動"
          : "波動較大",
      tone:
        reactionTimeStd === null
          ? "normal"
          : reactionTimeStd <= 1500
          ? "good"
          : reactionTimeStd <= 3000
          ? "normal"
          : "watch",
      description:
        reactionTimeStd === null
          ? "目前題數較少，還不適合判斷穩定度。"
          : reactionTimeStd <= 1500
          ? "各題作答時間差距不大。"
          : reactionTimeStd <= 3000
          ? "有些題目比較快，有些題目需要久一點。"
          : "不同題目的作答時間差距比較明顯。",
      meaning:
        reactionTimeStd === null
          ? "可以完成更多題目後再看。"
          : reactionTimeStd <= 1500
          ? "代表作答節奏穩定。"
          : reactionTimeStd <= 3000
          ? "可能和圖片數量、干擾選項或當下專心程度有關。"
          : "建議先降低難度，觀察在簡單題是否也會忽快忽慢。",
    },
  ];
}

function buildNextSteps({
  stars,
  accuracyPercent,
  memorySpan,
  timeoutCount,
  wrongTapCount,
  averageCorrectReactionTime,
  totalLevels,
  mode,
  aiTrainingSuggestion,
}) {
  if (totalLevels === 0) {
    return [
      {
        text: "先完成一次圖像記憶任務，系統就能產生更完整的結果觀察。",
      },
    ];
  }

  const steps = [];

  if (mode === "training" && aiTrainingSuggestion) {
    steps.push({
      icon: "🤖",
      text: aiTrainingSuggestion,
    });
  }

  if (accuracyPercent < 60) {
    steps.push({
      text: "下次可以先選擇較簡單的練習，先熟悉「先記住、再找出來」的流程。",
    });
  }

  if (memorySpan < 3) {
    steps.push({
      text: "可以從 2～3 個圖片開始，可以先說出剛剛看到了什麼，再進入作答。",
    });
  }

  if (timeoutCount > 0) {
    steps.push({
      text: "如果常常逾時，先不要急著變快，可以讓他慢慢回想，等穩定後再縮短時間。",
    });
  }

  if (wrongTapCount > 0) {
    steps.push({
      text: "如果有誤點，作答前可以先看清楚每個選項，再點選答案。",
    });
  }

  if (
    averageCorrectReactionTime !== null &&
    averageCorrectReactionTime > 7500 &&
    accuracyPercent >= 60
  ) {
    steps.push({
      text: "答對但花比較久，代表可能是回想速度較慢；可以先重視答對，再慢慢提升速度。",
    });
  }

  if (steps.length === 0 || stars >= 3) {
    steps.push({
      text: "這次表現穩定，可以逐步增加圖片數量，或進入下一個難度觀察是否仍能穩定完成。",
    });
  }

  return steps.slice(0, 3);
}


function getAIDifficultyDecisionLabel(decision) {
  switch (decision) {
    case "increase":
      return "可提高";
    case "keep_or_slightly_increase":
      return "可微調";
    case "keep":
      return "維持";
    case "slightly_decrease":
      return "稍降";
    case "decrease":
      return "降低";
    default:
      return "未判定";
  }
}

function formatSeconds(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "--";
  return (ms / 1000).toFixed(1);
}

const toneStyles = {
  good: {
    backgroundColor: "#e9f8ef",
    color: "#2f7d4f",
    borderColor: "#9ed9b4",
  },
  normal: {
    backgroundColor: "#fff4de",
    color: "#9a6322",
    borderColor: "#f2c27d",
  },
  watch: {
    backgroundColor: "#fff0ec",
    color: "#a9472d",
    borderColor: "#e7a08e",
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

  trainingPurposePanel: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    border: "2px solid #f1d4b2",
    borderRadius: "22px",
    padding: "16px 20px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
    marginBottom: "16px",
    textAlign: "left",
  },

  trainingPurposeTitle: {
    fontSize: "21px",
    color: "#5c4033",
    fontWeight: "900",
    margin: "0 0 8px",
  },

  trainingPurposeText: {
    fontSize: "16px",
    color: "#4d3b2f",
    fontWeight: "750",
    lineHeight: 1.7,
    margin: 0,
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

  bigBadge: {
    width: "84px",
    height: "84px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "48px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.1)",
    flexShrink: 0,
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

  chartPanel: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: "28px",
    padding: "22px 24px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
    marginBottom: "16px",
  },

  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  chartCard: {
    backgroundColor: "#fffaf4",
    border: "1px solid #efd7bc",
    borderRadius: "20px",
    padding: "16px 18px",
    textAlign: "left",
  },

  chartTitleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },

  chartTitle: {
    color: "#5c4033",
    fontSize: "18px",
    fontWeight: "900",
    margin: 0,
  },

  chartValue: {
    color: "#8b542f",
    fontSize: "20px",
    fontWeight: "900",
    whiteSpace: "nowrap",
  },

  metricTrack: {
    height: "18px",
    backgroundColor: "#eadfd3",
    borderRadius: "999px",
    overflow: "hidden",
  },

  metricFill: (percent, tone) => ({
    display: "block",
    width: `${clampNumber(percent, 0, 100)}%`,
    minWidth: percent > 0 ? "8px" : 0,
    height: "100%",
    borderRadius: "999px",
    backgroundColor: tone === "memory" ? "#8f79c6" : "#62b892",
  }),

  stackedBar: {
    display: "flex",
    width: "100%",
    height: "20px",
    overflow: "hidden",
    borderRadius: "999px",
    backgroundColor: "#eadfd3",
  },

  stackedPart: (color, percent) => ({
    display: "block",
    width: `${Math.max(0, percent)}%`,
    height: "100%",
    backgroundColor: color,
  }),

  legendRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 14px",
    marginTop: "11px",
  },

  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "#6e5140",
    fontSize: "13px",
    fontWeight: "800",
  },

  legendDot: (color) => ({
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: color,
  }),

  reactionTrack: {
    position: "relative",
    height: "18px",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #62b892 0 35%, #f1c66f 35% 75%, #d88972 75% 100%)",
    marginTop: "4px",
  },

  reactionGoodZone: {
    position: "absolute",
    left: "35%",
    top: "-4px",
    width: "2px",
    height: "26px",
    backgroundColor: "rgba(92,64,51,0.35)",
  },

  reactionMarker: (percent) => ({
    position: "absolute",
    left: `${clampNumber(percent, 0, 100)}%`,
    top: "50%",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    border: "4px solid #5c4033",
    boxShadow: "0 2px 7px rgba(0,0,0,0.22)",
    transform: "translate(-50%, -50%)",
  }),

  reactionScale: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    color: "#80644e",
    fontSize: "11px",
    fontWeight: "800",
    marginTop: "7px",
  },

  chartHelper: {
    color: "#6e5140",
    fontSize: "13px",
    fontWeight: "750",
    lineHeight: 1.5,
    margin: "10px 0 0",
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

  abilityIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "16px",
    backgroundColor: "#fff3e8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "27px",
    flexShrink: 0,
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

  aiPanel: {
    backgroundColor: "#f0f7ff",
    borderRadius: "28px",
    padding: "22px 24px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
    marginBottom: "16px",
    border: "2px solid rgba(110, 166, 220, 0.35)",
  },

  aiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    marginBottom: "16px",
  },

  aiIntro: {
    fontSize: "16px",
    lineHeight: 1.65,
    color: "#3f5970",
    fontWeight: "800",
    margin: 0,
  },
  detailsPanel: {
    border: "1px solid rgba(111, 162, 191, 0.34)",
    borderRadius: 20,
    background: "rgba(255, 255, 255, 0.78)",
    overflow: "hidden",
  },
  detailsSummary: {
    padding: "18px 22px",
    color: "#35637d",
    fontWeight: 900,
    cursor: "pointer",
  },
  detailsContent: {
    display: "grid",
    gap: 18,
    padding: "18px",
    borderTop: "1px solid rgba(111, 162, 191, 0.26)",
  },

  aiReferenceNote: {
    color: "#49647a",
    fontSize: "14px",
    fontWeight: "800",
    lineHeight: 1.55,
    margin: "12px 0 0",
  },

  aiScoreBadge: {
    minWidth: "118px",
    borderRadius: "24px",
    padding: "14px 18px",
    textAlign: "center",
    border: "2px solid transparent",
    backgroundColor: "#ffffff",
    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
    flexShrink: 0,
  },

  aiScoreTone: (tone) => toneStyles[tone] || toneStyles.normal,

  aiScoreLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "900",
    marginBottom: "3px",
  },

  aiScoreValue: {
    display: "block",
    fontSize: "36px",
    fontWeight: "900",
    lineHeight: 1,
  },

  aiInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "14px",
  },

  aiSuggestionBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    padding: "12px 14px",
  },

  aiSuggestionText: {
    fontSize: "16px",
    color: "#33485c",
    fontWeight: "850",
    lineHeight: 1.65,
    margin: 0,
  },

  suggestionList: {
    display: "grid",
    gap: "10px",
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

  mainButton: {
    minWidth: "180px",
    backgroundColor: "#f4a261",
    color: "#ffffff",
    border: "none",
    borderRadius: "999px",
    padding: "16px 34px",
    fontSize: "21px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(244,162,97,0.35)",
    transition: "transform 0.16s ease, box-shadow 0.16s ease",
  },

  secondaryButton: {
    minWidth: "180px",
    backgroundColor: "#ffffff",
    color: "#f4a261",
    border: "3px solid #f4a261",
    borderRadius: "999px",
    padding: "13px 32px",
    fontSize: "21px",
    fontWeight: "900",
    cursor: "pointer",
    transition: "transform 0.16s ease, box-shadow 0.16s ease",
  },
};
