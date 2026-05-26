// src/pages/ResultPage_SRT.jsx

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

import bgImg from "../asset/SRT_testbackground.png";
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

  /*
    =========================================================
    1. 整理資料來源
    =========================================================
  */

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

    return [];
  }, [trialRecords]);

  const scoringResult = useMemo(() => {
    if (normalizedRecords.length > 0) {
      return calculateSrtScore(normalizedRecords);
    }

    const stored = getStoredSrtResult();

    if (stored?.scoring) return stored.scoring;
    if (stored?.summary && stored?.childView) return stored;

    return calculateSrtScore([]);
  }, [normalizedRecords]);

  /*
    =========================================================
    2. 防呆資料
    =========================================================
  */

  const summary = scoringResult?.summary || {};
  const childView = scoringResult?.childView || {};
  const parentView = scoringResult?.parentView || {};

  const isTrainingMode = mode === "training" || summaryData?.mode === "training";

  const stars =
    childView.stars ||
    scoringResult?.stars ||
    starResult?.stars ||
    starResult?.star ||
    1;

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
    ? []
    : buildIntuitiveIndicators({ summary, abilityScores });

  const radarData = normalizeRadarData(intuitiveIndicators);
  const hasRadarData = radarData.length > 0;

  /*
    =========================================================
    3. 事件
    =========================================================
  */

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

  /*
    =========================================================
    4. 畫面
    =========================================================
  */

  return (
    <div
      className="srt-result-page"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)),
          url(${bgImg})
        `,
      }}
    >
      <style>{resultPageCss}</style>

      <div className="srt-result-card srt-soft-card">
        <h1 className="srt-result-main-title">
          {isTrainingMode ? "橡實練習完成" : "橡實挑戰完成"}
        </h1>

        <p className="srt-result-subtitle">
          給家長看的結果說明｜用白話了解孩子這次在做什麼
        </p>

        <div className="srt-overview-card srt-soft-card">
          <div className="srt-score-circle">
            <div className="srt-score-center">
              <span className="srt-score-number">{displayScore}</span>
              <span className="srt-score-unit">分</span>
            </div>
          </div>

          <div className="srt-overview-text-box">
            <p className="srt-overview-label">
              {isTrainingMode ? "這次練習" : "這次挑戰"}
            </p>

            <h2 className="srt-overview-title">{childShortLabel}</h2>

            <p className="srt-overview-desc">{oneSentenceResult}</p>
          </div>
        </div>

        <section className="srt-parent-panel">
          <div className="srt-parent-summary-box srt-summary-main">
            <p className="srt-mini-label">家長快速解讀</p>
            <p className="srt-parent-summary-text">{parentPlainSummary}</p>
          </div>

          <div className="srt-highlight-grid">
            {keyHighlights.map((item) => (
              <div key={item.title} className="srt-highlight-card srt-soft-card">
                <span className={`srt-highlight-badge ${item.tone}`}>{item.badge}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>

          <div className="srt-next-card srt-soft-card">
            <p className="srt-mini-label">下次建議</p>
            <h2>{nextSuggestion.title}</h2>
            <p>{nextSuggestion.text}</p>
          </div>

          {!isTrainingMode && (
            <>
              <h2 className="srt-section-title">孩子這次主要表現</h2>

              <div className="srt-indicator-grid">
                {intuitiveIndicators.map((item) => (
                  <div key={item.key} className="srt-indicator-card srt-soft-card">
                    <div className="srt-indicator-header">
                      <h3>{item.title}</h3>
                      <span>{item.status}</span>
                    </div>

                    <p className="srt-indicator-score">
                      {item.value} / 100
                    </p>

                    <p className="srt-indicator-desc">{item.description}</p>
                    <p className="srt-indicator-advice">{item.advice}</p>

                    <div className="srt-progress-track">
                      <div
                        className="srt-progress-fill"
                        style={{ width: `${safePercent(item.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="srt-chart-section srt-soft-card">
                <div className="srt-chart-header">
                  <div>
                    <p className="srt-mini-label">進階參考</p>
                    <h2 className="srt-section-title srt-chart-title">
                      能力分布圖
                    </h2>
                  </div>
                  <p>
                    越靠近外圈，代表這一項越穩定。家長可以先看上面的文字卡片，這張圖只是輔助比較。
                  </p>
                </div>

                <div className="srt-chart-box">
                  {hasRadarData ? (
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      minWidth={280}
                      minHeight={280}
                    >
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} />
                        <Radar
                          dataKey="value"
                          stroke="#ff8c42"
                          fill="#ffb26b"
                          fillOpacity={0.65}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="srt-chart-empty">
                      這次有效資料不足，暫時無法產生能力分布圖。
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {isTrainingMode && (
            <>
              <h2 className="srt-section-title">這次練習看什麼？</h2>

              <div className="srt-indicator-grid">
                <TrainingInfoCard
                  title="這次難度"
                  value={summaryData?.difficultyLabel || "普通"}
                  desc="代表這次橡實出現的速度、大小與干擾程度。"
                />
                <TrainingInfoCard
                  title="有沒有接到橡實？"
                  value={`${summaryData?.hitCount || 0} 次`}
                  desc="孩子正確點到可以接的橡實次數。"
                />
                <TrainingInfoCard
                  title="看到後點得多快？"
                  value={formatMsWithSeconds(summaryData?.avgRT || avgRT || 0)}
                  desc="這是成功接到橡實時的平均反應時間。"
                />
                <TrainingInfoCard
                  title="壞橡實有沒有忍住？"
                  value={`${summaryData?.correctAvoidCount || 0} 次`}
                  desc="孩子看到壞橡實時，成功忍住沒有點的次數。"
                />
                <TrainingInfoCard
                  title="金色橡實有沒有注意到？"
                  value={`${summaryData?.distractorMetrics?.goldenHitCount ?? summaryData?.goldenHitCount ?? 0} 次`}
                  desc="孩子有沒有注意到比較特別、比較值得接的金色橡實。"
                />
              </div>
            </>
          )}
        </section>

        <div className="srt-action-btns">
          <button
            type="button"
            className="srt-action-btn srt-menu-btn"
            onClick={handleBackToMenu}
          >
            回森林主頁
          </button>

          <button
            type="button"
            className="srt-action-btn srt-restart-btn"
            onClick={handleRestart}
          >
            再玩一次
          </button>
        </div>
      </div>
    </div>
  );
};

const TrainingInfoCard = ({ title, value, desc }) => {
  return (
    <div className="srt-indicator-card srt-soft-card">
      <div className="srt-indicator-header">
        <h3>{title}</h3>
        <span>{value}</span>
      </div>
      <p className="srt-indicator-desc">{desc}</p>
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

function normalizeRadarData(indicators = []) {
  if (!Array.isArray(indicators)) return [];

  return indicators
    .map((item) => ({
      subject: item?.shortLabel || item?.title || "指標",
      value: safePercent(item?.value, 0),
    }))
    .filter(
      (item) =>
        typeof item.subject === "string" &&
        item.subject.trim().length > 0 &&
        Number.isFinite(item.value)
    );
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

export default ResultPage_SRT;

/*
  =========================================================
  ResultPage CSS
  =========================================================
*/

const resultPageCss = `
.srt-result-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  text-align: center;
  padding: 24px;
  box-sizing: border-box;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.srt-result-card {
  width: 92%;
  max-width: 980px;
  min-width: 0;
  max-height: 92vh;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.965);
  backdrop-filter: blur(8px);
  border-radius: 34px;
  padding: 34px 32px;
  box-sizing: border-box;
  border: 2px solid rgba(255, 178, 107, 0.25);
}

.srt-soft-card {
  box-shadow: 0 12px 30px rgba(93, 64, 55, 0.12);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.srt-soft-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(93, 64, 55, 0.16);
}

.srt-result-main-title {
  font-size: 42px;
  color: #5d4037;
  margin: 0 0 8px;
  font-weight: 950;
  letter-spacing: 1px;
}

.srt-result-subtitle {
  font-size: 19px;
  color: #8d6e63;
  margin: 0 0 28px;
  font-weight: 800;
}

.srt-overview-card {
  width: 100%;
  background: #fff8ef;
  border-radius: 30px;
  padding: 28px 30px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.srt-score-circle {
  width: 164px;
  height: 164px;
  min-width: 164px;
  min-height: 164px;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffb26b, #ff8c42);
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow:
    0 12px 26px rgba(255, 140, 66, 0.32),
    inset 0 3px 8px rgba(255, 255, 255, 0.28);
}

.srt-score-center {
  display: flex;
  align-items: baseline;
  justify-content: center;
  line-height: 1;
  transform: translateY(1px);
}

.srt-score-number {
  font-size: 58px;
  font-weight: 950;
  line-height: 1;
  letter-spacing: -1px;
}

.srt-score-unit {
  font-size: 22px;
  font-weight: 950;
  margin-left: 4px;
  line-height: 1;
}

.srt-overview-text-box {
  text-align: left;
  max-width: 590px;
}

.srt-overview-label,
.srt-mini-label {
  margin: 0 0 6px;
  font-size: 17px;
  color: #9a6a48;
  font-weight: 950;
  letter-spacing: 0.5px;
}

.srt-overview-title {
  margin: 0 0 10px;
  font-size: 34px;
  color: #5d4037;
  font-weight: 950;
}

.srt-overview-desc {
  margin: 0;
  font-size: 21px;
  color: #6d4c41;
  line-height: 1.7;
  font-weight: 850;
}

.srt-parent-panel {
  width: 100%;
  min-width: 0;
}

.srt-section-title {
  font-size: 28px;
  color: #5d4037;
  margin: 26px 0 18px;
  font-weight: 950;
}

.srt-parent-summary-box {
  background: #fff7ef;
  border-radius: 24px;
  padding: 22px 24px;
  margin-bottom: 18px;
  border: 2px solid #ffecd6;
  text-align: left;
}

.srt-summary-main {
  background: #fffaf5;
}

.srt-parent-summary-text {
  font-size: 18px;
  color: #5d4037;
  line-height: 1.9;
  margin: 0;
  font-weight: 780;
}

.srt-highlight-grid,
.srt-indicator-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  min-width: 0;
}

.srt-highlight-card,
.srt-indicator-card,
.srt-next-card,
.srt-chart-section {
  min-width: 0;
  background: #ffffff;
  border-radius: 22px;
  padding: 18px;
  text-align: left;
  border: 2px solid #fff0df;
}

.srt-highlight-badge {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 950;
  margin-bottom: 10px;
}

.srt-highlight-badge.good {
  background: #e7f6df;
  color: #4f8f35;
}

.srt-highlight-badge.watch {
  background: #fff3d8;
  color: #c67a00;
}

.srt-highlight-badge.alert {
  background: #ffe5df;
  color: #c45135;
}

.srt-highlight-badge.neutral {
  background: #fff0df;
  color: #a56a3a;
}

.srt-highlight-card h3,
.srt-next-card h2 {
  font-size: 21px;
  color: #5d4037;
  margin: 0 0 8px;
  font-weight: 950;
}

.srt-highlight-card p,
.srt-next-card p,
.srt-chart-header p {
  font-size: 16px;
  color: #6d4c41;
  line-height: 1.75;
  margin: 0;
  font-weight: 760;
}

.srt-next-card {
  margin: 18px 0 4px;
  background: #fff8ef;
}

.srt-indicator-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.srt-indicator-header h3 {
  font-size: 20px;
  color: #5d4037;
  margin: 0;
  font-weight: 950;
}

.srt-indicator-header span {
  font-size: 15px;
  color: #ffffff;
  background: linear-gradient(145deg, #ff9f5a, #ff8c42);
  border-radius: 999px;
  padding: 7px 10px;
  font-weight: 950;
  white-space: nowrap;
}

.srt-indicator-score {
  font-size: 24px;
  color: #ff8c42;
  font-weight: 950;
  margin: 12px 0 4px;
}

.srt-indicator-desc,
.srt-indicator-advice {
  font-size: 15px;
  color: #6d4c41;
  line-height: 1.7;
  margin: 8px 0;
  font-weight: 720;
}

.srt-indicator-advice {
  color: #8d6e63;
  background: #fff8ef;
  border-radius: 14px;
  padding: 10px 12px;
}

.srt-progress-track {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: #f4e4d4;
  overflow: hidden;
  margin-top: 12px;
}

.srt-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ffb26b, #ff8c42);
}

.srt-chart-section {
  margin-top: 20px;
  padding: 20px;
  min-width: 0;
}

.srt-chart-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  text-align: left;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.srt-chart-title {
  margin: 0;
}

.srt-chart-header p {
  max-width: 520px;
}

.srt-chart-box {
  width: 100%;
  min-width: 280px;
  min-height: 320px;
  background: #fffdfa;
  border-radius: 24px;
  padding: 18px;
  box-sizing: border-box;
  border: 2px solid rgba(255, 240, 223, 0.8);
  overflow: hidden;
}

.srt-chart-empty {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8d6e63;
  font-size: 17px;
  font-weight: 850;
  line-height: 1.7;
  text-align: center;
}

.srt-action-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  margin-top: 32px;
  flex-wrap: wrap;
}

.srt-action-btn {
  min-width: 184px;
  height: 68px;
  border-radius: 22px;
  font-size: 22px;
  font-weight: 950;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.srt-menu-btn {
  border: 2px solid #ffb26b;
  background: linear-gradient(145deg, #fffaf5, #ffffff);
  color: #ff8c42;
  box-shadow: 0 7px 16px rgba(255, 178, 107, 0.26);
}

.srt-restart-btn {
  border: none;
  background: linear-gradient(145deg, #ff9f5a, #ff8c42);
  color: #ffffff;
  box-shadow: 0 9px 20px rgba(255, 140, 66, 0.35);
}

.srt-action-btn:hover {
  transform: translateY(-3px);
}

.srt-menu-btn:hover {
  background: #fff7ef;
  box-shadow: 0 11px 24px rgba(255, 178, 107, 0.32);
}

.srt-restart-btn:hover {
  background: linear-gradient(145deg, #ff9b50, #ff7a22);
  box-shadow: 0 12px 26px rgba(255, 140, 66, 0.42);
}

.srt-action-btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: 0 5px 12px rgba(255, 140, 66, 0.2);
}

@media (max-width: 768px) {
  .srt-result-page {
    padding: 18px;
    background-attachment: scroll;
  }

  .srt-result-card {
    width: 96%;
    padding: 28px 20px;
  }

  .srt-result-main-title {
    font-size: 34px;
  }

  .srt-result-subtitle {
    font-size: 18px;
  }

  .srt-overview-card {
    padding: 24px 18px;
    gap: 20px;
  }

  .srt-score-circle {
    width: 140px;
    height: 140px;
    min-width: 140px;
    min-height: 140px;
  }

  .srt-score-number {
    font-size: 50px;
  }

  .srt-overview-text-box {
    text-align: center;
  }

  .srt-overview-title {
    font-size: 30px;
  }

  .srt-overview-desc {
    font-size: 19px;
  }

  .srt-chart-header {
    display: block;
  }

  .srt-chart-box {
    min-width: 0;
  }
}

@media (max-width: 480px) {
  .srt-result-main-title {
    font-size: 30px;
  }

  .srt-score-circle {
    width: 124px;
    height: 124px;
    min-width: 124px;
    min-height: 124px;
  }

  .srt-score-number {
    font-size: 44px;
  }

  .srt-score-unit {
    font-size: 18px;
  }
}
`;
