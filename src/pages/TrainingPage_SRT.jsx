import bgImg from "../asset/SRT_testbackground.jpg";
import React, { useEffect, useRef, useState } from "react";
import normalImg from "../asset/acorn.png";
import goldenImg from "../asset/golden_acorn.png";
import rottenImg from "../asset/rotten_acorn.png";
import introVideo from "../asset/SRT_start.mp4";
import clickSoundFile from "../asset/Click_SRT.mp3";
import ResultPage_SRT from "./ResultPage_SRT";
import { useNavigate } from "react-router-dom";

// ===== 訓練模式固定總時長 =====
const TOTAL_TIME = 60000; // 60秒

// ===== 難度設定 =====
const difficultySettings = {
  easy: {
    label: "簡單",
    spawnInterval: 1600,
    visibleTime: 1200,
    itemSize: 90,
  },
  medium: {
    label: "普通",
    spawnInterval: 1600, // 跟簡單一致
    visibleTime: 1200,
    itemSize: 85,
  },
  hard: {
    label: "困難",
    spawnInterval: 1100, // 更快
    visibleTime: 850,
    itemSize: 78,
  },
};

// ===== 物件種類 =====
const objectTypes = {
  normal: {
    key: "normal",
    img: normalImg,
    score: 3,
    label: "普通橡實",
  },
  golden: {
    key: "golden",
    img: goldenImg,
    score: 5,
    label: "金色橡實",
  },
  rotten: {
    key: "rotten",
    img: rottenImg,
    score: -2,
    label: "壞掉橡實",
  },
};

// ===== 提示文字池 =====
const idlePrompts = [
  "快看看畫面喔！",
  "小飛鼠在等你幫忙！",
  "橡實出現了，快點一下！",
  "再試試看，我們一起加油！",
];

const TrainingPage_SRT = () => {
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState("medium");
  const [item, setItem] = useState(null);
  const [score, setScore] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [showRulePage, setShowRulePage] = useState(false);
  const [isCountdown, setIsCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [effect, setEffect] = useState(null);
  const [isClickable, setIsClickable] = useState(true);

  const [hintText, setHintText] = useState("準備好幫小飛鼠接橡實了嗎？");
  const [showHint, setShowHint] = useState(false);

  // ===== 訓練資料 =====
  const [trialRecords, setTrialRecords] = useState([]);
  const [rtRecords, setRtRecords] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [wrongClickCount, setWrongClickCount] = useState(0);
  const [totalSpawn, setTotalSpawn] = useState(0);

  const spawnTimeRef = useRef(null);
  const itemTimeoutRef = useRef(null);
  const spawnIntervalRef = useRef(null);
  const gameTimerRef = useRef(null);
  const idleCheckRef = useRef(null);
  const countdownRef = useRef(null);
  const lastActionTimeRef = useRef(Date.now());
  const currentTrialRef = useRef(0);

  const clickAudioRef = useRef(null);

  const config = difficultySettings[difficulty];

  // ===== 點擊音效初始化 =====
  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundFile);
    clickAudioRef.current.volume = 1.0;
  }, []);

  const playClickSound = () => {
    if (!clickAudioRef.current) return;
    clickAudioRef.current.currentTime = 0;
    clickAudioRef.current.play().catch(() => {});
  };

  // ===== 單一物件隨機位置 =====
  const getRandomPosition = () => {
    const spread = 58;
    return {
      x: Math.random() * spread + (100 - spread) / 2,
      y: Math.random() * spread + (100 - spread) / 2,
    };
  };

  // ===== 重置 =====
  const resetGame = () => {
    setItem(null);
    setScore(0);
    setIsEnd(false);
    setEffect(null);
    setIsClickable(true);
    setIsPlaying(false);
    setIsIntroPlaying(false);
    setIsCountdown(false);
    setCountdown(5);

    setTrialRecords([]);
    setRtRecords([]);
    setMissCount(0);
    setWrongClickCount(0);
    setTotalSpawn(0);

    setHintText("準備好幫小飛鼠接橡實了嗎？");
    setShowHint(false);

    currentTrialRef.current = 0;
    lastActionTimeRef.current = Date.now();

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    if (gameTimerRef.current) clearTimeout(gameTimerRef.current);
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // ===== 按開始：先進規則頁 =====
  const handleStart = () => {
    resetGame();
    setShowRulePage(true);
  };

  // ===== 規則頁按「知道了！」後播放影片 =====
  const handleRuleConfirm = () => {
    setShowRulePage(false);
    setIsIntroPlaying(true);
  };

  // ===== 影片結束後倒數 =====
  const startCountdown = () => {
    setIsIntroPlaying(false);
    setIsCountdown(true);
    setCountdown(5);

    let count = 5;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownRef.current);
        setIsCountdown(false);
        startTraining();
      }
    }, 1000);
  };

  // ===== 真正開始訓練 =====
  const startTraining = () => {
    setIsPlaying(true);
    setHintText("看到橡實就趕快點一下！");
    setShowHint(true);

    setTimeout(() => setShowHint(false), 1800);

    gameTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      setIsEnd(true);
    }, TOTAL_TIME);
  };

  // ===== 檢查孩子是否停太久 =====
  useEffect(() => {
    if (!isPlaying) return;

    idleCheckRef.current = setInterval(() => {
      const now = Date.now();
      const idleDuration = now - lastActionTimeRef.current;

      if (idleDuration >= 4000) {
        const randomPrompt =
          idlePrompts[Math.floor(Math.random() * idlePrompts.length)];
        setHintText(randomPrompt);
        setShowHint(true);

        setTimeout(() => {
          setShowHint(false);
        }, 1800);

        lastActionTimeRef.current = Date.now();
      }
    }, 1000);

    return () => {
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, [isPlaying]);

  // ===== 固定節奏生成（每次只出現一顆）=====
  useEffect(() => {
    if (!isPlaying) return;

    const runSpawn = () => {
      setIsClickable(true);

      // 清掉上一輪 timeout
      if (itemTimeoutRef.current) {
        clearTimeout(itemTimeoutRef.current);
      }

      const pos = getRandomPosition();
      const id = Date.now();
      const trialNumber = currentTrialRef.current + 1;
      currentTrialRef.current = trialNumber;

      spawnTimeRef.current = performance.now();

      // ===== 主目標類型 =====
      let mainType = objectTypes.normal;

      // 簡單：只有普通
      // 普通 / 困難：加入金色與壞掉，但金色降低機率
      if (difficulty === "medium" || difficulty === "hard") {
        const rand = Math.random();

        if (rand < 0.75) {
          mainType = objectTypes.normal;
        } else if (rand < 0.85) {
          mainType = objectTypes.golden; // ⭐ 10%
        } else {
          mainType = objectTypes.rotten; // 15%
        }
      }

      setItem({
        x: pos.x,
        y: pos.y,
        id,
        trial: trialNumber,
        type: mainType,
      });

      setTotalSpawn((prev) => prev + 1);

      // 時間到自動消失（沒點就算 miss）
      itemTimeoutRef.current = setTimeout(() => {
        setItem((current) => {
          if (current && current.id === id) {
            setMissCount((prev) => prev + 1);

            setTrialRecords((prev) => [
              ...prev,
              {
                trial: trialNumber,
                hit: false,
                miss: true,
                wrongClick: false,
                reactionTime: null,
                positionX: pos.x,
                positionY: pos.y,
                itemType: mainType.key,
                scoreValue: mainType.score,
              },
            ]);

            return null;
          }
          return current;
        });
      }, config.visibleTime);
    };

    runSpawn();
    spawnIntervalRef.current = setInterval(runSpawn, config.spawnInterval);

    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
      if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    };
  }, [isPlaying, difficulty, config.spawnInterval, config.visibleTime]);

  // ===== 點到主目標 =====
  const handleTargetClick = (x, y, id, trial, type) => {
    if (!item || item.id !== id) return;
    if (!isClickable) return;

    playClickSound();
    lastActionTimeRef.current = Date.now();
    setIsClickable(false);

    const clickTime = performance.now();
    const rt = Math.round(clickTime - spawnTimeRef.current);

    setRtRecords((prev) => [...prev, rt]);
    setScore((prev) => prev + type.score);

    setTrialRecords((prev) => [
      ...prev,
      {
        trial,
        hit: true,
        miss: false,
        wrongClick: false,
        reactionTime: rt,
        positionX: x,
        positionY: y,
        itemType: type.key,
        scoreValue: type.score,
      },
    ]);

    setEffect({
      x,
      y,
      type: type.score > 0 ? "correct" : "penalty",
      score: type.score,
    });

    if (type.key === "golden") {
      setHintText("金色橡實！+5");
    } else if (type.key === "rotten") {
      setHintText("哎呀！是壞掉的橡實！-2");
    } else {
      setHintText("普通橡實！+3");
    }

    setShowHint(true);

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);

    setTimeout(() => {
      setItem(null);
    }, 80);

    setTimeout(() => setEffect(null), 700);
    setTimeout(() => setShowHint(false), 1000);
  };

  // ===== 統計資料 =====
  const avgRT =
    rtRecords.length > 0
      ? Math.round(rtRecords.reduce((a, b) => a + b, 0) / rtRecords.length)
      : 0;

  const stdRT =
    rtRecords.length > 1
      ? Math.round(
          Math.sqrt(
            rtRecords.reduce((sum, rt) => sum + Math.pow(rt - avgRT, 2), 0) /
              rtRecords.length
          )
        )
      : 0;

  const hitRate =
    totalSpawn > 0 ? Math.round((rtRecords.length / totalSpawn) * 100) : 0;

  const firstHalf = rtRecords.slice(0, Math.floor(rtRecords.length / 2));
  const secondHalf = rtRecords.slice(-Math.floor(rtRecords.length / 2));

  const firstHalfAvg =
    firstHalf.length > 0
      ? Math.round(firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length)
      : avgRT;

  const secondHalfAvg =
    secondHalf.length > 0
      ? Math.round(secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length)
      : avgRT;

  const reactionSpeed = Math.max(0, Math.min(100, 100 - (avgRT - 300) / 7));
  const responseAccuracy = hitRate;
  const responseConsistency = Math.max(0, Math.min(100, 100 - stdRT / 4));
  const sustainedAttention = Math.max(
    0,
    Math.min(100, 100 - (secondHalfAvg - firstHalfAvg) / 4)
  );

  const radarData = [
    { subject: "反應速度", value: Math.round(reactionSpeed) },
    { subject: "反應準確度", value: Math.round(responseAccuracy) },
    { subject: "反應穩定度", value: Math.round(responseConsistency) },
    { subject: "持續注意力", value: Math.round(sustainedAttention) },
  ];

  const summaryData = {
    avgRT,
    stdRT,
    hitRate,
    firstHalfAvg,
    secondHalfAvg,
    totalTrials: totalSpawn,
    hitCount: rtRecords.length,
    missCount,
    wrongClickCount,
    difficulty,
    finalScore: score,
  };

  return (
    <div style={styles.container}>
      {/* ===== 開始畫面 ===== */}
      {!isPlaying &&
        !isEnd &&
        !isIntroPlaying &&
        !showRulePage &&
        !isCountdown && (
          <div style={styles.startCard}>
            <h2 style={styles.title}>反應力訓練</h2>
            <p style={styles.subtitle}>幫小飛鼠接住掉下來的橡實！</p>

            <div style={styles.diffBox}>
              <p style={styles.diffTitle}>選擇訓練難度</p>
              <div style={styles.diffBtns}>
                {Object.keys(difficultySettings).map((level) => (
                  <button
                    key={level}
                    style={{
                      ...styles.diffBtn,
                      ...(difficulty === level ? styles.diffBtnActive : {}),
                    }}
                    onClick={() => setDifficulty(level)}
                  >
                    {difficultySettings[level].label}
                  </button>
                ))}
              </div>
            </div>

            <button style={styles.startBtn} onClick={handleStart}>
              開始訓練
            </button>
          </div>
        )}

      {/* ===== 規則頁 ===== */}
      {showRulePage && (
        <div style={styles.overlayCard}>
          <h2 style={styles.title}>遊戲規則</h2>

          <div style={styles.ruleContent}>
            <p>看到橡實就快點一下！</p>

            {difficulty === "easy" && (
              <>
                <p>普通橡實：+3 分</p>
                <p>專心看畫面，把橡實接住！</p>
              </>
            )}

            {(difficulty === "medium" || difficulty === "hard") && (
              <>
                <p>普通橡實：+3 分</p>
                <p>金色橡實：+5 分</p>
                <p>壞掉橡實：-2 分</p>
              </>
            )}

            {difficulty === "hard" && <p>這一關會更快喔！</p>}

            <p>準備好了就按下方按鈕開始！</p>
          </div>

          <button style={styles.startBtn} onClick={handleRuleConfirm}>
            知道了！
          </button>
        </div>
      )}

      {/* ===== Intro影片 ===== */}
      
      {isIntroPlaying && (
        <div style={styles.introPage}>
          <h1 style={styles.pageTitle}>幫小飛鼠弟弟接住掉落的橡實</h1>

          <div style={styles.introCard}>
            <h2 style={styles.introTitle}>準備開始囉！</h2>
            <p style={styles.introText}>請先看看遊戲小故事</p>

            <div style={styles.introVideoFrame}>
              <video
                src={introVideo}
                autoPlay
                controls={false}
                onEnded={startCountdown}
                style={styles.introVideo}
              />
            </div>

            <button style={styles.introSkipBtn} onClick={startCountdown}>
              跳過
            </button>
          </div>
        </div>
      )}

      {/* ===== 倒數頁 ===== */}
      {isCountdown && (
        <div style={styles.countdownWrapper}>
          <h2 style={styles.countdownTitle}>準備開始</h2>
          <div style={styles.countdownNumber}>{countdown}</div>
        </div>
      )}

      {/* ===== 遊戲中 ===== */}
      {isPlaying && (
        <>
          <div style={styles.topBar}>
            <h2 style={styles.score}>目前分數：{score}</h2>
            <p style={styles.modeText}>
              訓練難度：{difficultySettings[difficulty].label}
            </p>
          </div>

          {showHint && <div style={styles.hintBubble}>{hintText}</div>}

          <div style={styles.gameArea}>
            {item && (
              <img
                src={item.type.img}
                alt={item.type.label}
                style={{
                  ...styles.item,
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${config.itemSize}px`,
                }}
                onClick={() =>
                  handleTargetClick(
                    item.x,
                    item.y,
                    item.id,
                    item.trial,
                    item.type
                  )
                }
              />
            )}

            {effect && (
              <div
                style={{
                  ...styles.effect,
                  left: `${effect.x}%`,
                  top: `${effect.y}%`,
                  color:
                    effect.type === "correct"
                      ? "#4caf50"
                      : "#e53935",
                }}
              >
                {effect.score > 0 ? `+${effect.score}` : `${effect.score}`}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 結果頁 ===== */}
      {isEnd && (
        <ResultPage_SRT
          mode="training"
          score={score}
          avgRT={avgRT}
          rtRecords={rtRecords}
          trialRecords={trialRecords}
          totalSpawn={totalSpawn}
          missCount={missCount}
          radarData={radarData}
          summaryData={summaryData}
          onRestart={handleStart}
          onBackToMenu={() => navigate("/game-menu")}
        />
      )}
    </div>
  );
};

export default TrainingPage_SRT;

const styles = {
  container: {
    minHeight: "100vh",
    textAlign: "center",
    paddingTop: "20px",
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)),
      url(${bgImg})
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  },

  startCard: {
    margin: "80px auto",
    width: "90%",
    maxWidth: "580px",
    background: "white",
    borderRadius: "24px",
    padding: "40px 30px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  },

  overlayCard: {
    margin: "100px auto",
    width: "90%",
    maxWidth: "600px",
    background: "white",
    borderRadius: "24px",
    padding: "45px 35px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
  },

  title: {
    fontSize: "38px",
    color: "#5d4037",
    marginBottom: "18px",
  },

  subtitle: {
    fontSize: "22px",
    color: "#6d4c41",
    marginBottom: "24px",
  },

  ruleContent: {
    fontSize: "24px",
    lineHeight: "2",
    color: "#6d4c41",
    marginBottom: "25px",
  },

  diffBox: {
    background: "#fff7ef",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "28px",
  },

  diffTitle: {
    fontSize: "20px",
    color: "#6d4c41",
    marginBottom: "15px",
    fontWeight: "bold",
  },

  diffBtns: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  diffBtn: {
    padding: "12px 20px",
    fontSize: "18px",
    borderRadius: "14px",
    border: "2px solid #ffcc9c",
    background: "white",
    color: "#8d6e63",
    cursor: "pointer",
    fontWeight: "bold",
  },

  diffBtnActive: {
    background: "#ffb26b",
    color: "white",
    border: "2px solid #ff8c42",
  },

  startBtn: {
    padding: "15px 32px",
    fontSize: "22px",
    borderRadius: "16px",
    border: "none",
    backgroundColor: "#ff8c42",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
  },

  topBar: {
    marginTop: "15px",
  },

  score: {
    fontSize: "30px",
    color: "#5d4037",
    marginBottom: "8px",
  },

  modeText: {
    fontSize: "18px",
    color: "#8d6e63",
  },

  hintBubble: {
    margin: "18px auto 0",
    width: "fit-content",
    maxWidth: "80%",
    background: "#fff3cd",
    color: "#7a5c00",
    padding: "14px 22px",
    borderRadius: "18px",
    fontSize: "22px",
    fontWeight: "bold",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  },

  gameArea: {
    position: "relative",
    width: "100%",
    height: "75vh",
  },

  item: {
    position: "absolute",
    cursor: "pointer",
    transform: "translate(-50%, -50%)",
    userSelect: "none",
    zIndex: 2,
  },

  effect: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "34px",
    fontWeight: "bold",
    pointerEvents: "none",
    zIndex: 3,
  },

  videoWrapper: {
    position: "relative",
    width: "100%",
    height: "100vh",
    background: "black",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
  },

  video: {
    width: "90%",
    maxWidth: "900px",
    borderRadius: "20px",
  },

  countdownWrapper: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  countdownTitle: {
    fontSize: "42px",
    color: "#5d4037",
    marginBottom: "20px",
  },

  countdownNumber: {
    fontSize: "120px",
    fontWeight: "bold",
    color: "#ff8c42",
    textShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  introPage: {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingTop: "35px",
},

pageTitle: {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#5d4037",
  marginBottom: "28px",
  textShadow: "0 2px 6px rgba(255,255,255,0.4)",
},

introCard: {
  width: "88%",
  maxWidth: "980px",
  background: "#f7f1e8",
  borderRadius: "28px",
  padding: "38px 40px 28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
},

introTitle: {
  fontSize: "26px",
  fontWeight: "bold",
  color: "#8b5e3c",
  marginBottom: "12px",
},

introText: {
  fontSize: "18px",
  color: "#7b6a58",
  marginBottom: "28px",
  fontWeight: "600",
},

introVideoFrame: {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: "24px",
},

introVideo: {
  width: "72%",
  maxWidth: "630px",
  borderRadius: "24px",
  objectFit: "cover",
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
},

introSkipBtn: {
  padding: "14px 34px",
  fontSize: "18px",
  fontWeight: "bold",
  borderRadius: "999px",
  border: "none",
  backgroundColor: "#9c7563",
  color: "white",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
  transition: "0.2s ease",
},
};