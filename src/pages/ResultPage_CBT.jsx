import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import bgImg from "../asset/CBT_testbackground.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import "../styles/GamePage_CBT.css";
import { calculateCBTScore } from "../utils/cbtScoring";

/*
  家長直觀版 CBT 結果頁
  重點：不要求家長懂專有名詞或圖表，只回答：
  1. 孩子剛剛做了什麼？
  2. 孩子現在自己能做到哪裡？
  3. 提示後能做到哪裡？
  4. 下次要怎麼練？
*/

export default function ResultPage_CBT() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const resultState = useMemo(() => {
    if (location.state && Object.keys(location.state).length > 0) {
      return location.state;
    }

    return getStoredCBTPageResult();
  }, [location.state]);

  const rawHistory = useMemo(
    () =>
      resultState?.cbtHistory ||
      resultState?.history ||
      resultState?.trials ||
      resultState?.records ||
      resultState?.clinicalView?.history ||
      resultState?.scoring?.history ||
      resultState?.scoring?.records ||
      [],
    [resultState]
  );

  const mode = getResultMode(resultState || {});

  const result = useMemo(
    () => buildParentFriendlyResult(rawHistory, resultState || {}, mode),
    [rawHistory, resultState, mode]
  );

  const hasResult = result.totalTrials > 0 || Boolean(resultState?.scoring?.summary);
  const detailedTrainingResult = result.isTestMode
    ? null
    : buildDetailedCBTTrainingResult(result, resultState || {}, rawHistory);
  const observationCards = detailedTrainingResult?.cards || result.cards;
  const insightCards = detailedTrainingResult?.insightCards || [
    {
      key: "meaning",
      tone: "neutral",
      badge: "?圾",
      label: "?誨銵其?暻?",
      title: "閬死蝛粹???閮",
      text: result.whatItMeans,
    },
    {
      key: "observation",
      tone: "watch",
      badge: "閫撖?",
      label: "?活頛?閬釣?",
      title: "雿??航炊?帘摰漲",
      text: result.observation,
    },
  ];
  const nextSuggestion = detailedTrainingResult?.nextSuggestion || {
    title: `先從 ${result.suggestedSpan} 步開始練習`,
    steps: result.nextSteps,
  };

  const handleNavigate = (path, options) => {
    if (isNavigating) return;
    setIsNavigating(true);
    clearCurrentCbtCache();
    navigate(path, options);
  };

  const quickStats = [
    {
      label: result.isTestMode ? "最高通過" : "自己記住",
      value: result.independentSpan > 0 ? `${result.independentSpan} 步` : "熟悉中",
      helper: "不重看也能依序完成的最長路線",
    },
    ...(!result.isTestMode
      ? [{
          label: "提示後完成",
          value: result.assistedSpan > 0 ? `${result.assistedSpan} 步` : "暫無資料",
          helper: "再看一次或提醒後可完成的長度",
        }]
      : []),
    {
      label: "路線正確率",
      value: `${Math.round(result.weightedAccuracyPercent || 0)}%`,
      helper: "整段路線依正確順序完成的情況",
    },
    {
      label: "完成題數",
      value: `${result.totalTrials || 0} 題`,
      helper: "本次納入結果判讀的有效題目",
    },
    {
      label: result.isTestMode ? "最高嘗試" : "再看一次",
      value: result.isTestMode
        ? `${result.maxAttemptedLength || 0} 步`
        : `${result.totalReplayCount || 0} 次`,
      helper: result.isTestMode ? "本次曾挑戰的最長路線" : "練習過程使用提示的次數",
    },
  ];

  const handleBackToMenu = () => {
    // 正式測驗只回森林，不得觸發帽子遊戲。
    if (result.isTestMode) {
      handleNavigate("/test-map");
      return;
    }

    const childId = resolveCBTChildId(resultState);
    const resultSessionId = createCBTResultSessionId(resultState, rawHistory);
    const hatReward = registerCBTTrainingForHatGame({
      childId,
      resultSessionId,
    });

    if (hatReward.shouldTrigger) {
      handleNavigate(CBT_HAT_ROUTE, {
        state: {
          childId,
          rewardSessionId: hatReward.rewardSessionId,
          sourceGame: "CBT",
          sourceMode: "training",
          returnPath: "/game-menu",
        },
      });
      return;
    }

    handleNavigate("/game-menu");
  };

  const handleRestart = () =>
    handleNavigate(result.isTestMode ? "/test-cbt" : "/training-cbt");

  return (
    <div
      className="cbt-result-page"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url(${bgImg})`,
      }}
    >
      <style>{cbtResultPageCss}</style>

      <main className="cbt-result-main-card">
        {!hasResult ? (
          <EmptyState
            onBack={handleBackToMenu}
            onTest={() => handleNavigate("/test-cbt")}
            onTraining={() => handleNavigate("/training-cbt")}
            disabled={isNavigating}
          />
        ) : (
          <>
            <header className="cbt-result-header">
              <p className="cbt-mode-tag">{result.isTestMode ? "測驗結果" : "練習結果"}</p>
              <h1 className="cbt-result-main-title">
                {result.isTestMode ? "石頭路線挑戰完成" : "石頭路線練習完成"}
              </h1>
            </header>

            <section className="cbt-parent-panel">
              <section className="cbt-overview-card">
                <div className="cbt-overview-left">
                  <div className="cbt-score-circle" aria-label={`${Math.round(result.totalScore || result.weightedAccuracyPercent || 0)} 分`}>
                    <span className="cbt-score-number">{Math.round(result.totalScore || result.weightedAccuracyPercent || 0)}</span>
                    <span className="cbt-score-unit">分</span>
                  </div>

                  <div className="cbt-overview-text-box">
                    <p className="cbt-overview-label">{result.isTestMode ? "這次挑戰" : "這次練習"}</p>
                    <h2 className="cbt-overview-title">{detailedTrainingResult?.overviewTitle || result.starLabel}</h2>
                    <p className="cbt-overview-desc">{detailedTrainingResult?.overviewText || result.mainSummary}</p>
                  </div>
                </div>

                <div className="cbt-star-summary">
                  <div className="cbt-star-row" aria-label={`${result.stars} 顆星`}>
                    {[1, 2, 3].map((star) => (
                      <span key={star} className={`cbt-star-chip ${star <= result.stars ? "is-on" : ""}`}>★</span>
                    ))}
                  </div>
                  <p>星星代表本次完成表現</p>
                  <small>請搭配下方觀察重點一起看，不代表單一次診斷。</small>
                </div>
              </section>

              <section className="cbt-quick-stats">
                {quickStats.map((item) => (
                  <article key={item.label} className="cbt-stat-card">
                    <p className="cbt-stat-label">{item.label}</p>
                    <p className="cbt-stat-value">{item.value}</p>
                    <p className="cbt-stat-helper">{item.helper}</p>
                  </article>
                ))}
              </section>

              <section className="cbt-panel-block">
                <h2 className="cbt-section-title">結果快速解讀</h2>
                <p className="cbt-parent-summary-text">{detailedTrainingResult?.parentSummary || result.meaning}</p>
                {result.aiSummary && <p className="cbt-ai-summary">{result.aiSummary}</p>}
              </section>

              <section className="cbt-panel-block">
                <h2 className="cbt-section-title">可以這樣看</h2>
                <p className="cbt-parent-intro">不需要先懂專有名詞，只要看每張卡片的「本次表現」與「代表什麼」。</p>

                <div className="cbt-highlight-grid">
                  {observationCards.map((item, index) => (
                    <article key={item.key} className="cbt-observation-card">
                      <div className="cbt-observation-top">
                        <span className={`cbt-status-pill ${index === 0 ? "good" : index === 1 ? "neutral" : "watch"}`}>{item.value}</span>
                        <div>
                          <p className="cbt-card-label">觀察重點</p>
                          <h3>{item.title}</h3>
                        </div>
                      </div>
                      <p>{item.note}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="cbt-panel-block">
                <h2 className="cbt-section-title">孩子這次主要表現</h2>
                <div className="cbt-indicator-grid">
                  {detailedTrainingResult ? (
                    <>
                      {insightCards.map((item) => (
                        <article key={item.key} className="cbt-observation-card">
                          <div className="cbt-observation-top">
                            <span className={`cbt-status-pill ${item.tone}`}>{item.badge}</span>
                            <div>
                              <p className="cbt-card-label">{item.label}</p>
                              <h3>{item.title}</h3>
                            </div>
                          </div>
                          <p>{item.text}</p>
                        </article>
                      ))}
                    </>
                  ) : (
                    <>
                  <article className="cbt-observation-card">
                    <div className="cbt-observation-top">
                      <span className="cbt-status-pill neutral">理解</span>
                      <div>
                        <p className="cbt-card-label">這代表什麼</p>
                        <h3>視覺空間順序記憶</h3>
                      </div>
                    </div>
                    <p>{result.whatItMeans}</p>
                  </article>

                  <article className="cbt-observation-card">
                    <div className="cbt-observation-top">
                      <span className="cbt-status-pill watch">觀察</span>
                      <div>
                        <p className="cbt-card-label">這次較需要注意</p>
                        <h3>作答錯誤與穩定度</h3>
                      </div>
                    </div>
                    <p>{result.observation}</p>
                  </article>
                    </>
                  )}
                </div>
              </section>

              {result.isTestMode && (
                <section className="cbt-panel-block">
                  <h2 className="cbt-section-title">測驗規則與結束方式</h2>
                  <p className="cbt-parent-summary-text">{result.testRuleText}</p>
                  <p className="cbt-rule-stop">本次結束原因：{result.stopReasonText}</p>
                </section>
              )}

              <section className="cbt-next-card">
                <h2 className="cbt-section-title">下一步建議</h2>
                <h3>{nextSuggestion.title}</h3>
                <ol className="cbt-suggestion-list">
                  {nextSuggestion.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </section>

              <section className="cbt-note-box">
                <h3>結果小提醒</h3>
                <p>這份結果是本次遊戲中的觀察紀錄，可協助了解孩子在「看見位置、記住順序、依序完成」時的狀況；結果可能受到注意力、疲勞、情緒與操作熟悉度影響，不代表醫療診斷。</p>
              </section>
            </section>

            <footer className="cbt-action-btns">
              <button type="button" className="cbt-image-button" disabled={isNavigating} onClick={handleBackToMenu} aria-label="回到森林">
                <img src={homeBackBtn} alt="回到森林" />
              </button>
              {!result.isTestMode && (
                <button type="button" className="cbt-image-button" disabled={isNavigating} onClick={handleRestart} aria-label="play again">
                  <img src={homeAgainBtn} alt="play again" />
                </button>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onBack, onTest, onTraining, disabled = false }) {
  return (
    <section style={styles.emptyState}>
      <h1 className="cbt-title" style={styles.title}>還沒有足夠的紀錄</h1>
      <p style={styles.taskText}>
        請先完成一次石頭小路測驗或練習。完成後，這裡會用簡單文字告訴家長孩子目前適合怎麼練。
      </p>
      <div style={styles.emptyActions}>
        <button type="button" className="cbt-main-button" disabled={disabled} onClick={onTest}>
          去做正式測驗
        </button>
        <button type="button" className="cbt-secondary-button" disabled={disabled} onClick={onTraining}>
          去做訓練
        </button>
        <button type="button" className="cbt-secondary-button" disabled={disabled} onClick={onBack}>
          返回遊戲地圖
        </button>
      </div>
    </section>
  );
}

// eslint-disable-next-line no-unused-vars
function ParentCard({ icon, title, value, note, highlight }) {
  return (
    <article style={{ ...styles.parentCard, ...(highlight ? styles.parentCardHighlight : {}) }}>
      <div style={styles.cardIcon}>{icon}</div>
      <h3 style={styles.cardTitle}>{title}</h3>
      <strong style={styles.cardValue}>{value}</strong>
      <p style={styles.cardNote}>{note}</p>
    </article>
  );
}

// eslint-disable-next-line no-unused-vars
function MiniRecord({ label, value }) {
  return (
    <div style={styles.miniRecord}>
      <span style={styles.miniLabel}>{label}</span>
      <strong style={styles.miniValue}>{value}</strong>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function renderStars(stars) {
  return [1, 2, 3].map((index) => (
    <span key={index} style={index <= stars ? styles.starOn : styles.starOff}>★</span>
  ));
}

function safeJsonParse(raw, fallback = null) {
  try {
    if (!raw || typeof raw !== "string") return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("CBT 結果資料解析失敗：", error);
    return fallback;
  }
}

function hasUsefulCBTResult(value) {
  if (!value || typeof value !== "object") return false;

  const history =
    value.cbtHistory ||
    value.history ||
    value.trials ||
    value.records ||
    value.clinicalView?.history ||
    value.scoring?.history ||
    value.scoring?.records ||
    [];

  return (
    Array.isArray(history) && history.length > 0
  ) || Boolean(value.scoring?.summary || value.summary?.totalTrials || value.totalTrials || value.totalQuestions);
}


const CBT_HAT_ROUTE = "/hat-sticker-game";
const CBT_HAT_MIN_INTERVAL = 5;
const CBT_HAT_MAX_INTERVAL = 8;

function safeStorageObject(storage, key, fallback = {}) {
  if (!storage) return fallback;

  try {
    const parsed = JSON.parse(storage.getItem(key));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function randomHatInterval() {
  return (
    CBT_HAT_MIN_INTERVAL +
    Math.floor(Math.random() * (CBT_HAT_MAX_INTERVAL - CBT_HAT_MIN_INTERVAL + 1))
  );
}

function resolveCBTChildId(state = {}) {
  const stateId =
    state?.childId ||
    state?.child?.id ||
    state?.currentChild?.id ||
    state?.profile?.childId;

  if (stateId !== null && stateId !== undefined && String(stateId).trim()) {
    return String(stateId);
  }

  return getCurrentChildIdForCBTResult() || "unassigned";
}

function createCBTResultSessionId(state = {}, history = []) {
  const existingId =
    state?.resultSessionId ||
    state?.sessionId ||
    state?.attemptId ||
    state?.trainingSessionId ||
    state?.id;

  if (existingId !== null && existingId !== undefined && String(existingId).trim()) {
    return `cbt-training-${String(existingId)}`;
  }

  const timestamp =
    state?.completedAt ||
    state?.createdAt ||
    state?.timestamp ||
    state?.endedAt ||
    history?.[history.length - 1]?.completedAt ||
    history?.[history.length - 1]?.timestamp;

  if (timestamp) return `cbt-training-${String(timestamp)}`;

  // location.state 在同一次結果頁生命週期內不變，將本次 fallback 固定在 sessionStorage。
  if (typeof window !== "undefined") {
    const fallbackKey = "cbtCurrentResultSessionId";
    const stored = window.sessionStorage.getItem(fallbackKey);
    if (stored) return stored;

    const generated = `cbt-training-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    window.sessionStorage.setItem(fallbackKey, generated);
    return generated;
  }

  return `cbt-training-${Date.now()}`;
}

function registerCBTTrainingForHatGame({ childId, resultSessionId }) {
  if (typeof window === "undefined") {
    return { shouldTrigger: false, rewardSessionId: null };
  }

  const safeChildId = childId || "unassigned";
  const progressKey = `hatRewardProgress_${safeChildId}`;
  const processedKey = `hatRewardProcessedResults_${safeChildId}`;
  const processed = safeStorageObject(window.localStorage, processedKey, {});

  // 同一份結果重整或重複點擊時，不可重複累計。
  if (processed[resultSessionId]) {
    return { shouldTrigger: false, rewardSessionId: null };
  }

  const progress = safeStorageObject(window.localStorage, progressKey, {});
  const currentCount = Math.max(0, Number(progress.completedTrainingCount) || 0) + 1;
  const targetCount = Math.max(
    CBT_HAT_MIN_INTERVAL,
    Number(progress.nextTriggerAt) || randomHatInterval()
  );
  const shouldTrigger = currentCount >= targetCount;
  const rewardSessionId = shouldTrigger
    ? `CBT-${safeChildId}-${resultSessionId}`
    : null;

  processed[resultSessionId] = {
    sourceGame: "CBT",
    sourceMode: "training",
    processedAt: new Date().toISOString(),
    triggeredHatGame: shouldTrigger,
  };

  window.localStorage.setItem(processedKey, JSON.stringify(processed));
  window.localStorage.setItem(
    progressKey,
    JSON.stringify({
      completedTrainingCount: shouldTrigger ? 0 : currentCount,
      nextTriggerAt: shouldTrigger ? randomHatInterval() : targetCount,
      lastProcessedResultId: resultSessionId,
      lastTriggeredAt: shouldTrigger ? new Date().toISOString() : progress.lastTriggeredAt || null,
    })
  );

  return { shouldTrigger, rewardSessionId };
}

function getCurrentChildIdForCBTResult() {
  if (typeof window === "undefined") return null;

  const keys = [
    "selectedChildId",
    "currentChildId",
    "activeChildId",
    "childId",
    "ef_current_child_id",
  ];

  for (const key of keys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value && value !== "null" && value !== "undefined") return value;
  }

  return null;
}

function getStoredCBTPageResult() {
  if (typeof window === "undefined") return {};

  const childId = getCurrentChildIdForCBTResult();
  const keys = [
    "latestCBTTrainingResult",
    "cbtTrainingResult",
    "ef_game_cbt_training_result",
    "cbtFinalResult",
    "cbtLatestResult",
    childId ? `cbtTrainingResult_${childId}` : null,
    childId ? `cbtTestResult_${childId}` : null,
    "latestCBTTestResult",
    "cbtTestResult",
    "ef_game_cbt_test_result",
  ].filter(Boolean);

  for (const key of keys) {
    const parsed = safeJsonParse(window.localStorage.getItem(key), null);
    if (hasUsefulCBTResult(parsed)) return parsed;
  }

  return {};
}

function getResultMode(state = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const rawMode = String(
    safeState.resultType ||
      safeState.taskMode ||
      safeState.mode ||
      safeState.gameMode ||
      safeState.resultMode ||
      safeState.source ||
      safeState.scoring?.mode ||
      safeState.aiAnalysis?.mode ||
      ""
  ).toLowerCase();

  if (rawMode.includes("test") || rawMode.includes("測驗") || rawMode.includes("formal")) {
    return "test";
  }

  if (rawMode.includes("training") || rawMode.includes("train") || rawMode.includes("練習") || rawMode.includes("訓練")) {
    return "training";
  }

  // 沒有明確 mode 時，若存在提示/救援紀錄，就視為訓練；否則保守視為正式測驗，避免出現「正式測驗提示後」的矛盾文案。
  const history = normalizeHistory(
    safeState.cbtHistory || safeState.history || safeState.trials || safeState.records || []
  );
  const hasAssistance = history.some(
    (item) =>
      getReplayCount(item) > 0 ||
      item?.usedReplay ||
      item?.usedHint ||
      item?.hintUsed ||
      item?.wasRescued ||
      item?.rescueUsed ||
      item?.isRescueAttempt ||
      item?.idleHintShown
  );

  return hasAssistance ? "training" : "test";
}

function clearCurrentCbtCache() {
  if (typeof window === "undefined") return;

  const protectedKeys = new Set([
    "cbtTestResult",
    "cbtTrainingResult",
    "cbtFinalResult",
    "cbtLatestResult",
    "latestCBTTestResult",
    "latestCBTTrainingResult",
    "ef_game_cbt_test_result",
    "ef_game_cbt_training_result",
  ]);

  const volatileKeys = [
    "cbtHistory",
    "cbtResult",
    "cbtSummary",
    "cbtScoring",
    "cbtCurrentTrial",
    "cbtCurrentSequence",
    "cbtUserSequence",
    "cbtTempResult",
    "currentCbtHistory",
    "currentCbtResult",
    "trainingCbtHistory",
    "testCbtHistory",
  ];

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    if (!storage) return;

    volatileKeys.forEach((key) => { if (!protectedKeys.has(key)) storage.removeItem(key); });

    Object.keys(storage).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const isCbtKey = lowerKey.includes("cbt");
      const isVolatile =
        lowerKey.includes("history") ||
        lowerKey.includes("trial") ||
        lowerKey.includes("sequence") ||
        lowerKey.includes("temp") ||
        lowerKey.includes("current") ||
        lowerKey.includes("answer") ||
        lowerKey.includes("cache");

      if (
        isCbtKey &&
        isVolatile &&
        !protectedKeys.has(key) &&
        !lowerKey.includes("star") &&
        !lowerKey.includes("progress") &&
        !lowerKey.includes("testresult") &&
        !lowerKey.includes("trainingresult") &&
        !lowerKey.includes("finalresult")
      ) {
        storage.removeItem(key);
      }
    });
  });
}

function buildDetailedCBTTrainingResult(result = {}, state = {}, historyInput = []) {
  const history = normalizeHistory(historyInput);
  const stars = getDetailedCBTStars(result, state);
  const levelInfo = getDetailedCBTLevelInfo(result, state);
  const starInfo = getDetailedCBTStarInfo(stars);
  const profile = getDetailedCBTProfile(result, history);
  const accuracy = Math.round(result.weightedAccuracyPercent || 0);
  const independentSpan = result.independentSpan || 0;
  const assistedSpan = result.assistedSpan || 0;
  const replayRate = result.totalTrials > 0 ? result.replayTrialCount / result.totalTrials : 0;

  const overviewTitle = `${levelInfo.title}，${starInfo.title}`;
  const overviewText = `${profile.shortText}目前約可獨立完成 ${independentSpan || "尚未穩定"} 步路線${
    assistedSpan > independentSpan ? `，在提示或重看後可挑戰到 ${assistedSpan} 步` : ""
  }。`;

  const parentSummary = [
    `這次屬於「${levelInfo.label}」的訓練結果，重點不是只看答對幾題，而是看孩子如何記住石頭的位置與點選順序。`,
    starInfo.meaning,
    profile.meaning,
    accuracy >= 75
      ? "整體正確率已經有一定穩定度，可以開始觀察是否能在較少提示下維持同樣表現。"
      : "目前仍建議先把成功經驗做穩，讓孩子在短一點的路線中熟悉看、記、按的節奏。",
  ].join("");

  const cards = [
    {
      key: "level",
      title: "目前訓練層級",
      value: levelInfo.badge,
      note: levelInfo.meaning,
    },
    {
      key: "stars",
      title: "本次星等解讀",
      value: `${stars} 星`,
      note: starInfo.cardText,
    },
    {
      key: "profile",
      title: "主要表現型",
      value: profile.badge,
      note: profile.cardText,
    },
    {
      key: "support",
      title: "提示依賴程度",
      value: replayRate >= 0.35 || assistedSpan > independentSpan ? "需要留意" : "相對穩定",
      note:
        assistedSpan > independentSpan
          ? `孩子在沒有提示時約 ${independentSpan || 0} 步較穩，加入提示後可到 ${assistedSpan} 步，代表能力正在形成，但還需要外在線索幫忙整理記憶。`
          : "這次沒有明顯依賴提示才完成的狀況，可以把重點放在維持穩定與逐步增加路線長度。",
    },
  ];

  const insightCards = [
    {
      key: "ability",
      tone: starInfo.tone,
      badge: starInfo.badge,
      label: "家長可這樣看",
      title: starInfo.insightTitle,
      text: `${levelInfo.meaning}${starInfo.meaning}`,
    },
    {
      key: "profile",
      tone: profile.tone,
      badge: profile.badge,
      label: "這次最值得觀察",
      title: profile.title,
      text: profile.observation,
    },
  ];

  return {
    overviewTitle,
    overviewText,
    parentSummary,
    cards,
    insightCards,
    nextSuggestion: {
      title: profile.nextTitle || `先從 ${result.suggestedSpan || Math.max(independentSpan, 1)} 步開始練習`,
      steps: buildDetailedCBTNextSteps(result, profile, levelInfo),
    },
  };
}

function getDetailedCBTStars(result = {}, state = {}) {
  const directStars =
    result?.stars ??
    state?.stars ??
    state?.star ??
    state?.scoring?.stars ??
    state?.cbtScoring?.stars;

  if (Number.isFinite(Number(directStars))) {
    return Math.max(1, Math.min(3, Number(directStars)));
  }

  const accuracy = result.weightedAccuracyPercent || 0;
  const independentSpan = result.independentSpan || 0;
  const replayRate = result.totalTrials > 0 ? result.replayTrialCount / result.totalTrials : 0;
  const timeoutRate = result.totalTrials > 0 ? result.timeoutCount / result.totalTrials : 0;

  if (accuracy >= 80 && independentSpan >= 4 && replayRate < 0.3 && timeoutRate < 0.25) return 3;
  if (accuracy >= 55 || independentSpan >= 2 || result.assistedSpan >= 3) return 2;
  return 1;
}

function getDetailedCBTLevelInfo(result = {}, state = {}) {
  const rawDifficulty = String(
    state?.difficulty ||
      state?.difficultyKey ||
      state?.currentDifficulty ||
      state?.level ||
      state?.recommendedDifficulty ||
      result?.recommendedDifficulty ||
      ""
  ).toLowerCase();
  const span = Math.max(result.independentSpan || 0, result.assistedSpan || 0, result.maxAttemptedLength || 0);

  let group = "basic";
  if (rawDifficulty.includes("hard") || rawDifficulty.includes("advanced") || rawDifficulty.includes("3") || span >= 5) {
    group = "advanced";
  } else if (
    rawDifficulty.includes("medium") ||
    rawDifficulty.includes("normal") ||
    rawDifficulty.includes("2") ||
    span >= 3
  ) {
    group = "steady";
  }

  const map = {
    basic: {
      badge: "基礎",
      label: "基礎路線記憶層級",
      title: "基礎路線記憶",
      meaning:
        "這個層級主要看孩子能不能把少量位置先看清楚，再依照順序點回來，核心是建立空間位置與先後順序的基本連結。",
    },
    steady: {
      badge: "穩定",
      label: "穩定路線記憶層級",
      title: "穩定路線記憶",
      meaning:
        "這個層級會開始增加路線長度，重點是孩子能不能把多個位置串成一條順序，而不是只記得單一石頭在哪裡。",
    },
    advanced: {
      badge: "進階",
      label: "進階空間順序層級",
      title: "進階空間順序",
      meaning:
        "這個層級要求孩子同時處理較長路線、空間位置與點選順序，會更考驗工作記憶、注意維持與錯誤修正能力。",
    },
  };

  return { group, ...map[group] };
}

function getDetailedCBTStarInfo(stars) {
  if (stars >= 3) {
    return {
      title: "3 星穩定通過",
      badge: "穩定",
      tone: "good",
      insightTitle: "能力已可穩定使用",
      meaning:
        "3 星表示孩子在目前層級能較穩定地記住路線，錯誤與提示需求都不高。",
      cardText:
        "可以考慮維持同層級再練 1 次確認穩定，或小幅增加一步，觀察是否仍能維持順序與位置的正確性。",
    };
  }

  if (stars === 2) {
    return {
      title: "2 星正在成形",
      badge: "發展中",
      tone: "neutral",
      insightTitle: "能力已有基礎，但還不完全穩",
      meaning:
        "2 星表示孩子已經抓到任務規則，也能完成部分路線，但表現會受到提示、路線長度或注意力波動影響。",
      cardText:
        "建議先在同層級多累積成功經驗，等孩子能少靠提示也完成，再往下一個長度挑戰。",
    };
  }

  return {
    title: "1 星需要支持",
    badge: "需支持",
    tone: "watch",
    insightTitle: "目前仍需要大人或系統協助穩住策略",
    meaning:
      "1 星表示目前層級對孩子來說負荷偏高，可能還在熟悉看路線、記位置、照順序點回來的基本流程。",
    cardText:
      "建議先降低步數或增加示範，讓孩子先有明確成功經驗，再慢慢減少提示。",
  };
}

function getDetailedCBTProfile(result = {}, history = []) {
  const totalTrials = result.totalTrials || history.length || 0;
  const timeoutRate = totalTrials > 0 ? result.timeoutCount / totalTrials : 0;
  const replayRate = totalTrials > 0 ? result.replayTrialCount / totalTrials : 0;
  const accuracy = result.weightedAccuracyPercent || 0;
  const independentSpan = result.independentSpan || 0;
  const assistedSpan = result.assistedSpan || 0;

  if (totalTrials === 0) {
    return makeCBTProfile({
      badge: "資料少",
      tone: "neutral",
      title: "目前資料量不足",
      shortText: "這次可用紀錄較少，先把結果當作初步觀察。",
      meaning: "因為作答紀錄較少，暫時不適合過度解讀能力高低。",
      observation: "建議再完成一次完整訓練，會比較容易判斷孩子是記憶負荷、注意力，還是操作節奏需要協助。",
      cardText: "需要更多題目才能做穩定判斷。",
    });
  }

  if (assistedSpan > independentSpan || replayRate >= 0.35) {
    return makeCBTProfile({
      badge: "提示型",
      tone: "watch",
      title: "提示或重看後能挑戰更長路線",
      shortText: "孩子有能力往上挑戰，但目前還需要提示幫忙整理路線。",
      meaning: "這代表孩子並非完全不會，而是獨立記住整條路線時容易掉步驟；一旦有重看或提示，就能把能力拉出來。",
      observation: "家長可以觀察孩子是不是會先看一顆就急著點，或需要再看一次才想起完整順序。",
      cardText: "重點是逐步減少提示，而不是直接增加難度。",
      nextTitle: `先穩住 ${Math.max(independentSpan || 1, 1)} 步，再慢慢減少提示`,
    });
  }

  if (timeoutRate >= 0.3 || result.timeoutCount >= 2 || result.idleHintRate >= 0.35) {
    return makeCBTProfile({
      badge: "慢啟動",
      tone: "watch",
      title: "知道要做，但回想時間比較吃緊",
      shortText: "孩子可能有記到路線，但開始作答或回想時需要比較久。",
      meaning: "這類表現常見於孩子還在心裡重新整理順序，或看到題目後需要更多時間把空間位置轉成點選動作。",
      observation: "如果錯誤不多但常超時，可以先給孩子固定口訣，例如『先看、再想、最後點』，幫助作答流程更穩。",
      cardText: "先練作答節奏，再增加路線長度。",
    });
  }

  if (result.locationErrorRate >= 0.35) {
    return makeCBTProfile({
      badge: "位置型",
      tone: "watch",
      title: "空間位置容易記混",
      shortText: "孩子較容易把石頭的位置看錯或記到附近的位置。",
      meaning: "這表示空間定位是這次比較需要支持的部分，孩子可能記得要點幾步，但對每一步實際位置還不夠穩。",
      observation: "可以讓孩子在開始前先用手指空比一次路線，或說出『上、下、左、右』的位置關係。",
      cardText: "優先練位置辨識，不急著增加步數。",
    });
  }

  if (result.orderErrorRate >= 0.35) {
    return makeCBTProfile({
      badge: "順序型",
      tone: "watch",
      title: "記得位置，但順序容易混淆",
      shortText: "孩子可能看到了正確石頭，但點選先後順序還不穩。",
      meaning: "這比較像工作記憶中的順序排列負荷，而不是單純看不懂題目。",
      observation: "練習時可請孩子先小聲念『第一、第二、第三』，把順序感拉出來。",
      cardText: "先把同樣步數練穩，再往更長路線前進。",
    });
  }

  if (result.omissionErrorRate >= 0.35 || result.lateErrorCount > result.earlyErrorCount) {
    return makeCBTProfile({
      badge: "後段漏步",
      tone: "watch",
      title: "前面記得住，後段步驟容易漏掉",
      shortText: "孩子在路線後半段較容易忘記、漏點或順序斷掉。",
      meaning: "這通常表示記憶容量快到上限，前段還能保留，後段資訊比較容易掉出來。",
      observation: "建議先維持目前步數，練到孩子能完整說出或比出整條路線，再增加一步。",
      cardText: "這次重點是延長記憶保持，不是單純追求更快。",
    });
  }

  if (result.extraTapErrorRate >= 0.3 || result.earlyErrorCount > result.lateErrorCount) {
    return makeCBTProfile({
      badge: "急點型",
      tone: "neutral",
      title: "作答時容易多點或太快",
      shortText: "孩子可能還沒把路線整理完，就先開始點選。",
      meaning: "這類表現比較像反應控制與作答策略問題，孩子需要練習先停一下再出手。",
      observation: "可以加入『看完停一拍』的規則，讓孩子每次點之前先確認下一步。",
      cardText: "先練停看聽的節奏，正確率通常會跟著上來。",
    });
  }

  if (result.fatigueDrop >= 0.25) {
    return makeCBTProfile({
      badge: "續航型",
      tone: "neutral",
      title: "後半段表現較容易下滑",
      shortText: "孩子一開始能進入狀況，但練到後面穩定度下降。",
      meaning: "這比較偏向注意維持或疲勞影響，代表能力有出現，只是維持時間還需要訓練。",
      observation: "可以把練習切成短回合，中間給 20 到 30 秒休息，再看表現是否回升。",
      cardText: "把訓練切短，通常比一次練很久更有效。",
    });
  }

  if (accuracy >= 80 && independentSpan >= 3) {
    return makeCBTProfile({
      badge: "穩定型",
      tone: "good",
      title: "路線記憶與順序控制都相對穩定",
      shortText: "孩子能穩定把看到的路線轉成正確點選。",
      meaning: "這表示目前層級已經接近熟練，可以開始小幅提高挑戰，觀察新長度下是否仍能維持穩定。",
      observation: "下一步可以增加一步，或維持同長度但減少提示，讓孩子練習更獨立地完成。",
      cardText: "可以小幅增加難度，但仍建議一次只增加一個變因。",
    });
  }

  return makeCBTProfile({
    badge: "成形中",
    tone: "neutral",
    title: "路線記憶正在建立中",
    shortText: "孩子已經有一些成功表現，但穩定度還需要累積。",
    meaning: "目前看起來不是單一明顯錯誤，而是位置、順序與作答節奏都還在整合。",
    observation: "建議先用同一個步數多練幾次，讓孩子形成固定策略，再逐步增加挑戰。",
    cardText: "先求穩，再求長度與速度。",
  });
}

function makeCBTProfile(profile) {
  return {
    nextTitle: "先從目前可成功的步數開始練習",
    ...profile,
  };
}

function buildDetailedCBTNextSteps(result = {}, profile = {}, levelInfo = {}) {
  const baseSpan = result.suggestedSpan || Math.max(result.independentSpan || 1, 1);
  const steps = [
    `先用 ${baseSpan} 步路線練到連續成功，再考慮增加到下一步。`,
  ];

  if (profile.badge === "提示型") {
    steps.push("先允許重看一次，成功後再改成只用口頭提醒，最後才完全不提示。");
  } else if (profile.badge === "位置型") {
    steps.push("作答前請孩子先用手指空比路線，確認每顆石頭的位置關係。");
  } else if (profile.badge === "順序型") {
    steps.push("練習時加入第一、第二、第三的口語順序，幫助孩子把位置串成路線。");
  } else if (profile.badge === "後段漏步") {
    steps.push("維持同一步數，請孩子點完後回想最後一顆在哪裡，補強後段保持。");
  } else if (profile.badge === "急點型") {
    steps.push("加入看完停一拍再點的規則，先把衝動多點降下來。");
  } else if (profile.badge === "慢啟動") {
    steps.push("先不催速度，改用固定流程：看完整條路、心裡想一次、再開始點。");
  } else if (profile.badge === "續航型") {
    steps.push("把訓練切成短回合，中間休息一下，再觀察後半段是否比較穩。");
  } else if (profile.badge === "穩定型") {
    steps.push(`可嘗試進入${levelInfo.group === "advanced" ? "更少提示" : "下一個步數"}，但一次只增加一個難度。`);
  } else {
    steps.push("先固定同一個步數與節奏，讓孩子形成自己的記憶策略。");
  }

  steps.push("家長觀察時可記錄孩子是錯在位置、順序、漏掉，還是需要重看，下一次調整會更精準。");

  if ((result.weightedAccuracyPercent || 0) < 60) {
    steps.push("若連續兩次都低於六成，建議退回少一步，先把成功率拉回來。");
  } else {
    steps.push("若連續兩次都能穩定完成，再增加一步或減少一次提示。");
  }

  return [...new Set(steps)].slice(0, 4);
}

function buildParentFriendlyResult(historyInput, state = {}, mode = "training") {
  const history = normalizeHistory(historyInput);
  const safeState = state && typeof state === "object" ? state : {};
  const existingScoring =
    safeState?.scoring?.summary
      ? safeState.scoring
      : safeState?.cbtScoring?.summary
      ? safeState.cbtScoring
      : safeState?.result?.scoring?.summary
      ? safeState.result.scoring
      : safeState?.cbtResult?.summary
      ? safeState.cbtResult
      : null;

  const scoring = existingScoring || calculateCBTScore(history);
  const summary = scoring?.summary || safeState?.summary || {};
  const aiAnalysis = safeState?.aiAnalysis || scoring?.aiAnalysis || {};
  const isTestMode = mode === "test";

  const totalTrials =
    readNumber(summary.totalTrials) ||
    readNumber(summary.totalQuestions) ||
    readNumber(scoring?.totalTrials) ||
    readNumber(safeState?.totalQuestions) ||
    readNumber(safeState?.total) ||
    history.length ||
    0;

  const correctCount =
    readNumber(summary.correctCount) ??
    readNumber(scoring?.correctCount) ??
    readNumber(safeState?.correctCount) ??
    history.filter((item) => item.correct || item.isCorrect).length;

  const timeoutCount =
    readNumber(summary.timeoutCount) ??
    history.filter((item) => item.timeout || item.isTimeout).length;

  const independentSpan =
    readNumber(summary.independentSpan) ??
    readNumber(aiAnalysis?.independentSpan) ??
    getIndependentSpan(history);

  const assistedSpanFromSummary =
    readNumber(summary.assistedSpan) ??
    readNumber(aiAnalysis?.assistedSpan) ??
    readNumber(summary.rawSpan) ??
    readNumber(summary.span) ??
    readNumber(summary.memorySpan) ??
    readNumber(safeState?.bestSpan);

  const assistedSpan = isTestMode
    ? independentSpan
    : Math.max(
        assistedSpanFromSummary || 0,
        independentSpan,
        getAssistedSpan(history),
        estimateSpanByCorrectCount(correctCount)
      );

  const maxAttemptedLength =
    readNumber(summary.maxAttemptedLength) ??
    readNumber(safeState?.maxAttemptedLength) ??
    history.reduce((max, item) => Math.max(max, getTrialLength(item)), 0);

  const weightedAccuracyPercent =
    readNumber(summary.weightedAccuracyPercent) ??
    readNumber(summary.accuracyPercent) ??
    readNumber(summary.rawAccuracyPercent) ??
    percent(correctCount, totalTrials);

  const sequenceMatchPercent =
    readNumber(summary.sequenceMatchPercent) ??
    getAverageSequenceMatchPercent(history);

  const totalReplayCount =
    readNumber(summary.totalReplayCount) ??
    history.reduce((sum, item) => sum + getReplayCount(item), 0);

  const replayTrialCount =
    readNumber(summary.replayTrialCount) ??
    history.filter((item) => getReplayCount(item) > 0 || item.usedReplay).length;

  const rescueTrialCount =
    readNumber(summary.rescueTrialCount) ??
    history.filter((item) => item.wasRescued || item.rescueUsed || item.isRescueAttempt || item.rescueCorrect).length;

  const earlyErrorCount =
    readNumber(summary.earlyErrorCount) ??
    getErrorSideCount(history, "early");

  const lateErrorCount =
    readNumber(summary.lateErrorCount) ??
    getErrorSideCount(history, "late");

  const wrongCount =
    readNumber(summary.wrongCount) ??
    Math.max(totalTrials - correctCount, 0);

  const averageCorrectReactionTime =
    readNumber(summary.averageCorrectReactionTime) ??
    getAverageCorrectReactionTime(history);

  const locationErrorRate =
    readNumber(summary.locationErrorRate) ??
    readNumber(aiAnalysis?.metrics?.locationErrorRate) ??
    getErrorPatternRate(history, "location_error");
  const orderErrorRate =
    readNumber(summary.orderErrorRate) ??
    readNumber(aiAnalysis?.metrics?.orderErrorRate) ??
    getErrorPatternRate(history, "order_error");
  const omissionErrorRate =
    readNumber(summary.omissionErrorRate) ??
    readNumber(aiAnalysis?.metrics?.omissionErrorRate) ??
    getErrorPatternRate(history, "omission_error");
  const extraTapErrorRate =
    readNumber(summary.extraTapErrorRate) ??
    readNumber(aiAnalysis?.metrics?.extraTapErrorRate) ??
    getErrorPatternRate(history, "extra_tap_error");
  const idleHintRate =
    readNumber(summary.idleHintRate) ??
    readNumber(aiAnalysis?.metrics?.idleHintRate) ??
    percentToRate(history.filter((item) => item.idleHintShown).length, totalTrials);
  const fatigueDrop =
    readNumber(summary.fatigueDrop) ??
    readNumber(aiAnalysis?.fatigueDrop) ??
    readNumber(aiAnalysis?.metrics?.fatigueDrop) ??
    0;

  const stopReason =
    safeState.stopReason ||
    summary.stopReason ||
    scoring?.stopReason ||
    aiAnalysis?.stopReason ||
    "completed";

  const stars =
    readNumber(scoring?.stars) ||
    readNumber(safeState?.stars) ||
    getFriendlyStars({
      weightedAccuracyPercent,
      independentSpan,
      assistedSpan,
      totalReplayCount,
      replayTrialCount,
      rescueTrialCount,
      totalTrials,
      timeoutCount,
    });

  const suggestedSpan = getSuggestedSpan({
    independentSpan,
    assistedSpan,
    weightedAccuracyPercent,
    totalReplayCount,
  });

  const mainSummary = isTestMode
    ? independentSpan > 0
      ? `孩子這次最高可以自己記住約 ${independentSpan} 步石頭路。`
      : "孩子目前還在熟悉石頭亮起與照順序點回來的玩法。"
    : independentSpan > 0 && assistedSpan > independentSpan
    ? `孩子可以自己記住 ${independentSpan} 步石頭路；如果再看一次，可以完成到 ${assistedSpan} 步。`
    : independentSpan > 0
    ? `孩子這次可以自己記住約 ${independentSpan} 步石頭路。`
    : assistedSpan > 0
    ? `孩子目前在提示後可以完成約 ${assistedSpan} 步石頭路。`
    : "孩子目前還在熟悉石頭亮起與照順序點回來的玩法。";

  const meaning = isTestMode
    ? independentSpan >= 4
      ? "孩子已經能掌握一段連續路線，可以慢慢增加一點點挑戰。正式測驗沒有重看或提示，因此代表孩子自己完成的狀況。"
      : "正式測驗不提供重看或提示，因此這裡只看孩子自己完成的狀況。"
    : assistedSpan > independentSpan
    ? "短一點的路線比較穩；路線變長時，給一點提醒會更容易成功。"
    : independentSpan >= 4
    ? "孩子已經能掌握一段連續路線，可以慢慢增加一點點挑戰。"
    : "孩子適合先從短路線建立成功經驗，再慢慢加長。";

  const completionText = getCompletionText(weightedAccuracyPercent);
  const stopReasonText = getStopReasonText(stopReason);
  const stopReasonShortText = getStopReasonShortText(stopReason);

  const metricsForText = {
    wrongCount,
    timeoutCount,
    earlyErrorCount,
    lateErrorCount,
    sequenceMatchPercent,
    totalReplayCount,
    replayTrialCount,
    totalTrials,
    averageCorrectReactionTime,
    locationErrorRate,
    orderErrorRate,
    omissionErrorRate,
    extraTapErrorRate,
    idleHintRate,
    fatigueDrop,
    isTestMode,
  };

  return {
    totalTrials,
    correctCount,
    wrongCount,
    timeoutCount,
    independentSpan,
    assistedSpan,
    maxAttemptedLength,
    weightedAccuracyPercent,
    totalScore: readNumber(scoring?.totalScore) ?? readNumber(safeState?.totalScore) ?? readNumber(safeState?.score) ?? weightedAccuracyPercent,
    sequenceMatchPercent,
    totalReplayCount,
    replayTrialCount,
    rescueTrialCount,
    isTestMode,
    stopReason,
    stopReasonText,
    stopReasonShortText,
    testRuleText:
      "每個記憶數量會做 2 題；同一記憶數量連續 2 題未完成，或連續 2 題逾時，測驗就會結束。",
    stars,
    starLabel: getStarLabel(stars),
    suggestedSpan,
    completionText,
    mainSummary,
    meaning,
    aiSummary: aiAnalysis?.parentSummary || scoring?.parentView?.aiSummary || "",
    recommendedDifficulty: scoring?.recommendedDifficulty || aiAnalysis?.recommendedDifficulty || null,
    recommendedAction: scoring?.recommendedAction || aiAnalysis?.recommendedAction || null,
    recommendationReason: scoring?.recommendationReason || aiAnalysis?.recommendationReason || aiAnalysis?.recommendation?.reason || "",
    mainWeakness: scoring?.mainWeakness || aiAnalysis?.mainWeakness || null,
    whatItMeans: buildMeaningText({
      independentSpan,
      assistedSpan,
      weightedAccuracyPercent,
      sequenceMatchPercent,
      totalReplayCount,
      rescueTrialCount,
      isTestMode,
      stopReasonText,
    }),
    observation: buildObservationText(metricsForText),
    nextSteps: buildNextSteps({
      suggestedSpan,
      independentSpan,
      assistedSpan,
      weightedAccuracyPercent,
      earlyErrorCount,
      lateErrorCount,
      timeoutCount,
      totalReplayCount,
      rescueTrialCount,
      isTestMode,
      locationErrorRate,
      orderErrorRate,
      omissionErrorRate,
      extraTapErrorRate,
      idleHintRate,
      fatigueDrop,
      recommendationReason: scoring?.recommendationReason || aiAnalysis?.recommendationReason || aiAnalysis?.recommendation?.reason || "",
    }),
    cards: [
      {
        key: "independent",
        icon: "🪨",
        title: isTestMode ? "最高通過" : "自己記住",
        value: independentSpan > 0 ? `${independentSpan} 步` : "還在熟悉",
        note:
          independentSpan > 0
            ? "不用再看一次，也能照順序點回來。"
            : "先熟悉石頭亮起後要照順序點。",
        highlight: true,
      },
      !isTestMode && {
        key: "assisted",
        icon: "✨",
        title: "提示後完成",
        value: assistedSpan > 0 ? `${assistedSpan} 步` : "暫無資料",
        note:
          assistedSpan > independentSpan
            ? "再看一次或提醒後，可以完成更長的路線。"
            : "這次幾乎不需要靠提示來完成。",
      },
      isTestMode && {
        key: "stopReason",
        icon: "🏁",
        title: "結束原因",
        value: stopReasonShortText,
        note: stopReasonText,
      },
      {
        key: "completion",
        icon: "✅",
        title: "路線走對",
        value: completionText,
        note: getCompletionNote(weightedAccuracyPercent),
      },
      {
        key: "next",
        icon: "🌱",
        title: "下次建議",
        value: `${suggestedSpan} 步開始`,
        note: scoring?.recommendationReason || aiAnalysis?.recommendationReason || "先求穩定完成，再慢慢把石頭路加長。",
        highlight: true,
      },
    ].filter(Boolean),
  };
}

function buildMeaningText({
  independentSpan,
  assistedSpan,
  weightedAccuracyPercent,
  sequenceMatchPercent,
  totalReplayCount,
  rescueTrialCount,
  isTestMode,
  stopReasonText,
}) {
  const parts = [];

  if (independentSpan >= 4) {
    parts.push(`孩子已經能自己記住 ${independentSpan} 步左右的石頭路。`);
  } else if (independentSpan >= 2) {
    parts.push(`孩子已經能自己完成短路線，約 ${independentSpan} 步。`);
  } else {
    parts.push("孩子目前還在熟悉「看亮燈、記順序、點回來」的規則。");
  }

  if (!isTestMode && assistedSpan > independentSpan) {
    parts.push(`如果給他再看一次，最長可以到 ${assistedSpan} 步，代表提示能幫助他把路線找回來。`);
  } else if (isTestMode) {
    parts.push("正式測驗沒有再看一次或提示，所以結果代表孩子在無提示情境下的表現。");
  }

  if (weightedAccuracyPercent >= 80) {
    parts.push("整體來看，多數路線都能完成。");
  } else if (weightedAccuracyPercent >= 60) {
    parts.push("整體來看，已經能完成一部分路線，但路線變長時還會不穩。");
  } else {
    parts.push("整體來看，目前適合降低步數，先讓孩子有成功經驗。");
  }

  if (sequenceMatchPercent < 60) {
    parts.push("順序還在練習中，可以先不要增加太多石頭。");
  }

  if (isTestMode && stopReasonText) {
    parts.push(`本次結束原因：${stopReasonText}`);
  }

  if (!isTestMode && (totalReplayCount > 0 || rescueTrialCount > 0)) {
    parts.push("使用提示不代表不好，代表孩子在提醒下能繼續完成。");
  }

  return parts.join("");
}

function buildObservationText({
  wrongCount,
  timeoutCount,
  earlyErrorCount,
  lateErrorCount,
  sequenceMatchPercent,
  totalReplayCount,
  replayTrialCount,
  totalTrials,
  averageCorrectReactionTime,
  locationErrorRate,
  orderErrorRate,
  omissionErrorRate,
  extraTapErrorRate,
  idleHintRate,
  fatigueDrop,
}) {
  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;

  if (idleHintRate >= 0.35) {
    return "這次有幾題需要畫面輕微提醒後才開始作答。這不是提示答案，而是提醒孩子回到任務，表示注意啟動或任務維持可能需要支持。";
  }

  if (fatigueDrop >= 0.3) {
    return "孩子後半段表現下降，可能與疲勞或注意維持有關。下次可先維持同樣步數，不急著增加難度。";
  }

  if (locationErrorRate >= 0.45) {
    return "孩子比較容易點到沒有出現過的位置，表示空間位置辨識與記憶仍需要練習。";
  }

  if (orderErrorRate >= 0.45) {
    return "孩子大致記得出現過的位置，但先後順序容易混淆。下次可以維持同樣步數，先練穩順序。";
  }

  if (omissionErrorRate >= 0.35) {
    return "孩子較常漏掉後面的步驟，可能是路線變長後記憶維持不穩。";
  }

  if (extraTapErrorRate >= 0.35) {
    return "孩子有較多多點或點太快的情形，建議提醒他看完後慢慢照順序點，不用追求速度。";
  }

  if (timeoutCount >= 2) {
    return "這次比較需要注意的是作答時間。孩子可能不是不會，而是需要比較久回想石頭順序。下次可以先縮短路線，或讓作答時間寬一點。";
  }

  if (lateErrorCount > earlyErrorCount && wrongCount > 0) {
    return "孩子通常能記住前面幾步，但路線變長後，後半段比較容易忘記。下次可以先維持同樣步數，等穩定後再加長。";
  }

  if (earlyErrorCount > lateErrorCount && wrongCount > 0) {
    return "孩子比較容易在一開始就點錯，可能是第一、第二步還沒有看清楚。下次可以先放慢亮燈速度，確認孩子有看完再開始點。";
  }

  if (sequenceMatchPercent < 60) {
    return "這次順序還在練習中。建議先把石頭路縮短，讓孩子先抓到「照順序」的感覺。";
  }

  if (totalReplayCount > 0 && replayRate <= 0.4) {
    return `這次偶爾需要再看一次，共使用 ${totalReplayCount} 次。這表示孩子在少量提醒下可以完成，可以慢慢減少提示。`;
  }

  if (totalReplayCount > 0) {
    return `這次比較常需要再看一次，共使用 ${totalReplayCount} 次。建議先不要快速加難，讓孩子在同樣步數下練得更穩。`;
  }

  if (averageCorrectReactionTime && averageCorrectReactionTime > 6500) {
    return "孩子答對時需要比較多時間回想。這不是壞事，代表他有在想，可以先不要催速度。";
  }

  return "這次沒有明顯集中問題。可以先維持目前步數，等孩子連續幾題都穩定後，再慢慢增加一步。";
}

function buildNextSteps({
  suggestedSpan,
  independentSpan,
  assistedSpan,
  weightedAccuracyPercent,
  earlyErrorCount,
  lateErrorCount,
  timeoutCount,
  totalReplayCount,
  rescueTrialCount,
  isTestMode,
  locationErrorRate,
  orderErrorRate,
  omissionErrorRate,
  extraTapErrorRate,
  idleHintRate,
  fatigueDrop,
  recommendationReason,
}) {
  const steps = [];

  steps.push(`先從 ${suggestedSpan} 步石頭路開始練，不要一次加太多。`);

  if (!isTestMode && assistedSpan > independentSpan) {
    steps.push("如果孩子卡住，可以先讓他再看一次；穩定後再慢慢減少提示。");
  } else {
    steps.push("如果孩子連續幾題都能自己完成，再增加 1 步就好。");
  }

  if (recommendationReason) {
    steps.push(`系統建議：${recommendationReason}`);
  } else if (idleHintRate >= 0.35) {
    steps.push("先保留輕微提醒，等孩子能自己開始作答後，再慢慢延長提醒時間。");
  } else if (fatigueDrop >= 0.3) {
    steps.push("下次先不要加難，觀察孩子後半段是否能維持穩定。");
  } else if (locationErrorRate >= 0.45) {
    steps.push("先減少石頭數量或拉開石頭距離，讓位置更好分辨。");
  } else if (orderErrorRate >= 0.45) {
    steps.push("先維持同樣步數，讓孩子練習把前後順序說出來再點。");
  } else if (omissionErrorRate >= 0.35) {
    steps.push("可以先練短一點的路線，等後半段不容易漏掉後再加長。");
  } else if (extraTapErrorRate >= 0.35) {
    steps.push("提醒孩子不用急著點，先看完再慢慢照順序完成。");
  } else if (lateErrorCount > earlyErrorCount) {
    steps.push("如果常忘記後半段，可以請孩子邊看邊小聲說順序，例如：上、右、下。");
  } else if (earlyErrorCount > lateErrorCount) {
    steps.push("如果一開始就容易錯，先放慢亮燈速度，提醒孩子看完再點。");
  } else if (weightedAccuracyPercent < 60) {
    steps.push("先把目標放在「穩定走對」，不要急著追求速度。");
  } else {
    steps.push("練習時先誇獎孩子記得住的部分，再慢慢增加挑戰。");
  }

  if (timeoutCount >= 2) {
    steps.push("如果常逾時，先給更短路線或更久作答時間，避免孩子緊張亂點。");
  } else if (!isTestMode && (totalReplayCount > 0 || rescueTrialCount > 0)) {
    steps.push("下次可以觀察：少一次提示後，孩子是否還能完成同樣步數。");
  }

  return [...new Set(steps)].slice(0, 4);
}

function getFriendlyStars({
  weightedAccuracyPercent,
  independentSpan,
  assistedSpan,
  totalReplayCount,
  replayTrialCount,
  rescueTrialCount,
  totalTrials,
  timeoutCount,
}) {
  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;
  const rescueRate = totalTrials > 0 ? rescueTrialCount / totalTrials : 0;
  const timeoutRate = totalTrials > 0 ? timeoutCount / totalTrials : 0;

  if (
    weightedAccuracyPercent >= 80 &&
    independentSpan >= 4 &&
    totalReplayCount <= 1 &&
    replayRate <= 0.35 &&
    rescueRate <= 0.25 &&
    timeoutRate < 0.25
  ) {
    return 3;
  }

  if (weightedAccuracyPercent >= 55 || independentSpan >= 2 || assistedSpan >= 3) {
    return 2;
  }

  return 1;
}

function getStarLabel(stars) {
  if (stars >= 3) return "這次很穩定";
  if (stars === 2) return "已經掌握一些路線";
  return "適合從短路線開始";
}

function getCompletionText(percentValue) {
  if (percentValue >= 85) return "大多走對";
  if (percentValue >= 60) return "有些走對";
  if (percentValue > 0) return "還在練習";
  return "暫無資料";
}

function getCompletionNote(percentValue) {
  if (percentValue >= 85) return "大部分石頭路線都能照順序完成。";
  if (percentValue >= 60) return "已經能完成一部分路線，變長時再慢慢練。";
  if (percentValue > 0) return "先從更短的路線開始，讓孩子更容易成功。";
  return "完成一次練習後，這裡會顯示路線完成情況。";
}

function getSuggestedSpan({ independentSpan, assistedSpan, weightedAccuracyPercent, totalReplayCount }) {
  if (independentSpan <= 0 && assistedSpan <= 0) return 2;

  if (weightedAccuracyPercent >= 80 && totalReplayCount <= 1 && independentSpan >= 2) {
    return Math.max(2, independentSpan);
  }

  if (assistedSpan > independentSpan) {
    return Math.max(2, independentSpan || assistedSpan - 1);
  }

  return Math.max(2, Math.min(independentSpan || assistedSpan || 2, 5));
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];

  return value.filter(Boolean).map((item) => {
    const safeItem = item && typeof item === "object" ? item : {};
    const isCorrect = safeItem?.correct === true || safeItem?.isCorrect === true;
    const isTimeout = Boolean(
      safeItem?.timeout ||
        safeItem?.isTimeout ||
        safeItem?.errorType === "timeout" ||
        safeItem?.reason === "timeout"
    );

    return {
      ...safeItem,
      correct: isCorrect,
      isCorrect,
      timeout: isTimeout,
      isTimeout,
    };
  });
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getIndependentSpan(history) {
  const spans = history
    .filter((item) => {
      const usedReplay = getReplayCount(item) > 0 || item.usedReplay === true;
      const usedHint = item.usedHint === true || item.hintUsed === true;
      const rescued = item.wasRescued === true || item.rescueUsed === true || item.isRescueAttempt === true || item.rescueCorrect === true;
      const idleHint = item.idleHintShown === true;
      return (item.correct || item.isCorrect) && !usedReplay && !usedHint && !rescued && !idleHint;
    })
    .map(getTrialLength);

  return spans.length ? Math.max(...spans) : 0;
}

function getAssistedSpan(history) {
  const spans = history
    .filter(
      (item) =>
        (item.correct || item.isCorrect) &&
        (getReplayCount(item) > 0 ||
          item.usedReplay === true ||
          item.usedHint === true ||
          item.hintUsed === true ||
          item.wasRescued === true ||
          item.rescueUsed === true ||
          item.isRescueAttempt === true ||
          item.rescueCorrect === true ||
          item.idleHintShown === true)
    )
    .map(getTrialLength);

  return spans.length ? Math.max(...spans) : 0;
}

function estimateSpanByCorrectCount(correctCount) {
  if (correctCount >= 8) return 5;
  if (correctCount >= 6) return 4;
  if (correctCount >= 3) return 3;
  if (correctCount >= 1) return 2;
  return 0;
}

function getTrialLength(item) {
  return (
    readNumber(item?.length) ||
    readNumber(item?.span) ||
    readNumber(item?.sequenceLength) ||
    readNumber(item?.targetLength) ||
    toArray(item?.sequence).length ||
    toArray(item?.targetSequence).length ||
    toArray(item?.correctSequence).length ||
    toArray(item?.answer).length ||
    toArray(item?.userSequence).length ||
    0
  );
}

function getReplayCount(item) {
  const count = readNumber(item?.replayCount);
  if (Number.isFinite(count)) return Math.max(0, count);
  if (item?.usedReplay === true) return 1;
  return 0;
}

function getAverageCorrectReactionTime(history) {
  const values = history
    .filter((item) => item.correct || item.isCorrect)
    .map((item) => readNumber(item.reactionTime) ?? readNumber(item.answerTime))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getAverageSequenceMatchPercent(history) {
  if (!history.length) return 0;

  const rates = history.map((item) => {
    if (item.correct || item.isCorrect) return 1;

    const target = toArray(item.targetSequence || item.correctSequence || item.sequence);
    const user = toArray(item.userSequence || item.clickedSequence || item.selectedSequence || item.answer);

    if (!target.length) return 0;

    let matched = 0;
    const compareLength = Math.min(target.length, user.length);

    for (let i = 0; i < compareLength; i += 1) {
      if (target[i] === user[i]) matched += 1;
    }

    return matched / target.length;
  });

  return Math.round((rates.reduce((sum, value) => sum + value, 0) / rates.length) * 100);
}

function getFirstErrorIndex(item) {
  if (Number.isFinite(readNumber(item?.errorIndex))) return readNumber(item.errorIndex);

  if (Number.isFinite(readNumber(item?.firstErrorPosition))) {
    const pos = readNumber(item.firstErrorPosition);
    return pos > 0 ? pos - 1 : pos;
  }

  const target = toArray(item.targetSequence || item.correctSequence || item.sequence);
  const user = toArray(item.userSequence || item.clickedSequence || item.selectedSequence || item.answer);

  if (!target.length) return null;

  const maxLength = Math.max(target.length, user.length);

  for (let i = 0; i < maxLength; i += 1) {
    if (target[i] !== user[i]) return i;
  }

  return null;
}

function getErrorSideCount(history, side) {
  return history.filter((item) => {
    if (item.correct || item.isCorrect || item.timeout || item.isTimeout) return false;

    const errorIndex = getFirstErrorIndex(item);
    if (!Number.isFinite(errorIndex)) return false;

    const length = getTrialLength(item) || 1;
    const isEarly = errorIndex < Math.floor(length / 2);

    return side === "early" ? isEarly : !isEarly;
  }).length;
}

function getErrorPatternRate(history, pattern) {
  const wrongItems = history.filter((item) => !(item.correct || item.isCorrect));
  if (!wrongItems.length) return 0;
  const count = wrongItems.filter((item) => item.errorPattern === pattern || item.errorType === pattern).length;
  return count / wrongItems.length;
}

function percentToRate(part, total) {
  if (!total || total <= 0) return 0;
  return part / total;
}

function getStopReasonText(stopReason) {
  if (stopReason === "two_failures_same_memory_length") {
    return "同一記憶數量連續 2 題沒有完成，因此測驗結束。";
  }
  if (stopReason === "two_consecutive_timeouts") {
    return "連續 2 題沒有在時間內完成，因此測驗結束。";
  }
  if (stopReason === "max_memory_length_reached") {
    return "孩子已完成本次測驗的最高記憶數量。";
  }
  return "測驗已完成。";
}

function getStopReasonShortText(stopReason) {
  if (stopReason === "two_failures_same_memory_length") return "同長度連錯 2 題";
  if (stopReason === "two_consecutive_timeouts") return "連續 2 題逾時";
  if (stopReason === "max_memory_length_reached") return "完成最高長度";
  return "測驗完成";
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

const cbtResultPageCss = `
:root {
  --cbt-honey: #e7a62f;
  --cbt-cream: #fffaf0;
  --cbt-sky: #65b8e8;
  --cbt-sky-soft: #eaf6fd;
  --cbt-leaf: #739a48;
  --cbt-leaf-soft: #eef5e6;
  --cbt-coral: #e98f7d;
  --cbt-wood: #6b4226;
  --cbt-wood-soft: #8a5a34;
  --cbt-line: #ead8b7;
}
.cbt-result-page { width: 100%; min-height: 100dvh; background-size: cover; background-position: center; background-repeat: no-repeat; padding: clamp(12px, 2.4vw, 30px); box-sizing: border-box; font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; color: var(--cbt-wood); }
.cbt-result-main-card { width: min(1180px, 100%); min-height: calc(100dvh - clamp(24px, 4.8vw, 60px)); margin: 0 auto; background: rgba(255, 250, 240, 0.97); border: 1px solid rgba(194, 139, 68, 0.45); border-radius: 22px; box-shadow: 0 18px 44px rgba(99, 67, 30, 0.2); display: flex; flex-direction: column; overflow: hidden; }
.cbt-result-header { padding: clamp(22px, 4vw, 38px) clamp(18px, 4vw, 42px) 22px; border-bottom: 1px solid var(--cbt-line); background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,248,232,.94)); }
.cbt-mode-tag { display: inline-flex; margin: 0 0 9px; padding: 6px 12px; border-radius: 7px; background: var(--cbt-sky-soft); border: 1px solid #b9dff4; color: #3b7799; font-size: 13px; font-weight: 800; letter-spacing: .04em; }
.cbt-result-main-title { margin: 0; color: var(--cbt-wood); font-size: clamp(27px, 4vw, 42px); font-weight: 900; line-height: 1.22; }
.cbt-parent-panel { flex: 1; padding: clamp(16px, 3vw, 34px); }
.cbt-overview-card, .cbt-panel-block, .cbt-next-card, .cbt-note-box { background: rgba(255,255,255,.96); border: 1px solid var(--cbt-line); border-radius: 15px; box-shadow: 0 5px 16px rgba(108,72,31,.07); }
.cbt-overview-card { display: flex; justify-content: space-between; align-items: stretch; gap: 24px; padding: clamp(20px, 3vw, 30px); margin-bottom: 22px; border-top: 5px solid var(--cbt-honey); }
.cbt-overview-left { display: flex; align-items: center; gap: 24px; min-width: 0; }
.cbt-score-circle { width: 132px; height: 132px; min-width: 132px; border-radius: 18px; background: linear-gradient(160deg, #7fc9ef, var(--cbt-sky)); border: 3px solid #fff; outline: 1px solid #9fd5ef; color: #fff; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 8px 18px rgba(57,137,181,.22); }
.cbt-score-number { font-size: 48px; font-weight: 900; line-height: 1; }
.cbt-score-unit { font-size: 20px; font-weight: 800; align-self: flex-end; margin-bottom: 30px; }
.cbt-overview-label, .cbt-card-label, .cbt-stat-label { margin: 0 0 7px; color: #8d6745; font-size: 13px; font-weight: 800; letter-spacing: .03em; }
.cbt-overview-title { margin: 0 0 10px; color: var(--cbt-wood); font-size: clamp(24px, 3vw, 34px); font-weight: 900; line-height: 1.25; }
.cbt-overview-desc, .cbt-parent-summary-text, .cbt-parent-intro, .cbt-observation-card p, .cbt-next-card p, .cbt-note-box p, .cbt-suggestion-list { margin: 0; color: #6f5743; font-size: clamp(15px, 1.7vw, 18px); font-weight: 500; line-height: 1.75; }
.cbt-star-summary { flex: 0 0 220px; padding: 20px; border-radius: 13px; background: linear-gradient(180deg, #fff8df, #fff3cf); border: 1px solid #efd28d; text-align: center; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.cbt-star-row { display: flex; justify-content: center; gap: 8px; }
.cbt-star-chip { color: #d9c8a7; font-size: 30px; line-height: 1; }
.cbt-star-chip.is-on { color: var(--cbt-honey); }
.cbt-star-summary p { margin: 0; color: var(--cbt-wood); font-size: 15px; font-weight: 800; }
.cbt-star-summary small { color: #8a6a4d; font-size: 12px; line-height: 1.5; }
.cbt-quick-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
.cbt-stat-card { min-height: 122px; padding: 18px; border-radius: 13px; background: #fff; border: 1px solid var(--cbt-line); border-top: 4px solid var(--cbt-leaf); box-sizing: border-box; }
.cbt-stat-card:nth-child(2) { border-top-color: var(--cbt-sky); } .cbt-stat-card:nth-child(3) { border-top-color: var(--cbt-honey); } .cbt-stat-card:nth-child(4) { border-top-color: var(--cbt-coral); } .cbt-stat-card:nth-child(5) { border-top-color: #9d7ac1; }
.cbt-stat-value { margin: 0 0 7px; color: var(--cbt-wood); font-size: clamp(23px, 2.5vw, 30px); font-weight: 900; }
.cbt-stat-helper { margin: 0; color: #8b715b; font-size: 13px; line-height: 1.5; }
.cbt-panel-block, .cbt-next-card, .cbt-note-box { padding: clamp(18px, 3vw, 28px); margin-bottom: 22px; }
.cbt-section-title { margin: 0 0 12px; color: var(--cbt-wood); font-size: clamp(20px, 2.4vw, 25px); font-weight: 900; }
.cbt-ai-summary { margin: 14px 0 0; padding: 13px 15px; border-left: 4px solid var(--cbt-sky); background: var(--cbt-sky-soft); color: #567084; line-height: 1.7; }
.cbt-rule-stop { margin: 13px 0 0; font-weight: 800; color: var(--cbt-wood-soft); }
.cbt-highlight-grid, .cbt-indicator-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.cbt-indicator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cbt-observation-card { padding: 18px; border-radius: 13px; background: #fffdf8; border: 1px solid #eadcc5; box-sizing: border-box; }
.cbt-observation-card:nth-child(3n+1) { background: #fbfdf7; border-color: #d7e4c7; } .cbt-observation-card:nth-child(3n+2) { background: #f7fcff; border-color: #cfe7f4; } .cbt-observation-card:nth-child(3n) { background: #fff9f7; border-color: #f0d2ca; }
.cbt-observation-top { display: flex; gap: 11px; align-items: flex-start; margin-bottom: 12px; }
.cbt-observation-card h3, .cbt-next-card h3, .cbt-note-box h3 { margin: 0 0 7px; color: var(--cbt-wood); font-size: 18px; font-weight: 800; line-height: 1.4; }
.cbt-status-pill { flex: 0 0 auto; min-width: 38px; padding: 5px 9px; border-radius: 7px; background: #fff5df; border: 1px solid #edcf91; color: #98651f; font-size: 13px; font-weight: 800; text-align: center; }
.cbt-status-pill.good { background: var(--cbt-leaf-soft); color: #547731; border-color: #c8dbaa; } .cbt-status-pill.watch { background: #fff5df; color: #98651f; border-color: #edcf91; } .cbt-status-pill.neutral { background: var(--cbt-sky-soft); color: #3d7898; border-color: #c5e2f2; }
.cbt-next-card { background: linear-gradient(180deg, #f7fbf2, #eef5e6); border-left: 5px solid var(--cbt-leaf); }
.cbt-suggestion-list { padding-left: 24px; } .cbt-suggestion-list li + li { margin-top: 7px; }
.cbt-note-box { background: linear-gradient(180deg, #fffaf3, #fff5e5); box-shadow: none; border-left: 5px solid var(--cbt-honey); }
.cbt-action-btns { display: flex; justify-content: center; align-items: center; gap: clamp(16px, 3vw, 30px); padding: 18px clamp(16px, 3vw, 32px) 24px; border-top: 1px solid var(--cbt-line); background: rgba(255,250,240,.98); }
.cbt-image-button { width: clamp(148px, 18vw, 220px); padding: 0; border: none; background: transparent; border-radius: 12px; line-height: 0; cursor: pointer; transition: transform .16s ease, filter .16s ease; }
.cbt-image-button img { width: 100%; height: auto; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 5px 6px rgba(91,57,27,.2)); }
.cbt-image-button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.03); } .cbt-image-button:active:not(:disabled) { transform: translateY(1px) scale(.98); } .cbt-image-button:focus-visible { outline: 3px solid rgba(101,184,232,.38); outline-offset: 4px; } .cbt-image-button:disabled { opacity: .58; cursor: not-allowed; }
@media (max-width: 1100px) { .cbt-quick-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 980px) { .cbt-overview-card { flex-direction: column; } .cbt-star-summary { flex-basis: auto; } .cbt-quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cbt-highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) { .cbt-result-page { padding: 0; background-position: center top; } .cbt-result-main-card { min-height: 100dvh; border-radius: 0; border-left: 0; border-right: 0; box-shadow: none; } .cbt-result-header { padding: 20px 16px 17px; } .cbt-parent-panel { padding: 14px; } .cbt-overview-card { padding: 18px; gap: 18px; } .cbt-overview-left { align-items: flex-start; gap: 15px; } .cbt-score-circle { width: 96px; height: 96px; min-width: 96px; border-radius: 14px; } .cbt-score-number { font-size: 36px; } .cbt-score-unit { font-size: 16px; margin-bottom: 21px; } .cbt-quick-stats, .cbt-highlight-grid, .cbt-indicator-grid { grid-template-columns: 1fr; } .cbt-stat-card { min-height: auto; } .cbt-action-btns { position: sticky; bottom: 0; z-index: 10; gap: 12px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); box-shadow: 0 -5px 14px rgba(91,57,27,.09); } .cbt-image-button { width: min(44vw, 190px); } }
@media (max-width: 420px) { .cbt-overview-left { flex-direction: column; } .cbt-score-circle { width: 100%; height: 82px; } .cbt-score-unit { align-self: center; margin: 13px 0 0; } .cbt-image-button { width: calc(50vw - 22px); } }
`;

const styles = {
  pageCard: {
    width: "min(1120px, calc(100vw - 28px))",
    maxWidth: "1120px",
    minHeight: "auto",
    padding: "28px clamp(16px, 4vw, 42px)",
    margin: "24px auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },

  kicker: {
    margin: "0 0 4px",
    color: "#8b5e34",
    fontSize: "15px",
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    textAlign: "left",
  },

  starCard: {
    minWidth: "190px",
    padding: "14px 18px",
    borderRadius: "24px",
    background: "rgba(255, 250, 245, 0.97)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "center",
  },

  stars: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    fontSize: "34px",
    lineHeight: 1,
    marginBottom: "6px",
  },

  starOn: {
    color: "#f6b73c",
    textShadow: "0 2px 0 rgba(122, 79, 43, 0.12)",
  },

  starOff: {
    color: "rgba(122, 79, 43, 0.22)",
  },

  starText: {
    color: "#5c4033",
    fontSize: "16px",
  },

  taskIntro: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    padding: "18px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(255,250,245,0.98), rgba(255,239,220,0.96))",
    border: "2px solid rgba(244, 162, 97, 0.26)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "left",
    marginBottom: "18px",
  },

  ruleCard: {
    padding: "18px",
    borderRadius: "28px",
    background: "rgba(255, 250, 245, 0.96)",
    border: "2px solid rgba(244, 162, 97, 0.22)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "left",
    marginBottom: "18px",
  },

  ruleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginTop: "12px",
  },

  aiText: {
    margin: "10px 0 0",
    padding: "12px 14px",
    borderRadius: "18px",
    background: "rgba(236, 255, 230, 0.72)",
    color: "#4b6f38",
    fontSize: "16px",
    fontWeight: 850,
    lineHeight: 1.65,
  },

  emptyActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "12px",
    marginTop: "18px",
  },

  taskIcon: {
    flex: "0 0 auto",
    width: "64px",
    height: "64px",
    display: "grid",
    placeItems: "center",
    borderRadius: "22px",
    background: "#fff3e4",
    fontSize: "34px",
  },

  taskTitle: {
    margin: "0 0 6px",
    color: "#4a2b1c",
    fontSize: "22px",
    fontWeight: 950,
  },

  taskText: {
    margin: 0,
    color: "#5c4033",
    fontSize: "17px",
    fontWeight: 700,
    lineHeight: 1.8,
  },

  bigSummary: {
    padding: "22px",
    borderRadius: "30px",
    background: "rgba(255, 250, 245, 0.96)",
    border: "2px solid rgba(128, 92, 52, 0.13)",
    textAlign: "left",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    marginBottom: "18px",
  },

  label: {
    display: "inline-flex",
    marginBottom: "8px",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#fff0d8",
    color: "#8b5e34",
    fontSize: "14px",
    fontWeight: 950,
  },

  summaryText: {
    margin: "0 0 8px",
    color: "#4a2b1c",
    fontSize: "clamp(24px, 3vw, 34px)",
    fontWeight: 950,
    lineHeight: 1.35,
  },

  meaningText: {
    margin: 0,
    color: "#5c4033",
    fontSize: "18px",
    fontWeight: 800,
    lineHeight: 1.7,
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  parentCard: {
    display: "grid",
    alignContent: "start",
    gap: "8px",
    minHeight: "180px",
    background: "rgba(255, 243, 232, 0.96)",
    borderRadius: "26px",
    padding: "18px",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    border: "2px solid rgba(255, 255, 255, 0.55)",
    textAlign: "left",
  },

  parentCardHighlight: {
    background: "linear-gradient(135deg, rgba(255, 242, 221, 0.98), rgba(255, 250, 245, 0.98))",
    border: "2px solid rgba(244, 162, 97, 0.3)",
  },

  cardIcon: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
    borderRadius: "18px",
    background: "#fffaf5",
    fontSize: "26px",
  },

  cardTitle: {
    margin: 0,
    color: "#5c4033",
    fontSize: "17px",
    fontWeight: 950,
  },

  cardValue: {
    color: "#4a2b1c",
    fontSize: "clamp(25px, 4vw, 36px)",
    fontWeight: 1000,
    lineHeight: 1.15,
  },

  cardNote: {
    margin: 0,
    color: "#6f513e",
    fontSize: "15px",
    fontWeight: 750,
    lineHeight: 1.65,
  },

  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  textCard: {
    borderRadius: "28px",
    padding: "22px",
    background: "rgba(255, 250, 245, 0.96)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "left",
  },

  suggestionCard: {
    borderRadius: "28px",
    padding: "22px",
    background: "linear-gradient(135deg, rgba(255, 246, 232, 0.98), rgba(236, 255, 230, 0.9))",
    border: "2px solid rgba(127, 177, 103, 0.22)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "left",
  },

  sectionTitle: {
    margin: "0 0 12px",
    color: "#4a2b1c",
    fontSize: "22px",
    fontWeight: 950,
  },

  subTitle: {
    margin: "0 0 8px",
    color: "#5c4033",
    fontSize: "18px",
    fontWeight: 950,
  },

  bodyText: {
    margin: 0,
    color: "#5c4033",
    fontSize: "17px",
    fontWeight: 750,
    lineHeight: 1.85,
  },

  divider: {
    height: "1px",
    margin: "18px 0",
    background: "rgba(92, 64, 51, 0.12)",
  },

  suggestionList: {
    display: "grid",
    gap: "12px",
    margin: 0,
    paddingLeft: "22px",
  },

  suggestionItem: {
    padding: "10px 12px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.68)",
    color: "#4a2b1c",
    fontSize: "16px",
    fontWeight: 850,
    lineHeight: 1.7,
  },

  recordCard: {
    borderRadius: "28px",
    padding: "22px",
    background: "rgba(255, 250, 245, 0.96)",
    boxShadow: "0 8px 18px rgba(70, 45, 25, 0.08)",
    textAlign: "left",
  },

  recordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },

  miniRecord: {
    padding: "14px 16px",
    borderRadius: "20px",
    background: "#fff3e4",
    display: "grid",
    gap: "4px",
  },

  miniLabel: {
    color: "#8b5e34",
    fontSize: "14px",
    fontWeight: 900,
  },

  miniValue: {
    color: "#4a2b1c",
    fontSize: "22px",
    fontWeight: 1000,
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "14px",
    marginTop: "22px",
  },

  emptyState: {
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    padding: "32px 18px",
    textAlign: "center",
  },
};
