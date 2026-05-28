import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import bgImg from "../asset/CBT_testbackground.png";
import "../styles/GamePage_CBT.css";

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

  const rawHistory =
    location.state?.cbtHistory ||
    location.state?.history ||
    location.state?.trials ||
    location.state?.records ||
    [];

  const mode = getResultMode(location.state || {});

  const result = useMemo(
    () => buildParentFriendlyResult(rawHistory, location.state || {}, mode),
    [rawHistory, location.state, mode]
  );

  const hasResult = result.totalTrials > 0 || Boolean(location.state?.scoring);

  const handleNavigate = (path, options) => {
    if (isNavigating) return;
    setIsNavigating(true);
    clearCurrentCbtCache();
    navigate(path, options);
  };

  return (
    <div className="cbt-page" style={{ "--cbt-bg": `url(${bgImg})`, overflowY: "auto" }}>
      <main className="cbt-card cbt-card--wide" style={styles.pageCard}>
        {!hasResult ? (
          <EmptyState onBack={() => handleNavigate("/game-menu")} disabled={isNavigating} />
        ) : (
          <>
            <header style={styles.header}>
              <div>
                <p style={styles.kicker}>家長結果摘要</p>
                <h1 className="cbt-title" style={styles.title}>石頭小路完成了！</h1>
              </div>

              <div style={styles.starCard} aria-label={`${result.stars} 顆星`}>
                <div style={styles.stars}>{renderStars(result.stars)}</div>
                <strong style={styles.starText}>{result.starLabel}</strong>
              </div>
            </header>

            <section style={styles.taskIntro}>
              <div>
                <h2 style={styles.taskTitle}>孩子剛剛在做什麼？</h2>
                <p style={styles.taskText}>
                  看石頭一顆一顆亮起，先記住順序，再照著順序點回來。
                  這是在練習「看見、記住、照順序完成」。
                </p>
              </div>
            </section>

            <section style={styles.bigSummary}>
              <span style={styles.label}>這次最重要的觀察</span>
              <p style={styles.summaryText}>{result.mainSummary}</p>
              <p style={styles.meaningText}>{result.meaning}</p>
            </section>

            <section style={styles.cardGrid} aria-label="家長重點結果">
              {result.cards.map((card) => (
                <ParentCard key={card.key} {...card} />
              ))}
            </section>

            <section style={styles.twoColumns}>
              <div style={styles.textCard}>
                <h2 style={styles.sectionTitle}>這代表什麼？</h2>
                <p style={styles.bodyText}>{result.whatItMeans}</p>

                <div style={styles.divider} />

                <h3 style={styles.subTitle}>這次比較需要注意</h3>
                <p style={styles.bodyText}>{result.observation}</p>
              </div>

              <div style={styles.suggestionCard}>
                <h2 style={styles.sectionTitle}>下次可以怎麼陪他練？</h2>
                <ol style={styles.suggestionList}>
                  {result.nextSteps.map((step) => (
                    <li key={step} style={styles.suggestionItem}>{step}</li>
                  ))}
                </ol>
              </div>
            </section>

            <section style={styles.recordCard}>
              <h2 style={styles.sectionTitle}>簡單紀錄</h2>
              <div style={styles.recordGrid}>
                <MiniRecord label="自己記住" value={`${result.independentSpan} 步`} />
                {!result.isTestMode && (
                  <MiniRecord label="提示後完成" value={`${result.assistedSpan} 步`} />
                )}
                <MiniRecord label="路線走對" value={result.completionText} />
                <MiniRecord
                  label={result.isTestMode ? "測驗模式" : "再看一次"}
                  value={result.isTestMode ? "無提示" : `${result.totalReplayCount} 次`}
                />
              </div>
            </section>

            <footer style={styles.actions}>
              <button
                type="button"
                className="cbt-secondary-button"
                disabled={isNavigating}
                onClick={() => handleNavigate("/game-menu")}
              >
                返回遊戲地圖
              </button>

              <button
                type="button"
                className="cbt-main-button"
                disabled={isNavigating}
                onClick={() =>
                  handleNavigate("/training-cbt", {
                    state: {
                      suggestedSpan: result.suggestedSpan,
                      source: "cbt-parent-result",
                    },
                  })
                }
              >
                依建議繼續練習
              </button>

              <button
                type="button"
                className="cbt-secondary-button"
                disabled={isNavigating}
                onClick={() => handleNavigate("/test-cbt")}
              >
                再測一次
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onBack, disabled = false }) {
  return (
    <section style={styles.emptyState}>
      <h1 className="cbt-title" style={styles.title}>還沒有足夠的紀錄</h1>
      <p style={styles.taskText}>
        請先完成一次石頭小路測驗或練習。完成後，這裡會用簡單文字告訴家長孩子目前適合怎麼練。
      </p>
      <button type="button" className="cbt-main-button" disabled={disabled} onClick={onBack}>
        返回遊戲地圖
      </button>
    </section>
  );
}

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

function MiniRecord({ label, value }) {
  return (
    <div style={styles.miniRecord}>
      <span style={styles.miniLabel}>{label}</span>
      <strong style={styles.miniValue}>{value}</strong>
    </div>
  );
}

function renderStars(stars) {
  return [1, 2, 3].map((index) => (
    <span key={index} style={index <= stars ? styles.starOn : styles.starOff}>★</span>
  ));
}

function getResultMode(state = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const rawMode = String(
    safeState.mode ||
      safeState.gameMode ||
      safeState.resultMode ||
      safeState.source ||
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
      item?.isRescueAttempt
  );

  return hasAssistance ? "training" : "test";
}

function clearCurrentCbtCache() {
  if (typeof window === "undefined") return;

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

    volatileKeys.forEach((key) => storage.removeItem(key));

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

      if (isCbtKey && isVolatile && !lowerKey.includes("star") && !lowerKey.includes("progress")) {
        storage.removeItem(key);
      }
    });
  });
}

function buildParentFriendlyResult(historyInput, state = {}, mode = "training") {
  const history = normalizeHistory(historyInput);
  const safeState = state && typeof state === "object" ? state : {};
  const scoring = safeState?.scoring || safeState?.result || safeState?.cbtResult || null;
  const summary = scoring?.summary || safeState?.summary || {};
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
    getIndependentSpan(history);

  const assistedSpanFromSummary =
    readNumber(summary.assistedSpan) ??
    readNumber(summary.rawSpan) ??
    readNumber(summary.span) ??
    readNumber(summary.memorySpan) ??
    readNumber(safeState?.bestSpan);

  const assistedSpan = Math.max(
    assistedSpanFromSummary || 0,
    independentSpan,
    getAssistedSpan(history),
    estimateSpanByCorrectCount(correctCount)
  );

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
    history.filter((item) => item.wasRescued || item.rescueUsed || item.isRescueAttempt).length;

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
      ? `孩子這次可以自己記住約 ${independentSpan} 步石頭路。`
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
      ? "孩子已經能掌握一段連續路線，可以慢慢增加一點點挑戰。"
      : "正式測驗不提供提示，因此這裡只看孩子自己完成的狀況。"
    : assistedSpan > independentSpan
    ? "短一點的路線比較穩；路線變長時，給一點提醒會更容易成功。"
    : independentSpan >= 4
    ? "孩子已經能掌握一段連續路線，可以慢慢增加一點點挑戰。"
    : "孩子適合先從短路線建立成功經驗，再慢慢加長。";

  const completionText = getCompletionText(weightedAccuracyPercent);

  return {
    totalTrials,
    correctCount,
    wrongCount,
    timeoutCount,
    independentSpan,
    assistedSpan,
    weightedAccuracyPercent,
    sequenceMatchPercent,
    totalReplayCount,
    replayTrialCount,
    rescueTrialCount,
    isTestMode,
    stars,
    starLabel: getStarLabel(stars),
    suggestedSpan,
    completionText,
    mainSummary,
    meaning,
    whatItMeans: buildMeaningText({
      independentSpan,
      assistedSpan,
      weightedAccuracyPercent,
      sequenceMatchPercent,
      totalReplayCount,
      rescueTrialCount,
      isTestMode,
    }),
    observation: buildObservationText({
      wrongCount,
      timeoutCount,
      earlyErrorCount,
      lateErrorCount,
      sequenceMatchPercent,
      totalReplayCount,
      replayTrialCount,
      totalTrials,
      averageCorrectReactionTime,
    }),
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
    }),
    cards: [
      {
        key: "independent",
        title: "自己記住",
        value: independentSpan > 0 ? `${independentSpan} 步` : "還在熟悉",
        note:
          independentSpan > 0
            ? "不用再看一次，也能照順序點回來。"
            : "先熟悉石頭亮起後要照順序點。",
        highlight: true,
      },
      !isTestMode && {
        key: "assisted",
        title: "提示後完成",
        value: assistedSpan > 0 ? `${assistedSpan} 步` : "暫無資料",
        note:
          assistedSpan > independentSpan
            ? "再看一次後，可以完成更長的路線。"
            : "這次幾乎不需要靠提示來完成。",
      },
      {
        key: "completion",
        title: "路線走對",
        value: completionText,
        note: getCompletionNote(weightedAccuracyPercent),
      },
      {
        key: "next",
        title: "下次建議",
        value: `${suggestedSpan} 步開始`,
        note: "先求穩定完成，再慢慢把石頭路加長。",
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
}) {
  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;

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
}) {
  const steps = [];

  steps.push(`先從 ${suggestedSpan} 步石頭路開始練，不要一次加太多。`);

  if (!isTestMode && assistedSpan > independentSpan) {
    steps.push("如果孩子卡住，可以先讓他再看一次；穩定後再慢慢減少提示。");
  } else {
    steps.push("如果孩子連續幾題都能自己完成，再增加 1 步就好。");
  }

  if (lateErrorCount > earlyErrorCount) {
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
      const rescued = item.wasRescued === true || item.rescueUsed === true || item.isRescueAttempt === true;
      return (item.correct || item.isCorrect) && !usedReplay && !usedHint && !rescued;
    })
    .map(getTrialLength);

  return spans.length ? Math.max(...spans) : 0;
}

function getAssistedSpan(history) {
  const spans = history
    .filter((item) => item.correct || item.isCorrect)
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

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

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
