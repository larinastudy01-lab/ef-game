import bgImg from "../asset/SRT_testbackground.jpg";
import React, { useEffect, useState, useRef } from "react";
import normalImg from "../asset/acorn.png";
import ResultPage_SRT from "./ResultPage_SRT";
import introVideo from "../asset/SRT_start.mp4";
import clickSoundFile from "../asset/Click_SRT.mp3";
import { useNavigate } from "react-router-dom";
import { calculateSRTStar } from "../utils/srtScoring";

const TOTAL_TIME = 10000; // 10秒(測試)
const SPAWN_INTERVAL = 1000; // 每1秒出現一次
const ITEM_VISIBLE_TIME = 1000; // 每個橡實停留1秒
const ITEM_SIZE = 80;

const TestPage_SRT = () => {
  const navigate = useNavigate();

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

  // ===== 測驗資料 =====
  const [trialRecords, setTrialRecords] = useState([]);
  const [rtRecords, setRtRecords] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [totalSpawn, setTotalSpawn] = useState(0);

  const spawnTimeRef = useRef(null);
  const itemTimeoutRef = useRef(null);
  const spawnIntervalRef = useRef(null);
  const gameTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const currentTrialRef = useRef(0);

  const clickAudioRef = useRef(null);

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

  // ===== 隨機位置 =====
  const getRandomPosition = () => {
    const spread = 55;
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
    setTotalSpawn(0);

    currentTrialRef.current = 0;

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    if (gameTimerRef.current) clearTimeout(gameTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // ===== 點開始：先進規則頁 =====
  const handleStart = () => {
    resetGame();
    setShowRulePage(true);
  };

  // ===== 規則頁按「知道了！」後播放影片 =====
  const handleRuleConfirm = () => {
    setShowRulePage(false);
    setIsIntroPlaying(true);
  };

  // ===== 影片後倒數 =====
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
        startTest();
      }
    }, 1000);
  };

  // ===== 真正開始測驗 =====
  const startTest = () => {
    setIsPlaying(true);

    gameTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      setIsEnd(true);
    }, TOTAL_TIME);
  };

  // ===== 固定節奏生成（每1秒刷新一次，不會卡住）=====
  useEffect(() => {
    if (!isPlaying) return;

    const runSpawn = () => {
      setIsClickable(true);

      // 清掉上一個 timeout
      if (itemTimeoutRef.current) {
        clearTimeout(itemTimeoutRef.current);
      }

      const pos = getRandomPosition();
      const id = Date.now();
      const trialNumber = currentTrialRef.current + 1;
      currentTrialRef.current = trialNumber;

      spawnTimeRef.current = performance.now();

      // 直接覆蓋上一個 item（不管有沒有點）
      setItem({
        x: pos.x,
        y: pos.y,
        id,
        trial: trialNumber,
      });

      setTotalSpawn((prev) => prev + 1);

      // 1秒後自動消失，沒點就算 miss
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
                reactionTime: null,
                positionX: pos.x,
                positionY: pos.y,
              },
            ]);

            return null;
          }
          return current;
        });
      }, ITEM_VISIBLE_TIME);
    };

    runSpawn();
    spawnIntervalRef.current = setInterval(runSpawn, SPAWN_INTERVAL);

    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
      if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    };
  }, [isPlaying]);

  // ===== 點擊橡實 =====
  const handleClick = (x, y, id, trial) => {
    if (!item || item.id !== id) return;
    if (!isClickable) return;

    playClickSound();
    setIsClickable(false);

    const clickTime = performance.now();
    const rt = Math.round(clickTime - spawnTimeRef.current);

    setRtRecords((prev) => [...prev, rt]);
    setScore((prev) => prev + 1);

    setTrialRecords((prev) => [
      ...prev,
      {
        trial,
        hit: true,
        miss: false,
        reactionTime: rt,
        positionX: x,
        positionY: y,
      },
    ]);

    setEffect({ x, y });

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);

    setTimeout(() => setItem(null), 80);
    setTimeout(() => setEffect(null), 350);
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

  const fastestRT = rtRecords.length > 0 ? Math.min(...rtRecords) : 0;
  const slowestRT = rtRecords.length > 0 ? Math.max(...rtRecords) : 0;

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
  const responseConsistency = Math.max(
    0,
    Math.min(100, 100 - stdRT / 4)
  );
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
    fastestRT,
    slowestRT,
    hitRate,
    firstHalfAvg,
    secondHalfAvg,
    totalTrials: totalSpawn,
    hitCount: rtRecords.length,
    missCount,
  };

  const starResult = calculateSRTStar({
    hitRate,
    avgRT,
    stdRT,
    firstHalfAvg,
    secondHalfAvg,
  });

  return (
    <div style={styles.container}>
      {/* ===== 開始畫面 ===== */}
      {!isPlaying &&
        !isEnd &&
        !isIntroPlaying &&
        !showRulePage &&
        !isCountdown && (
          <div style={styles.startCard}>
            <h2 style={styles.title}>幫小飛鼠弟弟接住掉落的橡實</h2>

            <button style={styles.startBtn} onClick={handleStart}>
              開始測驗
            </button>
          </div>
        )}

      {/* ===== 規則頁 ===== */}
      {showRulePage && (
        <div style={styles.overlayCard}>
          <h2 style={styles.title}>遊戲規則</h2>
          <div style={styles.ruleContent}>
            <p>看到橡實就快點一下！</p>
            <p>不要分心，專心看畫面！</p>
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

      {/* ===== 正式測驗畫面 ===== */}
      {isPlaying && (
        <>
          <div style={styles.topBar}>
            <h2 style={styles.score}>已成功點擊：{score}</h2>
          </div>

          <div style={styles.gameArea}>
            {item && (
              <img
                src={normalImg}
                alt="acorn"
                style={{
                  ...styles.item,
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${ITEM_SIZE}px`,
                }}
                onClick={() =>
                  handleClick(item.x, item.y, item.id, item.trial)
                }
              />
            )}

            {effect && (
              <div
                style={{
                  ...styles.effect,
                  left: `${effect.x}%`,
                  top: `${effect.y}%`,
                }}
              >
                ✓
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 結果頁 ===== */}
      {isEnd && (
        <ResultPage_SRT
          mode="test"
          score={score}
          avgRT={avgRT}
          rtRecords={rtRecords}
          trialRecords={trialRecords}
          totalSpawn={totalSpawn}
          missCount={missCount}
          radarData={radarData}
          summaryData={summaryData}
          starResult={starResult}
          onRestart={handleStart}
          onBackToMenu={() => navigate("/game-menu")}
        />
      )}
    </div>
  );
};

export default TestPage_SRT;

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
    margin: "120px auto",
    width: "90%",
    maxWidth: "500px",
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
    marginBottom: "20px",
  },

  subtitle: {
    fontSize: "22px",
    color: "#6d4c41",
    marginBottom: "12px",
  },

  notice: {
    fontSize: "18px",
    color: "#8d6e63",
    marginBottom: "30px",
  },

  ruleContent: {
    fontSize: "24px",
    lineHeight: "2",
    color: "#6d4c41",
    marginBottom: "25px",
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
    marginTop: "20px",
  },

  score: {
    fontSize: "28px",
    color: "#5d4037",
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
  },

  effect: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "28px",
    fontWeight: "bold",
    color: "#4caf50",
    pointerEvents: "none",
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
};