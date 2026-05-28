import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import bgImage from "../asset/SRT_testbackground.png";
import clickSfx from "../asset/Click_SRT.mp3";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import { calculatePMScore } from "../utils/pmScoring";

export default function ResultPage_PM() {
  const navigate = useNavigate();
  const location = useLocation();

  const rawRecords = Array.isArray(location.state?.records)
    ? location.state.records
    : [];
  const mode = location.state?.mode === "training" ? "training" : "test";
  const clickAudioRef = useRef(null);

  const scoring = useMemo(() => {
    try {
      return calculatePMScore(rawRecords);
    } catch (error) {
      console.warn("PM scoring failed:", error);
      return null;
    }
  }, [rawRecords]);

  const summary = scoring?.summary || {};

  const stars = clampNumber(toSafeNumber(scoring?.stars, 0), 0, 3);
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

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSfx);
    clickAudioRef.current.preload = "auto";

    return () => {
      if (clickAudioRef.current) {
        clickAudioRef.current.pause();
        clickAudioRef.current.currentTime = 0;
        clickAudioRef.current = null;
      }
    };
  }, []);

  const overview = buildParentOverview({
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

  const simpleIndicators = buildSimpleIndicators({
    memorySpan,
    accuracyPercent,
    averageCorrectReactionTime,
    timeoutCount,
    wrongTapCount,
    reactionTimeStd,
    totalLevels,
  });

  const nextSteps = buildNextSteps({
    stars,
    accuracyPercent,
    memorySpan,
    timeoutCount,
    wrongTapCount,
    averageCorrectReactionTime,
    totalLevels,
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
    navigate("/game-menu", { replace: true });
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
              這一頁用白話方式幫家長了解：孩子有沒有記住圖片、找對圖片，以及作答時是否穩定。
            </p>
          </header>

          <section style={styles.parentPanel}>
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
                <p style={styles.starHint}>請搭配下方觀察重點一起看，不是單一次診斷。</p>
              </div>
            </section>

            <section style={styles.quickStats}>
              <StatCard label="完成題數" value={`${totalLevels} 題`} helper="孩子完成了多少題" />
              <StatCard label="找對圖片" value={`${correctCount} 題`} helper="答案完全正確的題數" />
              <StatCard label="最多記住" value={`${memorySpan} 個`} helper="一次最多記住幾個圖片" />
              <StatCard label="逾時題數" value={`${timeoutCount} 題`} helper="沒有在時間內完成" />
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 style={styles.sectionTitle}>家長可以這樣看</h2>
                  <p style={styles.parentIntro}>
                    不需要先懂專有名詞，只要看每張卡片的「孩子在做什麼」和「代表什麼」。
                  </p>
                </div>
              </div>

              <div style={styles.abilityGrid}>
                {simpleIndicators.map((item) => (
                  <ParentObservationCard key={item.key} item={item} />
                ))}
              </div>
            </section>

            <section style={styles.suggestionPanel}>
              <h2 style={styles.sectionTitle}>下一步建議</h2>
              <div style={styles.suggestionList}>
                {nextSteps.map((step, index) => (
                  <div key={index} style={styles.suggestionItem}>
                    <span style={styles.suggestionIcon}>{step.icon}</span>
                    <p style={styles.suggestionText}>{step.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.noteBox}>
              <h3 style={styles.noteTitle}>給家長的小提醒</h3>
              <p style={styles.noteText}>
                這份結果是本次遊戲中的觀察紀錄，可以幫助了解孩子在「記圖片、找圖片、專心作答」時的狀況；不代表醫療診斷，建議搭配多次練習或其他任務一起觀察。
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
              <img src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
            </button>

            <button
              type="button"
              style={styles.resultImageButton}
              onClick={handleRetry}
              aria-label="再玩一次"
            >
              <img src={homeAgainBtn} alt="再玩一次" style={styles.imageButtonImg} />
            </button>
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

function ParentObservationCard({ item }) {
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
  ];

  cacheKeys.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to remove session cache: ${key}`, error);
    }
  });
}

function buildParentOverview({
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
      message: "建議先完成一次圖像記憶任務，再回來看孩子的記憶與作答狀況。",
    };
  }

  const modeText = mode === "training" ? "這次練習" : "這次測驗";
  const rtText =
    averageCorrectReactionTime === null
      ? ""
      : `，答對題平均約 ${formatSeconds(averageCorrectReactionTime)} 秒完成`;

  if (stars >= 3) {
    return {
      title: "孩子這次表現穩定",
      message: `${modeText}完成 ${totalLevels} 題、找對 ${correctCount} 題，最多可以記住 ${memorySpan} 個圖片${rtText}。整體來看，孩子能記住圖片並找回正確答案。`,
    };
  }

  if (stars === 2) {
    return {
      title: "孩子已經能完成任務，可以再練得更穩",
      message: `${modeText}完成 ${totalLevels} 題、找對 ${correctCount} 題，正確率約 ${accuracyPercent}%。孩子可以記住部分圖片，但遇到圖片變多、時間較短或選項較多時，可能會比較吃力。`,
    };
  }

  if (timeoutCount > 0 || wrongTapCount > 0) {
    return {
      title: "孩子完成了任務，建議先放慢難度",
      message: `${modeText}有出現逾時或誤點的情況。這通常代表孩子可能需要更多時間看清楚、回想圖片，或先熟悉「先看、再找」的流程。`,
    };
  }

  return {
    title: "孩子完成了任務，建議持續觀察",
    message: `${modeText}完成 ${totalLevels} 題。可以再多進行幾次，觀察孩子在不同圖片數量下是否能穩定找對。`,
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
      question: "看完後，孩子能記住多少圖片？",
      status:
        memorySpan >= 5
          ? "表現穩定"
          : memorySpan >= 3
          ? "還不錯"
          : "可以慢慢練",
      tone: memorySpan >= 5 ? "good" : memorySpan >= 3 ? "normal" : "watch",
      description:
        memorySpan > 0
          ? `這次孩子最多一次記住 ${memorySpan} 個圖片。`
          : "目前還沒有足夠資料判斷孩子最多能記住幾個圖片。",
      meaning:
        memorySpan >= 5
          ? "代表孩子可以處理較多圖片，之後可以逐步增加挑戰。"
          : memorySpan >= 3
          ? "代表孩子已經能記住部分圖片，可以透過練習慢慢增加數量。"
          : "建議先從少量圖片開始，讓孩子熟悉記住圖片的方法。",
    },
    {
      key: "find",
      title: "有沒有找對圖片",
      question: "圖片消失後，孩子能不能找回正確答案？",
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
          ? "代表孩子能把剛剛看到的圖片和作答選項連起來。"
          : accuracyPercent >= 60
          ? "代表孩子有抓到規則，但圖片變多時可能還需要更多回想時間。"
          : "可能是圖片數量太多、看圖時間不足，或還不熟悉遊戲流程。",
    },
    {
      key: "time",
      title: "找答案花多久",
      question: "孩子是很快找到，還是需要比較久回想？",
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
          ? "代表孩子能在合理時間內回想並找出答案。"
          : "代表孩子可能需要比較多時間回想，不一定是不會，可能只是需要慢一點。",
    },
    {
      key: "attention",
      title: "有沒有亂點或逾時",
      question: "作答時有沒有太急、點錯，或時間不夠？",
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
          ? "孩子可能需要更長的作答時間，或在作答前先提醒他慢慢看。"
          : wrongTapRate >= 0.5
          ? "孩子可能比較急著點，可以提醒他先看清楚再選。"
          : timeoutCount > 0 || wrongTapCount > 0
          ? "有少量波動是正常的，可以再觀察是否常常發生。"
          : "代表孩子作答時較能維持注意力，也比較少衝動點擊。",
    },
    {
      key: "steady",
      title: "每一題穩不穩",
      question: "孩子每題表現差不多，還是忽快忽慢？",
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
          ? "代表孩子作答節奏穩定。"
          : reactionTimeStd <= 3000
          ? "可能和圖片數量、干擾選項或當下專心程度有關。"
          : "建議先降低難度，觀察孩子是否在簡單題也會忽快忽慢。",
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
}) {
  if (totalLevels === 0) {
    return [
      {
        text: "先完成一次圖像記憶任務，系統就能產生更完整的家長觀察結果。",
      },
    ];
  }

  const steps = [];

  if (accuracyPercent < 60) {
    steps.push({
      text: "下次可以先選擇較簡單的練習，讓孩子先熟悉「先記住、再找出來」的流程。",
    });
  }

  if (memorySpan < 3) {
    steps.push({
      text: "可以從 2～3 個圖片開始，請孩子先說出剛剛看到了什麼，再進入作答。",
    });
  }

  if (timeoutCount > 0) {
    steps.push({
      text: "如果常常逾時，先不要催促孩子變快，可以讓他慢慢回想，等穩定後再縮短時間。",
    });
  }

  if (wrongTapCount > 0) {
    steps.push({
      text: "如果有誤點，作答前可以提醒孩子：先看清楚每個選項，再點選答案。",
    });
  }

  if (
    averageCorrectReactionTime !== null &&
    averageCorrectReactionTime > 7500 &&
    accuracyPercent >= 60
  ) {
    steps.push({
      text: "孩子答對但花比較久，代表可能是回想速度較慢；可以先重視答對，再慢慢提升速度。",
    });
  }

  if (steps.length === 0 || stars >= 3) {
    steps.push({
      text: "這次表現穩定，可以逐步增加圖片數量，或進入下一個難度觀察是否仍能穩定完成。",
    });
  }

  return steps.slice(0, 3);
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
