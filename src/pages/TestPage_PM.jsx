import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ===== 圖片 =====
import PM01 from "../asset/PM/PM_01.png";
import PM02 from "../asset/PM/PM_02.png";
import PM03 from "../asset/PM/PM_03.png";
import PM04 from "../asset/PM/PM_04.png";
import PM05 from "../asset/PM/PM_05.png";
import PM06 from "../asset/PM/PM_06.png";
import PM07 from "../asset/PM/PM_07.png";
import PM08 from "../asset/PM/PM_08.png";
import PM09 from "../asset/PM/PM_09.png";
import PM10 from "../asset/PM/PM_10.png";
import PM11 from "../asset/PM/PM_11.png";

// ===== 音效 / 背景 / 前導影片 =====
import clickSfx from "../asset/Click_SRT.mp3";
import bgImage from "../asset/SRT_background.jpg";
import introVideo from "../asset/SRT_start.mp4";

const ALL_ITEMS = [
  { id: "PM01", image: PM01 },
  { id: "PM02", image: PM02 },
  { id: "PM03", image: PM03 },
  { id: "PM04", image: PM04 },
  { id: "PM05", image: PM05 },
  { id: "PM06", image: PM06 },
  { id: "PM07", image: PM07 },
  { id: "PM08", image: PM08 },
  { id: "PM09", image: PM09 },
  { id: "PM10", image: PM10 },
  { id: "PM11", image: PM11 },
];

// ===== 難度設定 =====
const LEVELS = [
  { level: 1, memoryCount: 2, showTime: 5 },
  { level: 2, memoryCount: 3, showTime: 4 },
  { level: 3, memoryCount: 4, showTime: 3 },
  { level: 4, memoryCount: 5, showTime: 3 },
  { level: 5, memoryCount: 6, showTime: 2.5 },
  { level: 6, memoryCount: 7, showTime: 2.5 },
  { level: 7, memoryCount: 8, showTime: 2 },
  { level: 8, memoryCount: 9, showTime: 2 },
  { level: 9, memoryCount: 10, showTime: 2 },
];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function arraysEqualAsSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return [...arr1].sort().join(",") === [...arr2].sort().join(",");
}

export default function TestPage_PM() {
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const answerStartRef = useRef(null);
  const lastResultRef = useRef(null);

  const [phase, setPhase] = useState("rules");
  // rules -> introVideo -> readyCountdown -> memorize -> answer -> feedback

  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [readyCountdown, setReadyCountdown] = useState(5);
  const [memorizeCountdown, setMemorizeCountdown] = useState(0); // 不顯示
  const [answerCountdown, setAnswerCountdown] = useState(10); // 顯示

  const [feedbackText, setFeedbackText] = useState("");
  const [records, setRecords] = useState([]);
  const [tapLogs, setTapLogs] = useState([]); // ⭐ 每次點擊紀錄

  const currentLevel = LEVELS[currentLevelIndex];

  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);

  const playClick = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  // ===== 建立關卡 =====
  const setupLevel = (levelConfig) => {
    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, levelConfig.memoryCount);

    const distractorCount = Math.max(levelConfig.memoryCount, 2);
    const distractors = shuffleArray(
      ALL_ITEMS.filter((item) => !memorizeItems.some((m) => m.id === item.id))
    ).slice(0, distractorCount);

    const options = shuffleArray([...memorizeItems, ...distractors]);

    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setTapLogs([]); // ⭐ 每關重置點擊紀錄
    setMemorizeCountdown(levelConfig.showTime);
    setPhase("memorize");
  };

  // ===== 開始 =====
  const handleStart = () => {
    playClick();
    setCurrentLevelIndex(0);
    setRecords([]);
    setSelectedIds([]);
    setTapLogs([]);
    setFeedbackText("");
    lastResultRef.current = null;
    setReadyCountdown(5);
    setPhase("introVideo");
  };

  // ===== 影片播完 =====
  const handleVideoEnd = () => {
    setReadyCountdown(5);
    setPhase("readyCountdown");
  };

  // ===== 開始前倒數 =====
  useEffect(() => {
    if (phase !== "readyCountdown") return;

    if (readyCountdown <= 0) {
      setupLevel(LEVELS[currentLevelIndex]);
      return;
    }

    const timer = setTimeout(() => {
      setReadyCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, readyCountdown, currentLevelIndex]);

  // ===== 記憶倒數（不顯示）=====
  useEffect(() => {
    if (phase !== "memorize") return;

    if (memorizeCountdown <= 0) {
      setAnswerCountdown(10);
      setPhase("answer");
      answerStartRef.current = performance.now();
      return;
    }

    const timer = setTimeout(() => {
      setMemorizeCountdown((prev) => Math.max(0, +(prev - 0.5).toFixed(1)));
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, memorizeCountdown]);

  // ===== 作答倒數（10 秒內沒完成 = 失敗）=====
  useEffect(() => {
    if (phase !== "answer") return;

    if (answerCountdown <= 0) {
      const correctIds = currentMemorizeItems.map((item) => item.id);

      const record = {
        level: currentLevel.level,
        memoryCount: currentLevel.memoryCount,
        showTime: currentLevel.showTime,
        isCorrect: false,
        isTimeout: true,
        reactionTime: 10000,
        selectedIds,
        correctIds,
        tapLogs, // ⭐ 超時也要保留點擊歷程
      };

      lastResultRef.current = record;
      setRecords((prev) => [...prev, record]);
      setFeedbackText("時間到，挑戰失敗！");
      setPhase("feedback");
      return;
    }

    const timer = setTimeout(() => {
      setAnswerCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, answerCountdown, currentMemorizeItems, currentLevel, selectedIds, tapLogs]);

  // ===== 點選答案（記錄每次點擊）=====
  const toggleSelect = (itemId) => {
    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const now = answerStartRef.current
      ? Math.round(performance.now() - answerStartRef.current)
      : 0;

    setSelectedIds((prev) => {
      const alreadySelected = prev.includes(itemId);

      let nextSelected;

      if (alreadySelected) {
        nextSelected = prev.filter((id) => id !== itemId);
      } else {
        if (prev.length >= currentLevel.memoryCount) return prev;
        nextSelected = [...prev, itemId];
      }

      setTapLogs((prevLogs) => [
        ...prevLogs,
        {
          order: prevLogs.length + 1,
          itemId,
          timestamp: now,
          isCorrectItem: correctIds.includes(itemId),
          action: alreadySelected ? "deselect" : "select",
          selectedCountAfter: nextSelected.length,
        },
      ]);

      return nextSelected;
    });
  };

  // ===== 送出答案 =====
  const handleSubmit = () => {
    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const isCorrect = arraysEqualAsSet(selectedIds, correctIds);

    const reactionTime = answerStartRef.current
      ? Math.round(performance.now() - answerStartRef.current)
      : 0;

    const record = {
      level: currentLevel.level,
      memoryCount: currentLevel.memoryCount,
      showTime: currentLevel.showTime,
      isCorrect,
      isTimeout: false,
      reactionTime,
      selectedIds,
      correctIds,
      tapLogs, // ⭐ 正式存進 record
    };

    lastResultRef.current = record;
    setRecords((prev) => [...prev, record]);
    setFeedbackText(isCorrect ? "答對了！準備進入下一關" : "答錯了，本次測驗結束！");
    setPhase("feedback");
  };

  // ===== 下一步 =====
  const handleNext = () => {
    playClick();

    const lastRecord = lastResultRef.current;
    if (!lastRecord) return;

    if (lastRecord.isCorrect) {
      const nextIndex = currentLevelIndex + 1;

      if (nextIndex < LEVELS.length) {
        setCurrentLevelIndex(nextIndex);
        setSelectedIds([]);
        setCurrentMemorizeItems([]);
        setCurrentOptions([]);
        setTapLogs([]);
        setFeedbackText("");
        lastResultRef.current = null;
        setReadyCountdown(5);
        setPhase("readyCountdown");
      } else {
        navigate("/result-picture-memory", {
          state: { records },
        });
      }
    } else {
      navigate("/result-picture-memory", {
        state: { records },
      });
    }
  };

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>Picture Memory 測驗</h1>

          {/* ===== 規則頁 ===== */}
          {phase === "rules" && (
            <div style={styles.smallCard}>
              <h2 style={styles.subtitle}>遊戲規則</h2>
              <p style={styles.text}>
                兔子妹妹經過湖畔時，不小心把隨身的物品掉丟了。
                <br />
                請你先記住她掉了哪些東西，
                <br />
                等一下再把它們找出來！
                <br />
                每答對一關，就會變得更難喔！
              </p>

              <button style={styles.mainButton} onClick={handleStart}>
                開始
              </button>
            </div>
          )}

          {/* ===== 前導影片 ===== */}
          {phase === "introVideo" && (
            <div style={styles.mediumCard}>
              <h2 style={styles.subtitle}>準備開始囉！</h2>
              <p style={styles.text}>請先看看遊戲小故事</p>

              <div style={styles.videoWrapper}>
                <video
                  src={introVideo}
                  style={styles.video}
                  autoPlay
                  controls={false}
                  onEnded={handleVideoEnd}
                />
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  playClick();
                  handleVideoEnd();
                }}
              >
                跳過
              </button>
            </div>
          )}

          {/* ===== 開始前倒數 ===== */}
          {phase === "readyCountdown" && (
            <div style={styles.smallCard}>
              <h2 style={styles.subtitle}>準備開始</h2>
              <p style={styles.bigCountdown}>{readyCountdown}</p>
              <p style={styles.text}>遊戲即將開始！</p>
            </div>
          )}

          {/* ===== 記憶頁 ===== */}
          {phase === "memorize" && currentLevel && (
            <div style={styles.card}>
              <p style={styles.levelText}>第 {currentLevel.level} 關</p>
              <h2 style={styles.subtitle}>
                請記住這 {currentLevel.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>請仔細記住這些物品喔！</p>

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item) => (
                  <div key={item.id} style={styles.memoryCard}>
                    <img src={item.image} alt={item.id} style={styles.memoryImage} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 作答頁 ===== */}
          {phase === "answer" && currentLevel && (
            <div style={styles.card}>
              <p style={styles.levelText}>第 {currentLevel.level} 關</p>
              <h2 style={styles.subtitle}>
                請選出剛剛出現的 {currentLevel.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>
                已選 {selectedIds.length} / {currentLevel.memoryCount}
              </p>

              <p style={styles.answerTimer}>剩下 {answerCountdown} 秒</p>

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.optionCardSelected : {}),
                      }}
                    >
                      <img src={item.image} alt={item.id} style={styles.optionImage} />
                    </button>
                  );
                })}
              </div>

              <button
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentLevel.memoryCount ? 1 : 0.5,
                  cursor:
                    selectedIds.length === currentLevel.memoryCount
                      ? "pointer"
                      : "not-allowed",
                }}
                onClick={handleSubmit}
                disabled={selectedIds.length !== currentLevel.memoryCount}
              >
                送出答案
              </button>
            </div>
          )}

          {/* ===== 回饋頁 ===== */}
          {phase === "feedback" && (
            <div style={styles.smallCard}>
              <h2 style={styles.subtitle}>{feedbackText}</h2>

              <button style={styles.mainButton} onClick={handleNext}>
                下一步
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: (bgImage) => ({
    minHeight: "100vh",
    width: "100%",
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }),

  overlay: {
    minHeight: "100vh",
    width: "100%",
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  container: {
    width: "100%",
    maxWidth: "1150px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  smallCard: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "40px 34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  mediumCard: {
    width: "100%",
    maxWidth: "900px",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  title: {
    fontSize: "42px",
    fontWeight: "800",
    color: "#5C4033",
    textShadow: "2px 2px 0 #fff",
    margin: 0,
  },

  subtitle: {
    fontSize: "34px",
    color: "#7A4F2B",
    marginBottom: "18px",
    fontWeight: "800",
  },

  text: {
    fontSize: "24px",
    lineHeight: 1.8,
    color: "#4D3B2F",
    marginBottom: "28px",
  },

  hintText: {
    fontSize: "22px",
    color: "#7A4F2B",
    fontWeight: "700",
    marginBottom: "22px",
  },

  levelText: {
    fontSize: "22px",
    color: "#8B5E3C",
    fontWeight: "700",
    marginBottom: "10px",
  },

  bigCountdown: {
    fontSize: "100px",
    fontWeight: "900",
    color: "#F4A261",
    margin: "20px 0",
    textShadow: "2px 2px 0 #fff",
  },

  answerTimer: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#D97706",
    marginBottom: "18px",
  },

  videoWrapper: {
    width: "100%",
    maxWidth: "760px",
    margin: "0 auto 24px",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    backgroundColor: "#000",
  },

  video: {
    width: "100%",
    height: "auto",
    display: "block",
    aspectRatio: "16 / 9",
    objectFit: "contain",
  },

  memoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "22px",
    marginTop: "16px",
    justifyItems: "center",
  },

  memoryCard: {
    backgroundColor: "#fff",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    width: "180px",
    maxWidth: "220px",
  },

  memoryImage: {
    width: "100%",
    maxWidth: "180px",
    height: "180px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "20px",
    marginTop: "20px",
    marginBottom: "28px",
    justifyItems: "center",
  },

  optionCard: {
    border: "4px solid transparent",
    borderRadius: "24px",
    padding: "18px",
    backgroundColor: "#fff",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    transition: "0.2s",
    width: "180px",
    maxWidth: "220px",
  },

  optionCardSelected: {
    border: "4px solid #7B61FF",
    backgroundColor: "#F3F0FF",
    transform: "scale(1.02)",
  },

  optionImage: {
    width: "100%",
    maxWidth: "180px",
    height: "180px",
    objectFit: "contain",
    marginBottom: "8px",
  },

  mainButton: {
    backgroundColor: "#F4A261",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "16px 36px",
    fontSize: "22px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
  },

  secondaryButton: {
    backgroundColor: "#8D6E63",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "16px 36px",
    fontSize: "22px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
    marginTop: "12px",
  },
};