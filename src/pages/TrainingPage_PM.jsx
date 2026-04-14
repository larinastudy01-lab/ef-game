import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function arraysEqualAsSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return [...arr1].sort().join(",") === [...arr2].sort().join(",");
}

export default function TrainingPage_PM() {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const answerStartRef = useRef(null);

  const [phase, setPhase] = useState("difficulty");
  // difficulty -> rules -> introVideo -> readyCountdown -> memorize -> answer -> feedback

  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(1);

  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [readyCountdown, setReadyCountdown] = useState(5);
  const [memorizeCountdown, setMemorizeCountdown] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);

  const playClick = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

    const getDifficultyConfig = () => {
    if (difficulty === 1) {
        return {
        label: "Lv1 簡單",
        memoryCount: Math.min(2 + Math.floor((round - 1) / 3), 3),
        showTime: Math.max(6 - Math.floor((round - 1) / 5) * 0.5, 5),
        };
    }

    if (difficulty === 2) {
        return {
        label: "Lv2 普通",
        memoryCount: Math.min(4 + Math.floor((round - 1) / 3), 5),
        showTime: Math.max(4 - Math.floor((round - 1) / 5) * 0.4, 3),
        };
    }

    return {
        label: "Lv3 困難",
        memoryCount: Math.min(5 + Math.floor((round - 1) / 3), 6),
        showTime: Math.max(4 - Math.floor((round - 1) / 5) * 0.4, 3),
    };
    };

  const currentConfig = getDifficultyConfig();

  const setupRound = () => {
    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, currentConfig.memoryCount);

    const distractorCount = Math.max(currentConfig.memoryCount, 2);
    const distractors = shuffleArray(
      ALL_ITEMS.filter((item) => !memorizeItems.some((m) => m.id === item.id))
    ).slice(0, distractorCount);

    const options = shuffleArray([...memorizeItems, ...distractors]);

    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setMemorizeCountdown(currentConfig.showTime);
    setPhase("memorize");
  };

  const handleSelectDifficulty = (level) => {
    playClick();
    setDifficulty(level);
  };

  const handleStartFromDifficulty = () => {
    playClick();
    setRound(1);
    setReadyCountdown(5);
    setFeedbackText("");
    setSelectedIds([]);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setPhase("rules");
  };

  const handleStart = () => {
    playClick();
    setReadyCountdown(5);
    setPhase("introVideo");
  };

  const handleVideoEnd = () => {
    setReadyCountdown(5);
    setPhase("readyCountdown");
  };

  useEffect(() => {
    if (phase !== "readyCountdown") return undefined;

    if (readyCountdown <= 0) {
      setupRound();
      return undefined;
    }

    const timer = setTimeout(() => {
      setReadyCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, readyCountdown, difficulty, round]);

  useEffect(() => {
    if (phase !== "memorize") return undefined;

    if (memorizeCountdown <= 0) {
      setPhase("answer");
      answerStartRef.current = performance.now();
      return undefined;
    }

    const timer = setTimeout(() => {
      setMemorizeCountdown((prev) => Math.max(0, +(prev - 0.5).toFixed(1)));
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, memorizeCountdown]);

  const toggleSelect = (itemId) => {
    if (phase !== "answer") return;

    playClick();

    setSelectedIds((prev) => {
      const alreadySelected = prev.includes(itemId);

      if (alreadySelected) {
        return prev.filter((id) => id !== itemId);
      }

      if (prev.length >= currentConfig.memoryCount) {
        return prev;
      }

      return [...prev, itemId];
    });
  };

  const handleSubmit = () => {
    if (phase !== "answer") return;

    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const isCorrect = arraysEqualAsSet(selectedIds, correctIds);

    if (isCorrect) {
      setFeedbackText("太棒了！你越來越厲害了 💖");
    } else {
      setFeedbackText("沒關係，我們再試一次看看 🌱");
    }

    setPhase("feedback");
  };

  const handleNext = () => {
    playClick();
    setRound((prev) => prev + 1);
    setReadyCountdown(5);
    setSelectedIds([]);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setPhase("readyCountdown");
  };

  const intensity = Math.min(1, (round - 1) / 8);

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>Picture Memory 訓練</h1>

          {phase === "difficulty" && (
            <div style={styles.card}>
              <h2 style={styles.subtitle}>選擇難度</h2>
              <p style={styles.text}>先選擇你想要的訓練模式喔！</p>

              <div style={styles.difficultyGrid}>
                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(1)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 1 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>簡單</div>
                  <div style={styles.difficultyDesc}>無干擾</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(2)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 2 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>普通</div>
                  <div style={styles.difficultyDesc}>⭐ 閃爍 </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(3)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 3 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>困難</div>
                  <div style={styles.difficultyDesc}>🔥 動態移動 </div>
                </button>
              </div>

              <button style={styles.mainButton} onClick={handleStartFromDifficulty}>
                開始
              </button>
            </div>
          )}

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
                練習時會依照難度加入不同干擾喔！
              </p>

              <button style={styles.mainButton} onClick={handleStart}>
                開始
              </button>
            </div>
          )}

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

              <button style={styles.secondaryButton} onClick={handleVideoEnd}>
                跳過
              </button>
            </div>
          )}

          {phase === "readyCountdown" && (
            <div style={styles.smallCard}>
              <p style={styles.levelText}>{currentConfig.label}</p>
              <h2 style={styles.subtitle}>準備開始</h2>
              <p style={styles.bigCountdown}>{readyCountdown}</p>
              <p style={styles.text}>遊戲即將開始！</p>
            </div>
          )}

          {phase === "memorize" && (
            <div style={styles.card}>
              <p style={styles.levelText}>
                {currentConfig.label}｜第 {round} 回合
              </p>
              <h2 style={styles.subtitle}>
                請記住這 {currentConfig.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>請仔細記住這些物品喔！</p>

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item, index) => {
                  const imageStyle = { ...styles.memoryImage };

                  if (difficulty === 2) {
                    const flicker = Math.random() < 0.3 + intensity * 0.5;
                    imageStyle.opacity = flicker ? 0.45 : 1;
                  }

                  if (difficulty === 3) {
                    const offset = Math.sin(Date.now() / 220 + index) * (8 + intensity * 18);
                    imageStyle.transform = `translateX(${offset}px)`;
                  }

                  return (
                    <div key={item.id} style={styles.memoryCard}>
                      <img src={item.image} alt={item.id} style={imageStyle} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "answer" && (
            <div style={styles.card}>
              <p style={styles.levelText}>
                {currentConfig.label}｜第 {round} 回合
              </p>
              <h2 style={styles.subtitle}>
                請選出剛剛出現的 {currentConfig.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>
                已選 {selectedIds.length} / {currentConfig.memoryCount}
              </p>

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
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
                  opacity: selectedIds.length === currentConfig.memoryCount ? 1 : 0.5,
                  cursor:
                    selectedIds.length === currentConfig.memoryCount
                      ? "pointer"
                      : "not-allowed",
                }}
                onClick={handleSubmit}
                disabled={selectedIds.length !== currentConfig.memoryCount}
              >
                送出答案
              </button>
            </div>
          )}

         {phase === "feedback" && (
  <div style={styles.smallCard}>
    <h2 style={styles.subtitle}>{feedbackText}</h2>

            {/* 按鈕容器（重點） */}
            <div
            style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                marginTop: "20px",
            }}
            >
            <button style={styles.mainButton} onClick={handleNext}>
                下一回合
            </button>

            <button
                style={styles.secondaryButton}
                onClick={() => {
                playClick();
                navigate("/result-picture-memory");
                }}
            >
                結束遊戲
            </button>
            </div>
        </div>
        )}
          )
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

  difficultyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginTop: "18px",
    marginBottom: "28px",
  },

  difficultyCard: {
    border: "3px solid transparent",
    borderRadius: "24px",
    padding: "24px 18px",
    backgroundColor: "#fff",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    cursor: "pointer",
    transition: "0.2s",
    color: "#5C4033",
  },

  difficultyCardActive: {
    border: "3px solid #F4A261",
    backgroundColor: "#FFF3E8",
    transform: "translateY(-2px)",
  },

  difficultyTitle: {
    fontSize: "28px",
    fontWeight: "800",
    marginBottom: "8px",
    color: "#7A4F2B",
  },

  difficultyLabel: {
    fontSize: "22px",
    fontWeight: "800",
    marginBottom: "8px",
    color: "#5C4033",
  },

  difficultyDesc: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#8B5E3C",
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
    maxWidth: "200px",
    height: "200px",
    objectFit: "contain",
    transition: "0.2s",
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
    marginTop: "12px"
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
};