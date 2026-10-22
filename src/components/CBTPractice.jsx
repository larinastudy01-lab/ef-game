import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import startImage from "../asset/home/start.webp";
import mouseImage from "../asset/mouse.webp";
import stepStoneImage from "../asset/CBT/training/step.webp";
import { createCBTPracticeAudioPlayer } from "../utils/cbtPracticeAudio";
import CBTNarrator from "./CBTNarrator";
import "../styles/CBTPractice.css";

// Enumerating the 72 ordered pairs also guarantees a different next question
// with deterministic random sources, without an unbounded retry loop.
function createPracticeSequence(previous = []) {
  const pairs = [];
  for (let first = 0; first < 9; first += 1) {
    for (let second = 0; second < 9; second += 1) {
      if (first !== second && !(previous[0] === first && previous[1] === second)) {
        pairs.push([first, second]);
      }
    }
  }
  return pairs[Math.floor(Math.random() * pairs.length)];
}

export default function CBTPractice({ Board, blocks, onComplete }) {
  const [phase, setPhase] = useState("INTRO");
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState(createPracticeSequence);
  const [activeIndex, setActiveIndex] = useState(null);
  const [tapFeedback, setTapFeedback] = useState(null);
  const [steppedIndices, setSteppedIndices] = useState([]);
  const [streak, setStreak] = useState(0);
  const [voiceState, setVoiceState] = useState("idle");
  const [completionReady, setCompletionReady] = useState(false);
  const [boardScale, setBoardScale] = useState(1);
  const boardFrameRef = useRef(null);
  const phaseRef = useRef("INTRO");
  const sequenceRef = useRef(sequence);
  const streakRef = useRef(0);
  const inputRef = useRef([]);
  const outcomeRef = useRef(null);
  const deadlineRef = useRef(null);
  const nextTapAtRef = useRef(0);
  const submittedRef = useRef(false);
  const enteredRef = useRef(false);
  const replayRef = useRef(null);
  const timersRef = useRef(new Set());
  const audio = useMemo(createCBTPracticeAudioPlayer, []);
  const transition = useCallback((next) => { phaseRef.current = next; setPhase(next); }, []);
  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(() => { timersRef.current.delete(timer); callback(); }, delay);
    timersRef.current.add(timer);
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    // Warm the image cache during the first instruction, before the first tap.
    const image = new Image();
    image.src = stepStoneImage;
  }, []);

  useEffect(() => {
    const frame = boardFrameRef.current;
    const resize = () => setBoardScale(Math.min(1, (frame.clientWidth || 760) / 760));
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(frame);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const finishResponse = useCallback((timeout = false) => {
    if (phaseRef.current !== "WAIT_RESPONSE" || submittedRef.current) return;
    submittedRef.current = true;
    const input = inputRef.current;
    const correct = !timeout && input.length === 2
      && input.every((tap, index) => tap.index === sequenceRef.current[index]);
    streakRef.current = correct ? streakRef.current + 1 : 0;
    outcomeRef.current = { correct, timeout };
    setStreak(streakRef.current);
    // The answer is locked now; the last landing must stay visible even when
    // it passes practice and the next scene removes the board.
    transition(timeout ? "FEEDBACK" : "LANDING");
  }, [transition]);

  useEffect(() => {
    setVoiceState("idle");
    replayRef.current = null;
    const narrate = (cue, onEnded) => {
      const play = () => {
        setVoiceState("loading");
        if (phase === "PASSED") setCompletionReady(false);
        audio.play(cue, {
          onPlaying: () => setVoiceState("speaking"),
          onWaiting: () => setVoiceState("loading"),
          onBlocked: setVoiceState,
          onEnded: () => { setVoiceState("idle"); onEnded(); },
        });
      };
      replayRef.current = play;
      play();
    };
    if (phase === "INTRO") {
      inputRef.current = [];
      deadlineRef.current = null;
      setTapFeedback(null);
      setSteppedIndices([]);
      narrate("intro", () => transition("SHOW_SEQUENCE"));
    } else if (phase === "SHOW_SEQUENCE") {
      setActiveIndex(sequenceRef.current[0]);
      schedule(() => setActiveIndex(null), 1000);
      schedule(() => setActiveIndex(sequenceRef.current[1]), 1500);
      schedule(() => { setActiveIndex(null); transition("YOUR_TURN"); }, 2500);
    } else if (phase === "YOUR_TURN") {
      narrate("answer", () => transition("WAIT_RESPONSE"));
    } else if (phase === "WAIT_RESPONSE") {
      submittedRef.current = false;
      nextTapAtRef.current = 0;
      deadlineRef.current = Date.now() + 15000;
      schedule(() => finishResponse(true), 15000);
    } else if (phase === "LANDING") {
      schedule(() => transition(streakRef.current === 2 ? "PASSED" : "FEEDBACK"), 300);
    } else if (phase === "FEEDBACK") {
      narrate(outcomeRef.current.correct ? "correct" : "retry", () => {
        const next = createPracticeSequence(sequenceRef.current);
        sequenceRef.current = next;
        setSequence(next);
        setRound((value) => value + 1);
        transition("INTRO");
      });
    } else if (phase === "PASSED") {
      narrate("passed", () => setCompletionReady(true));
    }
    return () => { replayRef.current = null; clearTimers(); audio.stop(); };
  }, [phase, round, audio, schedule, clearTimers, transition, finishResponse]);

  const handleTap = (index) => {
    if (phaseRef.current !== "WAIT_RESPONSE" || submittedRef.current) return;
    const now = Date.now();
    if (now >= deadlineRef.current) { finishResponse(true); return; }
    if (now < nextTapAtRef.current) return;
    nextTapAtRef.current = now + 300;
    inputRef.current.push({ index, timestamp: now });
    setSteppedIndices((previous) => previous.includes(index) ? previous : [...previous, index]);
    setTapFeedback({ index, id: inputRef.current.length });
    if (inputRef.current.length === 2) finishResponse();
  };
  const blocked = voiceState === "blocked" || voiceState === "error";
  const happy = phase === "PASSED" || (phase === "FEEDBACK" && outcomeRef.current?.correct);
  const completed = phase === "PASSED";
  const hasNarration = ["INTRO", "YOUR_TURN", "FEEDBACK", "PASSED"].includes(phase);
  const practiceHintIndex = phase === "WAIT_RESPONSE" ? sequenceRef.current[inputRef.current.length] : null;
  const narrator = hasNarration && <CBTNarrator key={`${phase}-${round}`} speaking={voiceState === "speaking"} happy={happy} />;

  return (
    <section className="cbt-practice" data-testid="cbt-practice" data-phase={phase}
      data-streak={streak} data-round={round + 1} aria-label="跳石橋試玩">
      <div className="cbt-practice-scene" data-testid="cbt-practice-scene" data-narrator-layout={completed ? "center" : "beside"}>
        <div className="cbt-practice-board-frame" ref={boardFrameRef} hidden={completed}
          style={{ height: 455 * boardScale, "--cbt-practice-board-scale": boardScale }}>
          {!completed && <Board blocks={blocks} phase={phase} activeIndex={activeIndex} selectedIndex={null}
            wrongIndex={null} personIndex={null} isWalking={false} tapFeedback={tapFeedback} practiceHintIndex={practiceHintIndex}
            steppedIndices={steppedIndices}
            onBlockClick={handleTap} disabled={phase !== "WAIT_RESPONSE"} />}
        </div>
        <aside className="cbt-practice-narrator-slot" aria-label="旁白角色區">
          {blocked ? <button type="button" className="cbt-practice-narrator-retry"
            aria-label="點擊播放語音提示" title="點一下小雞播放提示"
            onClick={() => { if (phaseRef.current === phase) replayRef.current?.(); }}>{narrator}</button> : narrator}
        </aside>
      </div>
      {completed && <footer className="cbt-practice-footer">
        <button type="button" className="cbt-forest-button cbt-btn-start cbt-practice-start"
          aria-label="開始正式評測" disabled={!completionReady} onClick={() => {
            if (!completionReady || enteredRef.current) return;
            enteredRef.current = true;
            audio.stop();
            clearTimers();
            onComplete();
          }}><img src={startImage} width="1600" height="533" alt="" draggable="false" />
            {completionReady && <img className="cbt-practice-start-pointer" src={mouseImage}
              width="1024" height="1024" alt="" aria-hidden="true" draggable="false" />}
          </button>
      </footer>}
    </section>
  );
}
