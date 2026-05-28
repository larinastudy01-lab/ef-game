// src/pages/ResultPage_DCCS.jsx

import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_DCCS.css";

import calculateDccsScore from "../utils/dccsScoring";

const MENU_ROUTE = "/game-menu";
const TEST_ROUTE = "/test-dccs";
const TRAINING_ROUTE = "/training-dccs";
const SESSION_KEYS = [
  "DCCS_RESULT",
  "DCCS_TEST_RESULT",
  "DCCS_TRAINING_RESULT",
  "dccsTrainingResult",
  "dccsTestResult",
];

const DIFFICULTY_TO_LEVEL = {
  colorIntro: 1,
  colorStable: 2,
  typeIntro: 3,
  typeStable: 4,
  switchClear: 5,
  switchEarly: 6,
  switchMaintain: 7,
  lowInterference: 8,
  highInterference: 9,
  testLike: 10,
  easyIntro: 1,
  easyPlus: 2,
  switchIntro: 5,
  switchPlus: 7,
  interference: 9,
};

const LEVEL_INFO = {
  1: {
    title: "找一樣顏色",
    focus: "知道現在要看顏色",
    parentText: "這一關主要是在看孩子能不能記得：現在只要看衣服的顏色。",
    homeTip: "可以請孩子把玩具先照顏色分堆，例如紅色一堆、藍色一堆。",
  },
  2: {
    title: "顏色小練習",
    focus: "穩定照顏色分類",
    parentText: "這一關還是看顏色，但題目變多，重點是能不能穩穩照同一個玩法完成。",
    homeTip: "先固定一個玩法，不急著換規則，讓孩子多練幾次照顏色分類。",
  },
  3: {
    title: "找一樣衣服",
    focus: "知道現在要看衣服種類",
    parentText: "這一關主要是在看孩子能不能不看顏色，改看衣服是哪一種。",
    homeTip: "可以一起把衣服或圖片分成上衣、褲子、襪子、裙子。",
  },
  4: {
    title: "衣服小練習",
    focus: "穩定照衣服種類分類",
    parentText: "這一關是練習看衣服種類，還沒有強調換玩法，重點是先熟悉第二種分類方式。",
    homeTip: "讓孩子先穩定練習『看種類』，不要同時給太多提示。",
  },
  5: {
    title: "換玩法囉",
    focus: "玩法改變後能不能跟上",
    parentText: "這一關開始練習玩法改變：一開始看顏色，後來改成看衣服種類。",
    homeTip: "陪孩子說：『剛剛看顏色，現在換成看衣服。』讓孩子先停一下再作答。",
  },
  6: {
    title: "早一點換玩法",
    focus: "提早換玩法時能不能跟上",
    parentText: "這一關會比較早換玩法，孩子需要更快知道現在的分類方式已經不一樣了。",
    homeTip: "短短玩幾題就換玩法，例如先照顏色分 3 個，再改照種類分。",
  },
  7: {
    title: "不要忘記玩法",
    focus: "換玩法後能不能維持新玩法",
    parentText: "這一關不只看能不能切換，也看孩子切換後會不會又回到剛剛的玩法。",
    homeTip: "換玩法後多提醒一次：『現在一直都是看衣服，不看顏色喔。』",
  },
  8: {
    title: "不要被騙到",
    focus: "會不會還照剛剛的玩法",
    parentText: "這一關會有一點顏色干擾，重點是孩子能不能記得現在不是看顏色。",
    homeTip: "可以慢慢練，不用催快；先問孩子：『現在要看顏色還是看衣服？』",
  },
  9: {
    title: "看清楚再放",
    focus: "不被明顯顏色干擾",
    parentText: "這一關干擾更多，顏色會比較容易吸引注意，孩子要練習照新的玩法完成。",
    homeTip: "若孩子一直照顏色分，可以先回到前一關，用更明確的提示陪他練。",
  },
  10: {
    title: "自己試試看",
    focus: "接近正式測驗狀態",
    parentText: "這一關比較接近測驗，不會一直提示，重點是看孩子能不能自己記得玩法。",
    homeTip: "完成後先鼓勵，不要急著重測；可以休息後再練短回合。",
  },
};

const STAR_STATUS = {
  3: {
    label: "今天很穩定",
    detail: "孩子大多能自己完成，下一步可以慢慢增加一點挑戰。",
  },
  2: {
    label: "正在練習中",
    detail: "孩子已經有基礎，但玩法改變或題目變多時，可能還需要一點提醒。",
  },
  1: {
    label: "需要多一點提示",
    detail: "孩子可能還在熟悉玩法，建議先回到簡單、短回合練習。",
  },
};

function readStoredResult() {
  for (const key of SESSION_KEYS) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn(`${key} 解析失敗：`, error);
    }
  }

  return null;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  const number = safeNumber(value, min);
  const safeMin = safeNumber(min, 0);
  const safeMax = safeNumber(max, 100);

  return Math.min(Math.max(number, safeMin), safeMax);
}

function percent(value) {
  const number = safeNumber(value, 0);
  const normalized = number >= 0 && number <= 1 ? number * 100 : number;

  return clamp(Math.round(normalized), 0, 100);
}

function clearDccsResultCaches() {
  SESSION_KEYS.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`${key} 清除失敗：`, error);
    }
  });
}

function getSafeTrainingLevel(value, fallback = 5) {
  const level = Math.round(safeNumber(value, fallback));
  return clamp(level, 1, 10);
}

function getTrialLogsFromPayload(payload) {
  if (Array.isArray(payload?.trialLogs)) return payload.trialLogs;
  if (Array.isArray(payload?.dccsTrialLogs)) return payload.dccsTrialLogs;
  if (Array.isArray(payload?.DCCSTrialLogs)) return payload.DCCSTrialLogs;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.trials)) return payload.trials;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.result?.clinicianMetrics?.trialLogs)) {
    return payload.result.clinicianMetrics.trialLogs;
  }

  return [];
}

function normalizePayload(payload = {}) {
  const raw = payload?.result && typeof payload.result === "object" ? payload.result : payload;

  return {
    ...raw,
    trialLogs: getTrialLogsFromPayload(raw),
  };
}

function getMetricValue(result, modernKey, fallbackKey) {
  const indicators = result?.parentIndicators || {};
  const modern = indicators[modernKey];

  if (typeof modern === "number") return percent(modern);
  if (modern && typeof modern.value === "number") return percent(modern.value);
  if (typeof indicators[fallbackKey] === "number") return percent(indicators[fallbackKey]);

  return 0;
}

function getReadableLevel(value, emptyText = "這關還沒看這個") {
  const safeValue = clamp(safeNumber(value, 0), 0, 100);

  if (safeValue <= 0) return emptyText;
  if (safeValue >= 85) return "很穩定";
  if (safeValue >= 70) return "大致穩定";
  if (safeValue >= 50) return "正在練習";
  return "需要多一點提示";
}

function getApproxText(value) {
  const safeValue = clamp(safeNumber(value, 0), 0, 100);

  if (safeValue <= 0) return "尚未觀察";
  if (safeValue >= 85) return "大多數時候都可以完成";
  if (safeValue >= 70) return "多數時候可以完成";
  if (safeValue >= 50) return "有時候可以完成";
  return "目前需要比較多協助";
}

function getStarCount(value) {
  return clamp(Math.round(safeNumber(value, 1)), 1, 3);
}

function getDifficultyLevel(payload, result) {
  const directLevel = safeNumber(
    payload?.trainingLevel ??
      payload?.level ??
      payload?.trainingOrder ??
      result?.trainingLevel,
    0
  );

  if (directLevel >= 1 && directLevel <= 10) return getSafeTrainingLevel(directLevel);

  const difficulty =
    payload?.difficulty ||
    payload?.trainingDifficulty ||
    payload?.levelDifficulty ||
    result?.difficulty;

  return getSafeTrainingLevel(DIFFICULTY_TO_LEVEL[difficulty], 5);
}

function getRecommendedLevel(payload, result) {
  const saved = safeNumber(
    payload?.nextRecommendedDccsLevel ?? result?.nextRecommendedDccsLevel,
    0
  );

  if (saved >= 1 && saved <= 10) return getSafeTrainingLevel(saved);

  const currentLevel = getDifficultyLevel(payload, result);
  const stars = getStarCount(result?.stars);
  const oldRuleErrors = safeNumber(
    result?.perseverativeErrors ?? result?.oldRuleInterference,
    0
  );

  if (stars === 3 && oldRuleErrors <= 1) return getSafeTrainingLevel(currentLevel + 1, currentLevel);
  if (stars === 1 || oldRuleErrors >= 3) return getSafeTrainingLevel(currentLevel - 1, currentLevel);
  return getSafeTrainingLevel(currentLevel);
}

function getResultContext(payload, result) {
  const metrics = result?.clinicianMetrics || {};
  const level = getDifficultyLevel(payload, result);
  const recommendedLevel = getRecommendedLevel(payload, result);
  const levelInfo = LEVEL_INFO[level] || LEVEL_INFO[5];
  const recommendedInfo = LEVEL_INFO[recommendedLevel] || LEVEL_INFO[5];

  const postSwitchTrials = safeNumber(
    metrics.postSwitchTrials ?? metrics.switchTrials ?? result?.postSwitchTrials ?? result?.switchTrials,
    0
  );
  const interferenceTrials = safeNumber(
    metrics.interferenceTrials ?? result?.interferenceTrials,
    0
  );

  const hasSwitchData = postSwitchTrials > 0;
  const hasInterferenceData = interferenceTrials > 0 || level >= 8;

  const stars = getStarCount(result?.stars);
  const starStatus = STAR_STATUS[stars] || STAR_STATUS[1];

  return {
    level,
    levelInfo,
    recommendedLevel,
    recommendedInfo,
    hasSwitchData,
    hasInterferenceData,
    stars,
    starStatus,
  };
}

function buildParentInterpretation(result, context) {
  const accuracy = percent(result?.accuracy);
  const postSwitch = percent(result?.postSwitchAccuracy ?? result?.switchAccuracy);
  const interferenceControl = percent(result?.interferenceControl);
  const oldRuleErrors = safeNumber(result?.perseverativeErrors ?? result?.oldRuleInterference, 0);

  if (context.stars === 3) {
    return {
      headline: context.hasSwitchData
        ? "孩子今天能跟上玩法改變"
        : "孩子今天能穩定照著玩法完成",
      summary: context.hasSwitchData
        ? "孩子不只知道怎麼分類，也能在玩法改變後慢慢改用新的方式。"
        : "孩子能理解這一關要看什麼，並且大多能穩定完成。",
      good: "孩子能記得目前的玩法，作答時也比較穩定。",
      practice: context.hasInterferenceData
        ? "接下來可以繼續練習有一點干擾的關卡，看看孩子能不能不被剛剛的玩法影響。"
        : "接下來可以慢慢加入『換玩法』練習，例如先看顏色，再改成看衣服種類。",
    };
  }

  if (context.stars === 2) {
    return {
      headline: "孩子今天正在練習中",
      summary: context.hasSwitchData
        ? `孩子已經有基本分類能力。玩法改變時，約 ${postSwitch}% 的切換題能跟上，還需要一點時間穩定。`
        : `孩子整體約 ${accuracy}% 的題目能完成，代表已經開始理解這一關的玩法。`,
      good: "孩子不是完全不會，而是需要在規則變化或題目變多時多練幾次。",
      practice: context.hasSwitchData
        ? "玩法從『看顏色』變成『看衣服』時，孩子可能會短暫混淆。"
        : "可以先把單一玩法練穩，再進入換玩法關卡。",
    };
  }

  return {
    headline: "今天可以先從簡單玩法開始",
    summary: context.hasSwitchData
      ? `孩子玩法改變時比較容易混淆，這次大約有 ${oldRuleErrors} 次可能還照剛剛的玩法做。`
      : "孩子目前對這一關的分類玩法還需要更多熟悉時間。",
    good: "孩子願意完成任務，這就是後續練習的基礎。",
    practice: context.hasInterferenceData && interferenceControl > 0
      ? "孩子可能容易被明顯的顏色吸引，建議先降低干擾、縮短練習時間。"
      : "先不要一次給太多規則，讓孩子穩定知道『現在要看什麼』。",
  };
}

function ObservationCard({ icon, title, level, text, helper, active = true }) {
  return (
    <div
      className="Dcss-parent-explain-card"
      style={{ opacity: active ? 1 : 0.82 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ marginBottom: 6 }}>
            <span aria-hidden="true" style={{ marginRight: 8 }}>
              {icon}
            </span>
            {title}
          </h3>
          <p style={{ marginTop: 0 }}>{text}</p>
          {helper && (
            <p style={{ margin: "8px 0 0", color: "#8d6e63", fontWeight: 700 }}>
              {helper}
            </p>
          )}
        </div>

        <strong
          style={{
            color: active ? "#5d4037" : "#9e8b80",
            minWidth: 104,
            textAlign: "right",
          }}
        >
          {level}
        </strong>
      </div>
    </div>
  );
}

function ParentView({ payload, result, context, interpretation }) {
  const understandRule = getMetricValue(result, "understandRule", "ruleUnderstanding");
  const switchRule = getMetricValue(result, "switchRule", "cognitiveFlexibility");
  const avoidOldRule = getMetricValue(result, "avoidOldRule", "inhibitionControl");
  const stableResponse = getMetricValue(result, "stableResponse", "responseStability");

  const accuracy = percent(result?.accuracy);
  const correctCount = safeNumber(result?.correctCount ?? result?.clinicianMetrics?.correctCount, 0);
  const totalTrials = safeNumber(result?.totalTrials ?? result?.clinicianMetrics?.totalTrials, 0);

  const observations = [
    {
      title: "知道現在要看什麼",
      level: getReadableLevel(understandRule),
      text: "這是在看孩子有沒有抓到目前的玩法：現在是看顏色，還是看衣服種類。",
      helper: getApproxText(understandRule),
      active: true,
    },
    {
      title: "玩法改變後能不能跟上",
      level: context.hasSwitchData ? getReadableLevel(switchRule) : "這關還沒看這個",
      text: context.hasSwitchData
        ? "遊戲可能一開始看顏色，後來變成看衣服種類。這裡是在看孩子能不能跟著玩法一起改變。"
        : "這一關主要還在練單一玩法，所以先不判斷換玩法能力。",
      helper: context.hasSwitchData ? getApproxText(switchRule) : "等進入換玩法關卡後再觀察。",
      active: context.hasSwitchData,
    },
    {
      title: "會不會還照剛剛的玩法",
      level: context.hasInterferenceData ? getReadableLevel(avoidOldRule) : "這關還沒看這個",
      text: context.hasInterferenceData
        ? "玩法換了以後，有些孩子還會用上一輪的方法分類。這裡是在看孩子會不會被剛剛的玩法影響。"
        : "這一關還沒有明顯舊玩法干擾，所以不需要特別看這個。",
      helper: context.hasInterferenceData ? getApproxText(avoidOldRule) : "干擾關卡才會重點觀察。",
      active: context.hasInterferenceData,
    },
    {
      title: "能不能穩穩完成",
      level: getReadableLevel(stableResponse),
      text: "這不是看孩子有多快，而是看孩子能不能穩定完成，不是忽快忽慢或一直猜。",
      helper: getApproxText(stableResponse),
      active: true,
    },
  ];

  return (
    <>
      <div className="Dcss-section-title">
        <h1>家長觀察摘要</h1>
        <p>
          這不是診斷，也不是排名。這一頁用白話說明孩子今天在遊戲中做了什麼、哪裡穩定、下一步可以怎麼陪。
        </p>
      </div>

      <div className="Dcss-parent-explain-card" style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div>
            <span className="Dcss-tag">今日一句話</span>
            <h2 style={{ margin: "10px 0 8px" }}>{interpretation.headline}</h2>
            <p style={{ margin: 0 }}>{interpretation.summary}</p>
          </div>

          <div style={{ textAlign: "center", minWidth: 170 }}>
            <div style={{ fontSize: 34, letterSpacing: 2 }}>
              {"⭐".repeat(context.stars)}
            </div>
            <strong style={{ color: "#5d4037", display: "block", marginTop: 6 }}>
              {context.starStatus.label}
            </strong>
            <p style={{ margin: "6px 0 0", color: "#8d6e63", fontWeight: 700 }}>
              今天需要多少協助
            </p>
          </div>
        </div>
      </div>

      <div className="Dcss-parent-highlight-grid">
        <div className="Dcss-highlight-card">
          <span>這一關在看</span>
          <strong style={{ fontSize: 24 }}>{context.levelInfo.focus}</strong>
          <p>{context.levelInfo.parentText}</p>
        </div>

        <div className="Dcss-highlight-card">
          <span>今天的狀態</span>
          <strong>{context.starStatus.label}</strong>
          <p>{context.starStatus.detail}</p>
        </div>

        <div className="Dcss-highlight-card">
          <span>完成情形</span>
          <strong>{getReadableLevel(accuracy)}</strong>
          <p>
            {totalTrials > 0
              ? `共 ${totalTrials} 題，完成正確 ${correctCount} 題。`
              : "目前沒有收到完整題數資料。"}
          </p>
        </div>
      </div>

      <div className="Dcss-parent-explain-card" style={{ marginTop: 18 }}>
        <h3>先看這句就好</h3>
        <p style={{ marginBottom: 0 }}>
          {context.level <= 4
            ? "這一關還在練單一玩法。家長可以先看孩子是否知道現在要看顏色或看衣服，不用急著解讀換玩法能力。"
            : context.level <= 7
            ? "這一關開始練玩法改變。重點是孩子能不能從『看顏色』改成『看衣服種類』。"
            : "這一關加入干擾。重點是孩子能不能記得現在的玩法，不被剛剛的玩法拉回去。"}
        </p>
      </div>

      <div className="Dcss-parent-grid" style={{ marginTop: 18 }}>
        {observations.map((card) => (
          <ObservationCard key={card.title} {...card} />
        ))}
      </div>

      <div className="Dcss-parent-grid" style={{ marginTop: 18 }}>
        <div className="Dcss-parent-explain-card">
          <h3>孩子做得好的地方</h3>
          <p>{interpretation.good}</p>
        </div>

        <div className="Dcss-parent-explain-card">
          <h3>還可以練習的地方</h3>
          <p>{interpretation.practice}</p>
        </div>
      </div>

      <div className="Dcss-parent-explain-card" style={{ marginTop: 18 }}>
        <h3>家長可以怎麼陪</h3>
        <p>{context.levelInfo.homeTip}</p>
        <p style={{ marginBottom: 0 }}>
          可以用很短的句子提醒：「現在看顏色」、「現在換成看衣服」、「慢慢來，先想現在要看哪一個」。
        </p>
      </div>

      <div className="Dcss-parent-explain-card" style={{ marginTop: 18 }}>
        <h3>下一步建議</h3>
        <p>
          建議先練 <strong>第 {context.recommendedLevel} 關：{context.recommendedInfo.title}</strong>。
          這一關重點是「{context.recommendedInfo.focus}」。
        </p>
        <p style={{ marginBottom: 0 }}>
          每次練 3～5 分鐘就好，孩子穩定後再進入下一個挑戰。
        </p>
      </div>

      <div
        className="Dcss-parent-explain-card"
        style={{
          marginTop: 18,
          background: "rgba(255, 248, 225, 0.9)",
          border: "2px solid rgba(255, 193, 7, 0.35)",
        }}
      >
        <h3>家長不用擔心</h3>
        <p style={{ marginBottom: 0 }}>
          這不是診斷，也不是能力排名。孩子今天的狀態可能受到疲倦、分心、剛接觸新玩法影響。
          建議看多次練習的變化，不要只看一次結果。
        </p>
      </div>
    </>
  );
}

export default function ResultPage_DCCS() {
  const location = useLocation();
  const navigate = useNavigate();
  const actionLockRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const payload = useMemo(() => {
    const source = location.state || readStoredResult() || {};
    return normalizePayload(source);
  }, [location.state]);

  const result = useMemo(() => calculateDccsScore(payload), [payload]);
  const context = useMemo(() => getResultContext(payload, result), [payload, result]);
  const interpretation = useMemo(
    () => buildParentInterpretation(result, context),
    [result, context]
  );

  const leaveResultPage = (route, state = undefined) => {
    if (actionLockRef.current) return;

    actionLockRef.current = true;
    setIsNavigating(true);
    clearDccsResultCaches();
    navigate(route, state ? { state } : undefined);
  };

  const startRecommendedTraining = () => {
    const safeRecommendedLevel = getSafeTrainingLevel(context?.recommendedLevel, 5);

    leaveResultPage(TRAINING_ROUTE, {
      trainingLevel: safeRecommendedLevel,
      trainingOrder: safeRecommendedLevel,
      trainingTotal: 10,
      difficultyLabel: `第 ${safeRecommendedLevel} 關`,
      fromResult: true,
    });
  };

  return (
    <div className="Dcss-page">
      <main className="Dcss-result-shell">
        <header className="Dcss-result-header">
          <div>
            <div className="Dcss-tag">家長看的小紀錄</div>
            <h1>孔雀小姐的整理小紀錄</h1>
            <p className="Dcss-child-message">
              看看孩子今天在分類遊戲中，能不能記得「現在要看顏色」還是「現在要看衣服」。
            </p>
          </div>
        </header>

        <section className="Dcss-result-panel">
          <ParentView
            payload={payload}
            result={result}
            context={context}
            interpretation={interpretation}
          />
        </section>

        <footer className="Dcss-result-actions">
          <button
            type="button"
            className="Dcss-main-btn"
            onClick={startRecommendedTraining}
            disabled={isNavigating}
          >
            {isNavigating ? "準備中..." : "開始建議練習"}
          </button>

          <button
            type="button"
            className="Dcss-sub-btn"
            onClick={() => leaveResultPage(MENU_ROUTE)}
            disabled={isNavigating}
          >
            回到森林地圖
          </button>

          <button
            type="button"
            className="Dcss-sub-btn"
            onClick={() => leaveResultPage(TEST_ROUTE)}
            disabled={isNavigating}
          >
            稍後再測一次
          </button>
        </footer>
      </main>
    </div>
  );
}
