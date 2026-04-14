import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import stone from "../asset/stone.png";
import person from "../asset/CBT_person.png";
import clickSfx from "../asset/Click_SRT.mp3";
import bgImage from "../asset/SRT_background.jpg";
import introVideo from "../asset/SRT_start.mp4";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const generateSequence = (count, max) => {
  const seq = [];
  for (let i = 0; i < count; i++) {
    let n = Math.floor(Math.random() * max);
    if (i > 0) {
      while (n === seq[i - 1]) {
        n = Math.floor(Math.random() * max);
      }
    }
    seq.push(n);
  }
  return seq;
};

export default function TestPage_CBT() {
  const navigate = useNavigate();

  // ===== phase =====
  const [phase, setPhase] = useState("rules");
  // rules → video → ready → memorize → answer → end

  const [countdown, setCountdown] = useState(5);

  // ===== core =====
  const BLOCK_COUNT = 6;
  const [sequenceLength, setSequenceLength] = useState(2);
  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);

  const [flashIndex, setFlashIndex] = useState(null);
  const [waitingInput, setWaitingInput] = useState(false);

  // ===== timer =====
  const [answerTime, setAnswerTime] = useState(10);

  // ===== walking =====
  const [walkIndex, setWalkIndex] = useState(-1);
  const [showWalk, setShowWalk] = useState(false);

  // ===== log =====
  const [logs, setLogs] = useState([]);
  const startTimeRef = useRef(0);

  // ===== audio =====
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);
  const playClick = () => {
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  // ===== positions =====
  const positions = useMemo(
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

  // ===== ready countdown =====
  useEffect(() => {
    if (phase !== "ready") return;

    if (countdown <= 0) {
      startMemorize();
      return;
    }

    const t = setTimeout(() => setCountdown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ===== memorize =====
  const startMemorize = async () => {
    const seq = generateSequence(sequenceLength, BLOCK_COUNT);

    setSequence(seq);
    setUserInput([]);
    setWaitingInput(false);
    setPhase("memorize");

    await sleep(600);

    for (let i = 0; i < seq.length; i++) {
      setFlashIndex(seq[i]);
      await sleep(700);
      setFlashIndex(null);
      await sleep(300);
    }

    // ⭐ 進入答題
    setPhase("answer");
    setWaitingInput(true);
    setAnswerTime(10);
    startTimeRef.current = Date.now();
  };

  // ===== answer timer =====
  useEffect(() => {
    if (phase !== "answer") return;

    if (answerTime <= 0) {
      endGame(false, true);
      return;
    }

    const t = setTimeout(() => setAnswerTime((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, answerTime]);

  // ===== click =====
  const handleClick = (i) => {
    if (!waitingInput) return;

    playClick();

    const newInput = [...userInput, i];
    setUserInput(newInput);

    const step = newInput.length - 1;

    if (sequence[step] !== i) {
      endGame(false, false);
      return;
    }

    if (newInput.length === sequence.length) {
      finishCorrect(newInput);
    }
  };

  // ===== correct =====
  const finishCorrect = (path) => {
    setWaitingInput(false);
    playWalk(path);
  };

  // ===== walking（修正版）=====
  const playWalk = async (path) => {
    setShowWalk(true);

    for (let i = 0; i < path.length; i++) {
      setWalkIndex(path[i]);
      await sleep(500);
    }

    await sleep(400);

    setShowWalk(false);
    setWalkIndex(-1);

    nextTrial();
  };

  // ===== next =====
  const nextTrial = () => {
    const rt = Date.now() - startTimeRef.current;

    const newLogs = [
      ...logs,
      { length: sequenceLength, correct: true, rt },
    ];
    setLogs(newLogs);

    setSequenceLength((p) => p + 1);

    setTimeout(startMemorize, 600);
  };

  // ===== end =====
  const endGame = (correct, timeout) => {
    const rt = Date.now() - startTimeRef.current;

    const finalLogs = [
      ...logs,
      { length: sequenceLength, correct, rt, timeout },
    ];

    const maxSpan = Math.max(...finalLogs.map((l) => l.length));
    const accuracy =
      finalLogs.filter((l) => l.correct).length / finalLogs.length;

    const result = {
      maxSpan,
      accuracy,
      avgRT:
        finalLogs.reduce((s, l) => s + l.rt, 0) / finalLogs.length,
      logs: finalLogs,
    };

    localStorage.setItem("cbt_result", JSON.stringify(result));

    setPhase("end");

    setTimeout(() => navigate("/result-cbt"), 1200);
  };

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>CBT 記憶測驗</h1>

          {/* rules */}
          {phase === "rules" && (
            <div style={styles.smallCard}>
              <p style={styles.text}>
                石頭會依序發光<br />
                記住順序再點回去
              </p>
              <button style={styles.mainButton} onClick={() => setPhase("video")}>
                開始
              </button>
            </div>
          )}

          {/* video */}
          {phase === "video" && (
            <div style={styles.mediumCard}>
              <video
                src={introVideo}
                autoPlay
                onEnded={() => {
                  setCountdown(5);
                  setPhase("ready");
                }}
                style={styles.video}
              />
              <button onClick={() => setPhase("ready")}>跳過</button>
            </div>
          )}

          {/* ready */}
          {phase === "ready" && (
            <div style={styles.smallCard}>
              <h1 style={styles.bigCountdown}>{countdown}</h1>
            </div>
          )}

          {/* game */}
          {(phase === "memorize" || phase === "answer") && (
            <div style={styles.card}>
              <h2 style={styles.subtitle}>
                {phase === "memorize"
                  ? "記住順序 👀"
                  : "換你點石頭！"}
              </h2>

              {phase === "answer" && (
                <p style={styles.timer}>剩下 {answerTime} 秒</p>
              )}

              <div style={styles.board}>
                {positions.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleClick(i)}
                    disabled={phase === "memorize"}
                    style={{
                      ...styles.block,
                      top: p.top,
                      left: p.left,
                      ...(flashIndex === i ? styles.active : {}),
                    }}
                  >
                    <img src={stone} style={styles.img} />

                    {showWalk && walkIndex === i && (
                      <img src={person} style={styles.person} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "end" && <h1>完成！</h1>}
        </div>
      </div>
    </div>
  );
}

// ===== style（PM統一風格）=====
const styles = {
  page: (bg) => ({
    minHeight: "100vh",
    backgroundImage: `url(${bg})`,
    backgroundSize: "cover",
  }),
  overlay: {
    background: "rgba(255,255,255,0.2)",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  container: { width: "100%", maxWidth: 1100, textAlign: "center" },
  card: { background: "rgba(255,248,235,0.96)", padding: 30, borderRadius: 30 },
  smallCard: { background: "rgba(255,248,235,0.96)", padding: 40, borderRadius: 30 },
  mediumCard: { background: "rgba(255,248,235,0.96)", padding: 30, borderRadius: 30 },
  title: { fontSize: 42, fontWeight: 800 },
  subtitle: { fontSize: 32, fontWeight: 800 },
  text: { fontSize: 24 },
  timer: { fontSize: 26, fontWeight: 800, color: "#D97706" },
  bigCountdown: { fontSize: 100 },
  mainButton: { background: "#F4A261", padding: "16px 36px", borderRadius: 999, color: "#fff", fontSize: 22 },
  video: { width: 600 },
  board: { position: "relative", height: "60vh" },
  block: {
    position: "absolute",
    width: 130,
    height: 130,
    border: "none",
    background: "transparent",
  },
  img: { width: "100%", height: "100%" },
  person: { position: "absolute", top: "-30px", width: 60 },
  active: { transform: "scale(1.15)", boxShadow: "0 0 40px gold" },
};