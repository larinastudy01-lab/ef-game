// src/pages/ResultPage_SRT.jsx

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT_testbackground.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import {
  calculateSrtScore,
  getStoredSrtResult,
} from "../utils/srtScoring";

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
  onRestart,
  onBackToMenu,
}) => {
  const navigate = useNavigate();

  const normalizedRecords = useMemo(() => {
    if (Array.isArray(trialRecords) && trialRecords.length > 0) {
      return trialRecords.map((record, index) => ({
        trialIndex: record.trialIndex ?? record.trial ?? index + 1,
        isCorrect:
          record.isCorrect !== undefined
            ? record.isCorrect
            : record.hit === true,
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
        clickedRotten: record.clickedRotten === true,
        trainingAction: record.trainingAction || null,
        targetType: record.targetType || "normal",
        positionX: record.positionX ?? null,
        positionY: record.positionY ?? null,
        timestamp: record.timestamp || null,
      }));
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
      }));
    }

    return [];
  }, [trialRecords, rtRecords]);

  const scoringResult = useMemo(() => {
    if (normalizedRecords.length > 0) {
      return calculateSrtScore(normalizedRecords);
    }

    const stored = getStoredSrtResult();

    if (stored?.scoring) return stored.scoring;
    if (stored?.summary && stored?.childView) return stored;

    return calculateSrtScore([]);
  }, [normalizedRecords]);

  const summary = scoringResult?.summary || {};
  const childView = scoringResult?.childView || {};
  const parentView = scoringResult?.parentView || {};

  const isTrainingMode = mode === "training" || summaryData?.mode === "training";

  const stars = Math.max(
    0,
    Math.min(
      3,
      Number(
        childView.stars ||
          scoringResult?.stars ||
          starResult?.stars ||
          starResult?.star ||
          1
      ) || 1
    )
  );

  const totalScore = scoringResult?.totalScore ?? starResult?.totalScore ?? 0;

  const displayScore = isTrainingMode
    ? summaryData?.finalScore ?? score
    : totalScore;

  const childShortLabel = isTrainingMode
    ? getTrainingChildLabel(summaryData?.finalScore ?? score)
    : childView.shortLabel || starResult?.level || "繼續加油";

  const abilityScores = sanitizeAbilityScores(parentView?.abilityScores, summary);

  const parentPlainSummary = isTrainingMode
    ? buildTrainingParentSummary(summaryData)
    : parentView?.plainLanguageSummary ||
      buildTestParentSummary({ stars, summary, abilityScores });

  const oneSentenceResult = isTrainingMode
    ? buildTrainingOneSentence(summaryData)
    : buildTestOneSentence({ stars, summary, abilityScores });

  const keyHighlights = isTrainingMode
    ? buildTrainingHighlights(summaryData)
    : buildTestHighlights({ summary, abilityScores });

  const nextSuggestion = isTrainingMode
    ? buildTrainingNextSuggestion(summaryData)
    : buildTestNextSuggestion({ stars, summary, abilityScores });

  const intuitiveIndicators = isTrainingMode
    ? buildTrainingIndicators(summaryData, avgRT)
    : buildIntuitiveIndicators({ summary, abilityScores });

  const quickStats = isTrainingMode
    ? [
        {
          label: "接到橡實",
          value: `${summaryData?.hitCount || 0} 次`,
          helper: "正確點到可以接的橡實",
        },
        {
          label: "漏接橡實",
          value: `${summaryData?.missCount || missCount || 0} 次`,
          helper: "可以再觀察是否看得到目標",
        },
        {
          label: "平均反應",
          value: formatMsShort(summaryData?.avgRT || avgRT || 0),
          helper: "接到橡實時的平均速度",
        },
        {
          label: "避開壞橡實",
          value: `${summaryData?.correctAvoidCount || 0} 次`,
          helper: "看清楚後忍住不點",
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

  const handleBackToMenu = () => {
    if (onBackToMenu) {
      onBackToMenu();
      return;
    }

    navigate("/game-menu");
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
          <p className="srt-result-subtitle">
            給家長看的結果說明｜用白話了解孩子這次在做什麼
          </p>
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

          <section className="srt-quick-stats">
            {quickStats.map((item) => (
              <article key={item.label} className="srt-stat-card">
                <p className="srt-stat-label">{item.label}</p>
                <p className="srt-stat-value">{item.value}</p>
                <p className="srt-stat-helper">{item.helper}</p>
              </article>
            ))}
          </section>

          <section className="srt-panel-block">
            <h2 className="srt-section-title">家長快速解讀</h2>
            <p className="srt-parent-summary-text">{parentPlainSummary}</p>
          </section>

          <section className="srt-panel-block">
            <h2 className="srt-section-title">家長可以這樣看</h2>
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
                    <p className="srt-indicator-score">{item.value} / 100</p>
                  )}
                  <p>{item.description || item.desc}</p>
                  {item.advice && <p className="srt-card-meaning">{item.advice}</p>}
                </article>
              ))}
            </div>
          </section>

          <section className="srt-next-card">
            <h2 className="srt-section-title">下一步建議</h2>
            <h3>{nextSuggestion.title}</h3>
            <p>{nextSuggestion.text}</p>
          </section>

          <section className="srt-note-box">
            <h3>給家長的小提醒</h3>
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
            <img src={homeBackBtn} alt="回到森林" />
          </button>

          <button
            type="button"
            className="srt-image-button"
            onClick={handleRestart}
            aria-label="再玩一次"
          >
            <img src={homeAgainBtn} alt="再玩一次" />
          </button>
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
    return "孩子反應很積極，但看到壞橡實時比較容易衝動點擊，下次可以先降低干擾。";
  }

  if (stars === 2) {
    return "孩子已經能完成不少反應任務，下次建議先維持同樣難度，讓表現更穩。";
  }

  return "孩子還在熟悉規則，建議下一次先放慢速度，讓孩子先建立成功經驗。";
}

function buildTrainingOneSentence(summaryData = {}) {
  const hitCount = summaryData?.hitCount || 0;
  const correctAvoidCount = summaryData?.correctAvoidCount || 0;

  return `孩子這次接到 ${hitCount} 顆橡實，也成功避開 ${correctAvoidCount} 顆壞橡實。這裡主要看孩子有沒有看清楚再點。`;
}

function buildTestParentSummary({ stars, summary = {}, abilityScores = {} }) {
  if (!summary.totalTrials) {
    return "目前還沒有完整結果。完成一次完整挑戰後，這裡會整理成家長看得懂的說明。";
  }

  const accuracyText =
    (summary.accuracyPercent || 0) >= 80
      ? "孩子大多能點到正確的橡實。"
      : (summary.accuracyPercent || 0) >= 60
      ? "孩子可以完成部分任務，但偶爾會漏掉或點錯。"
      : "孩子目前還在熟悉規則，點對的比例可以再練習。";

  const speedText = summary.avgReactionTime
    ? `平均反應約 ${(summary.avgReactionTime / 1000).toFixed(2)} 秒，家長可以把它理解成孩子看到橡實後按下去的速度。`
    : "目前有效反應時間資料不足。";

  const attentionText =
    (abilityScores.attentionMaintenance || 0) >= 80
      ? "前後段表現差異不大，代表孩子能維持注意力。"
      : (abilityScores.attentionMaintenance || 0) >= 60
      ? "後半段稍微變慢，可能開始有一點累。"
      : "後半段明顯變慢，建議下次先不要拉太長時間。";

  return `${accuracyText}${speedText}${attentionText}`;
}

function buildTrainingParentSummary(summaryData = {}) {
  const difficultyLabel = summaryData?.difficultyLabel || "普通";
  const hitCount = summaryData?.hitCount || 0;
  const missCount = summaryData?.missCount || 0;
  const correctAvoidCount = summaryData?.correctAvoidCount || 0;
  const clickedRottenCount = summaryData?.clickedRottenCount || 0;
  const avgRT = summaryData?.avgRT || 0;

  return `本次是「${difficultyLabel}」練習。孩子接到 ${hitCount} 次可以接的橡實，漏接 ${missCount} 次，平均反應約 ${(avgRT / 1000).toFixed(2)} 秒。若有壞橡實，孩子成功忍住 ${correctAvoidCount} 次，誤點 ${clickedRottenCount} 次。家長可以把它理解成：孩子有沒有先看清楚，再決定要不要點。`;
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
          : "孩子比較容易點到壞橡實，建議先減少干擾。",
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

function buildTrainingHighlights(summaryData = {}) {
  const hitCount = summaryData?.hitCount || 0;
  const missCount = summaryData?.missCount || 0;
  const clickedRottenCount = summaryData?.clickedRottenCount || 0;

  return [
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
      title: "下次先減少壞橡實干擾",
      text: "孩子看到壞橡實時比較容易衝動點擊，建議先練習「看清楚再點」，不要急著增加速度。",
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

function buildTrainingNextSuggestion(summaryData = {}) {
  const clickedRottenCount = summaryData?.clickedRottenCount || 0;
  const missCount = summaryData?.missCount || 0;
  const hitCount = summaryData?.hitCount || 0;

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

  return {
    title: "下次可以維持目前難度",
    text: "孩子這次能完成不少反應任務，建議先穩定練習，再慢慢增加挑戰。",
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
          ? "建議先減少壞橡實比例，練習看清楚再點。"
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
  return [
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
  ];
}

const resultPageCss = `
.srt-result-page {
  width: 100%;
  min-height: 100dvh;
  height: 100dvh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
  font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
  color: #5b3524;
}

.srt-result-main-card {
  width: min(1040px, 96vw);
  max-height: calc(100dvh - 40px);
  background: rgba(255, 248, 235, 0.97);
  border: 7px solid #f4b13a;
  border-radius: 34px;
  padding: 24px 34px 26px;
  box-sizing: border-box;
  box-shadow: 0 18px 36px rgba(81, 55, 20, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.srt-result-main-card::before {
  content: "";
  position: absolute;
  inset: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.8);
  border-radius: 26px;
  pointer-events: none;
}

.srt-result-header {
  text-align: center;
  margin-bottom: 14px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.srt-mode-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 8px;
  padding: 6px 18px;
  border-radius: 999px;
  background: #fff6db;
  border: 2px solid #efbd58;
  color: #915725;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.srt-result-main-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-width: min(560px, 84vw);
  margin: 0;
  padding: 14px 48px;
  border-radius: 20px;
  border: 4px solid #f0b24a;
  background: linear-gradient(180deg, #fff0ab 0%, #fff7cc 100%);
  box-shadow: 0 6px 0 #d99b3f;
  color: #6b3e22;
  font-size: clamp(34px, 5vw, 52px);
  font-weight: 950;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.62);
}

.srt-result-main-title::before,
.srt-result-main-title::after {
  content: "🌿";
  font-size: 26px;
}

.srt-result-subtitle {
  margin: 16px 0 0;
  color: #6a432e;
  font-size: 22px;
  font-weight: 900;
}

.srt-parent-panel {
  position: relative;
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 8px 14px;
  scrollbar-width: thin;
  scrollbar-color: #d9a340 rgba(255, 247, 225, 0.75);
}

.srt-parent-panel::-webkit-scrollbar {
  width: 10px;
}

.srt-parent-panel::-webkit-scrollbar-thumb {
  background: #d9a340;
  border-radius: 999px;
}

.srt-overview-card,
.srt-panel-block,
.srt-next-card,
.srt-note-box {
  background: rgba(255, 255, 255, 0.88);
  border: 4px solid rgba(236, 197, 123, 0.72);
  border-radius: 28px;
  box-shadow: 0 8px 0 rgba(205, 156, 62, 0.18), 0 12px 22px rgba(92, 58, 16, 0.09);
}

.srt-overview-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 22px;
  padding: 26px 30px;
  margin-bottom: 30px;
}

.srt-overview-left {
  display: flex;
  align-items: center;
  gap: 30px;
  min-width: 0;
}

.srt-score-circle {
  width: 184px;
  height: 184px;
  min-width: 184px;
  min-height: 184px;
  border-radius: 50%;
  background: linear-gradient(180deg, #86d7ff 0%, #43aee6 100%);
  border: 6px solid #ffffff;
  outline: 4px solid #88ccec;
  box-shadow: 0 7px 0 rgba(39, 125, 170, 0.28), 0 13px 22px rgba(40, 112, 148, 0.18);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.srt-score-number {
  font-size: 58px;
  font-weight: 950;
  line-height: 1;
}

.srt-score-unit {
  font-size: 28px;
  font-weight: 950;
  align-self: flex-end;
  margin-bottom: 36px;
}

.srt-overview-label,
.srt-card-label,
.srt-stat-label {
  margin: 0 0 8px;
  color: #835234;
  font-size: 15px;
  font-weight: 950;
  letter-spacing: 0.06em;
}

.srt-overview-title {
  margin: 0 0 12px;
  color: #5b2f20;
  font-size: clamp(30px, 3.4vw, 42px);
  font-weight: 950;
  line-height: 1.15;
}

.srt-overview-desc,
.srt-parent-summary-text,
.srt-parent-intro,
.srt-observation-card p,
.srt-next-card p,
.srt-note-box p {
  margin: 0;
  color: #6b3d2a;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.7;
}

.srt-star-summary {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 14px;
  border-radius: 24px;
  background: #fff8df;
  border: 3px solid #efd08b;
  text-align: center;
}

.srt-star-row {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.srt-star-chip {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff3cf;
  border: 3px solid #dfb55e;
  color: #c18a2f;
  font-size: 27px;
  line-height: 1;
  opacity: 0.5;
}

.srt-star-chip.is-on {
  background: linear-gradient(180deg, #fff2a6 0%, #ffc857 100%);
  color: #8b5a18;
  opacity: 1;
  box-shadow: 0 4px 0 #c88a28;
}

.srt-star-summary p {
  margin: 0;
  color: #6a432e;
  font-size: 16px;
  font-weight: 950;
}

.srt-star-summary small {
  color: #8a624d;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.45;
}

.srt-quick-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 26px;
}

.srt-stat-card {
  min-height: 126px;
  padding: 18px 16px;
  border-radius: 24px;
  background: rgba(255, 252, 244, 0.96);
  border: 3px solid rgba(239, 198, 124, 0.75);
  box-shadow: 0 7px 0 rgba(213, 165, 75, 0.17);
  box-sizing: border-box;
}

.srt-stat-value {
  margin: 0 0 6px;
  color: #5b2f20;
  font-size: 30px;
  font-weight: 950;
}

.srt-stat-helper {
  margin: 0;
  color: #8a624d;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.45;
}

.srt-panel-block,
.srt-next-card,
.srt-note-box {
  padding: 22px 26px;
  margin-bottom: 26px;
}

.srt-section-title {
  margin: 0 0 12px;
  color: #6b3a21;
  font-size: 24px;
  font-weight: 950;
}

.srt-highlight-grid,
.srt-indicator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.srt-indicator-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.srt-observation-card {
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 253, 247, 0.96);
  border: 3px solid rgba(236, 197, 123, 0.72);
  box-shadow: 0 7px 0 rgba(205, 156, 62, 0.15);
  box-sizing: border-box;
}

.srt-observation-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.srt-observation-card h3,
.srt-next-card h3,
.srt-note-box h3 {
  margin: 0 0 8px;
  color: #5d3220;
  font-size: 22px;
  font-weight: 950;
  line-height: 1.25;
}

.srt-status-pill {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff4de;
  border: 2px solid #f2c27d;
  color: #9a6322;
  font-size: 16px;
  font-weight: 950;
}

.srt-status-pill.good {
  background: #e9f8ef;
  color: #2f7d4f;
  border-color: #9ed9b4;
}

.srt-status-pill.watch {
  background: #fff4de;
  color: #9a6322;
  border-color: #f2c27d;
}

.srt-status-pill.alert {
  background: #fff0ec;
  color: #a9472d;
  border-color: #e7a08e;
}

.srt-status-pill.neutral {
  background: #eef7ff;
  color: #27719b;
  border-color: #9bd2f2;
}

.srt-indicator-score {
  color: #5b2f20 !important;
  font-size: 26px !important;
  font-weight: 950 !important;
  margin-bottom: 8px !important;
}

.srt-card-meaning {
  margin-top: 10px !important;
  padding-top: 10px;
  border-top: 2px dashed rgba(213, 165, 75, 0.38);
  color: #8a624d !important;
  font-size: 17px !important;
}

.srt-next-card {
  background: #fff6dc;
}

.srt-note-box {
  background: rgba(255, 250, 238, 0.92);
  margin-bottom: 16px;
}

.srt-action-btns {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 28px;
  padding-top: 2px;
}

.srt-image-button {
  width: clamp(168px, 16vw, 232px);
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 18px;
  line-height: 0;
  cursor: pointer;
  transform-origin: 50% 58%;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.srt-image-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 10px 8px rgba(74, 48, 16, 0.26));
}

.srt-image-button:hover {
  transform: translateY(-3px) scale(1.04);
  filter: brightness(1.05);
}

.srt-image-button:active {
  transform: translateY(2px) scale(0.97);
}

@media (max-width: 1024px) {
  .srt-result-main-card {
    padding: 22px 24px 24px;
  }

  .srt-overview-card,
  .srt-overview-left {
    align-items: center;
  }

  .srt-quick-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .srt-highlight-grid,
  .srt-indicator-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .srt-result-page {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
    padding: 14px;
  }

  .srt-result-main-card {
    max-height: none;
    width: 100%;
    border-width: 5px;
    border-radius: 28px;
    padding: 18px 14px 20px;
  }

  .srt-result-main-title {
    min-width: auto;
    width: 100%;
    padding: 12px 18px;
    font-size: 30px;
  }

  .srt-result-main-title::before,
  .srt-result-main-title::after {
    display: none;
  }

  .srt-result-subtitle {
    font-size: 17px;
  }

  .srt-parent-panel {
    overflow: visible;
    padding: 4px 2px 14px;
  }

  .srt-overview-card {
    flex-direction: column;
    padding: 20px 16px;
    gap: 18px;
  }

  .srt-overview-left {
    flex-direction: column;
    gap: 18px;
    text-align: center;
  }

  .srt-score-circle {
    width: 136px;
    height: 136px;
    min-width: 136px;
    min-height: 136px;
  }

  .srt-score-number {
    font-size: 46px;
  }

  .srt-score-unit {
    font-size: 22px;
    margin-bottom: 26px;
  }

  .srt-star-summary {
    flex-basis: auto;
    width: 100%;
  }

  .srt-quick-stats {
    grid-template-columns: 1fr;
  }

  .srt-overview-desc,
  .srt-parent-summary-text,
  .srt-parent-intro,
  .srt-observation-card p,
  .srt-next-card p,
  .srt-note-box p {
    font-size: 17px;
  }

  .srt-panel-block,
  .srt-next-card,
  .srt-note-box {
    padding: 18px 16px;
  }

  .srt-action-btns {
    gap: 16px;
    flex-wrap: wrap;
  }

  .srt-image-button {
    width: min(72vw, 206px);
  }
}
`;

export default ResultPage_SRT;
