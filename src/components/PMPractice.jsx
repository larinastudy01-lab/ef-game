import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PMScatterBoard from "./PMScatterBoard";
import PMNarrator from "./PMNarrator";
import { buildPMQuestion } from "../utils/pmItems";
import { PM_TEST_SHOW_TIME } from "../utils/pmProtocol";
import { createPMPracticeAudioPlayer } from "../utils/pmPracticeAudio";
import sendImage from "../asset/home/send.webp";
import startImage from "../asset/home/start.webp";
import mouseImage from "../asset/mouse.webp";
import "../styles/PMPractice.css";

export default function PMPractice({ onComplete }) {
  const [question, setQuestion] = useState(() => buildPMQuestion(2, { mode: "practice" }));
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState("memorize");
  const [selectedIds, setSelectedIds] = useState([]);
  const [streak, setStreak] = useState(0);
  const [completionReady, setCompletionReady] = useState(false);
  const [narration, setNarration] = useState(null);
  const phaseRef = useRef("memorize");
  const selectedRef = useRef([]);
  const submittedRef = useRef(false);
  const outcomeRef = useRef(null);
  const answerStartRef = useRef(null);
  const timersRef = useRef(new Set());
  const idleTimerRef = useRef(null);
  const cancelTaughtRef = useRef(false);
  const cancelScheduledRef = useRef(false);
  const enteredRef = useRef(false);
  const audio = useMemo(() => createPMPracticeAudioPlayer(setNarration), []);
  const transition = useCallback((next) => { phaseRef.current = next; setPhase(next); }, []);
  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(() => { timersRef.current.delete(timer); callback(); }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const finishInstruction = () => {
    if (phaseRef.current === "answerIntro") transition("answer");
  };
  const continueAfterFeedback = () => {
    if (phaseRef.current !== "feedback") return;
    if (outcomeRef.current.streak >= 2) transition("complete");
    else {
      setQuestion(buildPMQuestion(2, { mode: "practice" }));
      setRound((value) => value + 1);
      selectedRef.current = [];
      setSelectedIds([]);
      transition("memorize");
    }
  };
  // Callbacks are read at playback end so replay never captures an old scene.
  const instructionEndRef = useRef(finishInstruction);
  instructionEndRef.current = finishInstruction;
  const feedbackEndRef = useRef(continueAfterFeedback);
  feedbackEndRef.current = continueAfterFeedback;
  const feedbackStartedRef = useRef(0);
  const finishFeedback = useCallback(() => {
    schedule(() => feedbackEndRef.current(), Math.max(0, 1100 - (performance.now() - feedbackStartedRef.current)));
  }, [schedule]);

  useEffect(() => {
    if (phase === "memorize") {
      submittedRef.current = false;
      cancelScheduledRef.current = false;
      answerStartRef.current = null;
      // StrictMode rehearses mount effects. Defer one task so its rehearsal is
      // cancelled before starting a recording, while ordinary renders stay silent.
      schedule(() => { if (!audio.playing) audio.play("memorize"); }, 0);
      schedule(() => transition("answerIntro"), PM_TEST_SHOW_TIME * 1000);
    } else if (phase === "answerIntro") {
      audio.play("answer", () => instructionEndRef.current());
    } else if (phase === "answer") {
      // No practice deadline. Narration is excluded.
      answerStartRef.current = performance.now();
      idleTimerRef.current = schedule(() => {
        if (!selectedRef.current.length && !audio.playing) audio.play("reminder");
      }, 5000);
    } else if (phase === "feedback") {
      feedbackStartedRef.current = performance.now();
      audio.play(outcomeRef.current.correct ? "correct" : "retry", finishFeedback);
    } else if (phase === "complete") {
      audio.play("complete", () => setCompletionReady(true));
    }
    return () => { clearTimers(); audio.stop(); };
  }, [phase, round, audio, schedule, clearTimers, transition, finishFeedback]);

  const toggle = (id) => {
    if (phaseRef.current !== "answer" || submittedRef.current) return;
    clearTimeout(idleTimerRef.current);
    timersRef.current.delete(idleTimerRef.current);
    const previous = selectedRef.current;
    selectedRef.current = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
    setSelectedIds(selectedRef.current);
    if (!cancelTaughtRef.current && !cancelScheduledRef.current) {
      cancelScheduledRef.current = true;
      // Teach cancellation after any first choice, regardless of correctness.
      const teach = () => {
        if (phaseRef.current !== "answer") return;
        if (audio.playing) schedule(teach, 700);
        else {
          cancelTaughtRef.current = true;
          audio.play("cancel");
        }
      };
      schedule(teach, 1200);
    }
  };
  const submit = () => {
    if (phaseRef.current !== "answer" || submittedRef.current || !selectedRef.current.length) return;
    submittedRef.current = true;
    const correct = selectedRef.current.length === question.targetIds.length && question.targetIds.every((id) => selectedRef.current.includes(id));
    const nextStreak = correct ? streak + 1 : 0;
    outcomeRef.current = { correct, streak: nextStreak, reactionTime: Math.max(0, performance.now() - answerStartRef.current) };
    setStreak(nextStreak);
    transition("feedback");
  };
  const memorizing = phase === "memorize";
  const completed = phase === "complete";
  const feedback = phase === "feedback";
  const canAnswer = phase === "answer";
  const narrator = (narration || completed) && <PMNarrator event={narration?.event || "complete"} speaking={narration?.speaking === true} />;
  return (
    <section className="pm-practice" data-testid="pm-practice" data-phase={phase} data-round={round + 1}
      data-streak={streak} data-can-answer={canAnswer}
      data-feedback={feedback ? outcomeRef.current.correct ? "correct" : "retry" : undefined} aria-label="圖片記憶試玩">
      <div className="pm-practice-scene" data-testid="pm-practice-scene" data-narrator-layout={completed ? "center" : "beside"}>
        {completed ? <div className="pm-practice-complete" role="status">
          {narrator}
        </div> : <>
          <PMScatterBoard items={memorizing ? question.targets : question.options} seed={`${round}-${memorizing ? "memory" : "answer"}`}
            selectable={!memorizing} locked={!canAnswer} selectedIds={selectedIds} onSelect={toggle} />
          <aside className="pm-practice-narrator-slot" aria-label="旁白角色區">
            {narrator}
          </aside>
        </>}
      </div>
      <footer className="pm-practice-footer">
        {completed ? completionReady && <button type="button" className="pm-practice-image-button pm-practice-start-button" aria-label="進入正式評測" onClick={() => {
          if (enteredRef.current) return;
          enteredRef.current = true;
          audio.stop();
          onComplete();
        }}>
          <img src={startImage} width="271" height="166" alt="進入正式評測" />
          <img className="pm-practice-start-guide" src={mouseImage} width="1024" height="1024" alt="" aria-hidden="true" draggable="false" />
        </button>
          : !memorizing && <button type="button" className="pm-practice-image-button" aria-label="送出答案"
            disabled={!canAnswer || !selectedIds.length} onClick={submit}>
            <img src={sendImage} width="322" height="236" alt="送出答案" />
          </button>}
      </footer>
    </section>
  );
}
