import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// ====== 小工具 ======
const generateSequence = (count, blockCount) => {
  const seq = [];
  for (let i = 0; i < count; i++) {
    let next = Math.floor(Math.random() * blockCount);
    if (i > 0) {
      while (next === seq[i - 1]) {
        next = Math.floor(Math.random() * blockCount);
      }
    }
    seq.push(next);
  }
  return seq;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TestPage_CBT() {
  const navigate = useNavigate();

  // ====== 流程 ======
  const [stage, setStage] = useState("rules");
  // rules -> countdown -> game -> end

  const [countdown, setCountdown] = useState(5);

  // ====== 測驗設定（固定）======
  const TOTAL_TRIALS = 8;
  const BLOCK_COUNT = 6;

  const [trialIndex, setTrialIndex] = useState(0);
  const [sequenceLength, setSequenceLength] = useState(2);

  const [sequence, setSequence] = useState([]);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [currentFlashIndex, setCurrentFlashIndex] = useState(null);

  const [userInput, setUserInput] = useState([]);
  const [trialStartTime, setTrialStartTime] = useState(null);
  const [waitingForInput, setWaitingForInput] = useState(false);

  // ====== trial-based 紀錄 ======
  const [trialLogs, setTrialLogs] = useState([]);
  const [mistakeCount, setMistakeCount] = useState(0);

  // ====== 區塊位置 ======
  const blockPositions = useMemo(
    () => [
      { top: "15%", left: "18%" },
      { top: "18%", left: "62%" },
      { top: "42%", left: "10%" },
      { top: "40%", left: "72%" },
      { top: "68%", left: "24%" },
      { top: "70%", left: "58%" },
    ],
    []
  );

  // ====== 倒數 ======
  useEffect(() => {
    if (stage !== "countdown") return;

    if (countdown <= 0) {
      setStage("game");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [stage, countdown]);

  // ====== 開始每一 trial ======
  useEffect(() => {
    if (stage === "game") {
      startTrial();
    }
    // eslint-disable-next-line
  }, [stage, trialIndex]);

  const startTrial = async () => {
    const newSeq = generateSequence(sequenceLength, BLOCK_COUNT);

    setSequence(newSeq);
    setUserInput([]);
    setWaitingForInput(false);
    setIsShowingSequence(true);
    setCurrentFlashIndex(null);

    await sleep(700);

    for (let i = 0; i < newSeq.length; i++) {
      setCurrentFlashIndex(newSeq[i]);
      await sleep(700); // 亮起時間
      setCurrentFlashIndex(null);
      await sleep(350); // 間隔
    }

    setIsShowingSequence(false);
    setWaitingForInput(true);
    setTrialStartTime(Date.now());
  };

  // ====== 點擊方塊 ======
  const handleBlockClick = (index) => {
    if (!waitingForInput || isShowingSequence) return;

    const newInput = [...userInput, index];
    setUserInput(newInput);

    const currentStep = newInput.length - 1;
    const isCorrectSoFar = sequence[currentStep] === index;

    if (!isCorrectSoFar) {
      finishTrial(false, newInput);
      return;
    }

    if (newInput.length === sequence.length) {
      finishTrial(true, newInput);
    }
  };

  // ====== 結束單一 trial ======
  const finishTrial = (isCorrect, finalInput) => {
    setWaitingForInput(false);

    const reactionTime = trialStartTime ? Date.now() - trialStartTime : 0;

    const log = {
      trial: trialIndex + 1,
      sequenceLength,
      shownSequence: sequence,
      userSequence: finalInput,
      correct: isCorrect,
      reactionTime,
      errorCount: isCorrect ? 0 : 1,
      timestamp: new Date().toISOString(),
    };

    const updatedLogs = [...trialLogs, log];
    setTrialLogs(updatedLogs);

    let nextLength = sequenceLength;
    let nextMistakes = mistakeCount;

    if (isCorrect) {
      nextLength = Math.min(sequenceLength + 1, 7);
    } else {
      nextMistakes += 1;
      nextLength = Math.max(2, sequenceLength - 1);
      setMistakeCount(nextMistakes);
    }

    setTimeout(() => {
      if (trialIndex + 1 >= TOTAL_TRIALS) {
        endTest(updatedLogs);
      } else {
        setSequenceLength(nextLength);
        setTrialIndex((prev) => prev + 1);
      }
    }, 900);
  };

  // ====== 測驗結束 ======
  const endTest = (finalLogs) => {
    setStage("end");

    const totalCorrect = finalLogs.filter((t) => t.correct).length;
    const avgReactionTime =
      finalLogs.length > 0
        ? Math.round(
            finalLogs.reduce((sum, t) => sum + t.reactionTime, 0) / finalLogs.length
          )
        : 0;

    const maxSpan = Math.max(...finalLogs.map((t) => t.sequenceLength), 2);

    const resultPayload = {
      gameType: "CBT",
      totalTrials: TOTAL_TRIALS,
      totalCorrect,
      accuracy: Math.round((totalCorrect / TOTAL_TRIALS) * 100),
      avgReactionTime,
      maxSpan,
      mistakeCount,
      trialLogs: finalLogs,
      completedAt: new Date().toISOString(),
    };

    localStorage.setItem("cbt_test_result", JSON.stringify(resultPayload));

    setTimeout(() => {
      navigate("/result-cbt");
    }, 1200);
  };

  return (
    <div style={styles.page}>
      {/* ===== 規則頁 ===== */}
      {stage === "rules" && (
        <div style={styles.centerWrap}>
          <div style={styles.card}>
            <h1 style={styles.title}>工作記憶測驗</h1>
            <h2 style={styles.subTitle}>Corsi Block Tapping</h2>

            <p style={styles.ruleText}>
              方塊會<strong>一個一個亮起來</strong>，
              你要<strong>記住亮燈的順序</strong>。
            </p>

            <p style={styles.ruleText}>
              等它們亮完之後，
              請你<strong>照剛剛的順序點回去</strong>！
            </p>

            <p style={styles.ruleHint}>看清楚、記住，再慢慢點就可以了 🌟</p>

            <button
              style={styles.mainButton}
              onClick={() => setStage("countdown")}
            >
              知道了！
            </button>
          </div>
        </div>
      )}

      {/* ===== 倒數 ===== */}
      {stage === "countdown" && (
        <div style={styles.centerWrap}>
          <div style={styles.card}>
            <h1 style={styles.title}>準備開始！</h1>
            <div style={styles.countdown}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ===== 遊戲頁 ===== */}
      {stage === "game" && (
        <div style={styles.gameWrap}>
          <div style={styles.topBar}>
            <div style={styles.badge}>第 {trialIndex + 1} / {TOTAL_TRIALS} 回</div>
            <div style={styles.badge}>記憶長度：{sequenceLength}</div>
          </div>

          <div style={styles.board}>
            {blockPositions.map((pos, index) => {
              const isActive = currentFlashIndex === index;
              const isPressed = userInput.includes(index) && waitingForInput;

              return (
                <button
                  key={index}
                  onClick={() => handleBlockClick(index)}
                  style={{
                    ...styles.block,
                    top: pos.top,
                    left: pos.left,
                    ...(isActive ? styles.blockActive : {}),
                    ...(isPressed ? styles.blockPressed : {}),
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div style={styles.bottomHint}>
            {isShowingSequence
              ? "請先看清楚亮燈順序 👀"
              : waitingForInput
              ? "現在換你點回去！"
              : "準備下一回合中..."}
          </div>
        </div>
      )}

      {/* ===== 結束中 ===== */}
      {stage === "end" && (
        <div style={styles.centerWrap}>
          <div style={styles.card}>
            <h1 style={styles.title}>測驗完成！</h1>
            <p style={styles.ruleText}>正在整理你的結果...</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(180deg, #DFF4E4 0%, #BFE3C7 100%)",
    overflow: "hidden",
    fontFamily: "'Arial Rounded MT Bold', 'Microsoft JhengHei', sans-serif",
  },

  centerWrap: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  card: {
    width: "min(90vw, 720px)",
    background: "rgba(255,255,255,0.95)",
    borderRadius: "28px",
    padding: "40px 36px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  title: {
    fontSize: "2.2rem",
    color: "#4E5E4E",
    marginBottom: "10px",
  },

  subTitle: {
    fontSize: "1.4rem",
    color: "#6B7C6B",
    marginBottom: "24px",
  },

  ruleText: {
    fontSize: "1.2rem",
    color: "#4B4B4B",
    lineHeight: 1.9,
    marginBottom: "12px",
  },

  ruleHint: {
    fontSize: "1.1rem",
    color: "#6B6B6B",
    marginTop: "20px",
    marginBottom: "26px",
  },

  mainButton: {
    marginTop: "10px",
    background: "#7BC47F",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "14px 34px",
    fontSize: "1.2rem",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(123,196,127,0.35)",
  },

  countdown: {
    fontSize: "5rem",
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: "16px",
  },

  gameWrap: {
    width: "100%",
    height: "100%",
    padding: "24px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  topBar: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    maxWidth: "1100px",
    marginBottom: "16px",
  },

  badge: {
    background: "rgba(255,255,255,0.95)",
    padding: "12px 20px",
    borderRadius: "999px",
    fontSize: "1.05rem",
    color: "#4E5E4E",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },

  board: {
    position: "relative",
    width: "min(90vw, 1100px)",
    height: "72vh",
    background: "rgba(255,255,255,0.28)",
    borderRadius: "28px",
    backdropFilter: "blur(3px)",
    border: "2px solid rgba(255,255,255,0.35)",
  },

  block: {
    position: "absolute",
    width: "110px",
    height: "110px",
    borderRadius: "24px",
    border: "none",
    background: "linear-gradient(180deg, #8D6E63, #6D4C41)",
    color: "#fff",
    fontSize: "1.8rem",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
    transition: "all 0.2s ease",
  },

  blockActive: {
    transform: "scale(1.12)",
    background: "linear-gradient(180deg, #FFD54F, #FFB300)",
    boxShadow: "0 0 25px rgba(255, 213, 79, 0.9)",
  },

  blockPressed: {
    background: "linear-gradient(180deg, #A5D6A7, #66BB6A)",
  },

  bottomHint: {
    marginTop: "18px",
    background: "rgba(255,255,255,0.95)",
    padding: "14px 28px",
    borderRadius: "999px",
    fontSize: "1.1rem",
    color: "#4E5E4E",
  },
};