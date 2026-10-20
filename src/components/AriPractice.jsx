import React, { useCallback, useEffect, useRef, useState } from "react";
import mouse from "../asset/mouse.webp";
import voice from "../asset/voice.webp";
import cat from "../asset/ARI/cat.webp";
import dog from "../asset/ARI/dog.webp";
import { ARI_PRACTICE_AUDIO, playAriPracticeAudio, waitForAriPractice } from "../utils/ariPracticeAudio";
import "../styles/ARIPractice.css";

export const MAX_PRACTICE_ROUNDS = 3;
const FEEDBACK_MS = 1000;
const opposite = (sound) => sound === "cat" ? "dog" : "cat";
const randomSound = () => Math.random() < 0.5 ? "cat" : "dog";

// This is the practice stage of TestPage_ARI. All answers stay in memory;
// only its parent can start the existing formal assessment recorder.
export default function AriPractice({ onComplete, onReviewStep }) {
  const [state, setState] = useState("initializing");
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [audioIssue, setAudioIssue] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [completionReady, setCompletionReady] = useState(false);
  const session = useRef(null);
  const stateRef = useRef("initializing");
  const busy = useRef(true);
  const retry = useRef(null);
  const soundRef = useRef(null);
  const streakRef = useRef(0);
  const failedRounds = useRef(0);
  const records = useRef([]);

  const transition = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const runCues = useCallback(async function playSequence(cues, done, signal) {
    busy.current = true;
    setAudioIssue(false);
    retry.current = null;
    for (let index = 0; index < cues.length; index += 1) {
      if (signal.aborted) return;
      const [nextState, source] = cues[index];
      transition(nextState);
      try {
        await playAriPracticeAudio(source, signal);
      } catch {
        if (signal.aborted) return;
        busy.current = false;
        setReplaying(false);
        retry.current = () => playSequence(cues.slice(index), done, signal);
        setAudioIssue(true);
        return;
      }
    }
    if (!signal.aborted) done();
  }, [transition]);

  const askQuestion = useCallback((sound, signal) => {
    soundRef.current = sound;
    setFeedback(null);
    setReplaying(false);
    runCues([
      ["question_prompt", ARI_PRACTICE_AUDIO.question],
      ["stimulus_playing", ARI_PRACTICE_AUDIO[sound]],
      ["answer_prompt", ARI_PRACTICE_AUDIO.answer],
    ], () => {
      busy.current = false;
      transition("awaiting_answer");
    }, signal);
  }, [runCues, transition]);

  const startPractice = useCallback(() => {
    session.current?.abort();
    const controller = new AbortController();
    session.current = controller;
    busy.current = true;
    retry.current = null;
    soundRef.current = null;
    streakRef.current = 0;
    failedRounds.current = 0;
    records.current = [];
    setStreak(0);
    setFeedback(null);
    setAudioIssue(false);
    setReplaying(false);
    setCompletionReady(false);
    transition("initializing");
    runCues([["intro", ARI_PRACTICE_AUDIO.intro]], () => {
      askQuestion(randomSound(), controller.signal);
    }, controller.signal);
  }, [askQuestion, runCues, transition]);

  useEffect(() => {
    startPractice();
    return () => session.current?.abort();
  }, [startPractice]);

  const handleAnswer = async (selected) => {
    if (busy.current || stateRef.current !== "awaiting_answer" || retry.current) return;
    busy.current = true; // Synchronous guard also covers rapid touch/click events.
    const signal = session.current.signal;
    const sound = soundRef.current;
    const correct = selected === opposite(sound);
    records.current.push({ soundType: sound, selectedTarget: selected, isCorrect: correct });
    streakRef.current = correct ? streakRef.current + 1 : 0;
    if (!correct) failedRounds.current += 1;
    setStreak(streakRef.current);
    setFeedback(correct ? "correct" : "wrong");
    transition("feedback");
    await waitForAriPractice(FEEDBACK_MS, signal);
    if (signal.aborted) return;
    if (streakRef.current === 2) {
      setFeedback(null);
      runCues([["completed", ARI_PRACTICE_AUDIO.complete]], () => {
        busy.current = false;
        setCompletionReady(true);
      }, signal);
    } else if (failedRounds.current >= MAX_PRACTICE_ROUNDS) {
      setFeedback(null);
      transition("assistance_required");
      busy.current = false;
    } else {
      // A successful first answer always gets the other sound. Any mistake
      // starts a fresh random pair; choosing one position twice cannot pass.
      askQuestion(correct ? opposite(sound) : randomSound(), signal);
    }
  };

  const replay = () => {
    if (busy.current || retry.current || stateRef.current !== "awaiting_answer") return;
    busy.current = true;
    setReplaying(true);
    runCues([["stimulus_playing", ARI_PRACTICE_AUDIO[soundRef.current]]], () => {
      busy.current = false;
      setReplaying(false);
      transition("awaiting_answer");
    }, session.current.signal);
  };

  const recoverAudio = () => {
    if (busy.current || !retry.current) return;
    // Reuse the failed cue and current sound; never create another question.
    retry.current();
  };

  const canAnswer = state === "awaiting_answer" && !replaying && !audioIssue;
  const playing = state === "stimulus_playing" && !audioIssue;
  const guideMood = state === "completed" ? "complete" : feedback || (state === "intro" ? "enter" : "idle");
  const message = audioIssue ? "聲音沒播出來，請再試一次" : state === "completed" ? "完成囉！" :
    state === "assistance_required" ? "請大人陪你再練習" : feedback === "correct" ? "答對了！" :
    feedback === "wrong" ? "再試試看" : canAnswer ? "換你選囉" : "仔細聽一聽";

  return (
    <main className="ari-practice" data-testid="ari-practice" data-state={state} data-can-answer={canAnswer} aria-label="動物聲音試玩">
      <h1 className="ari-practice-title">請選擇相反的動物</h1>
      <div className="ari-practice-animals" aria-label="選擇動物">
        {[["cat", cat, "貓咪"], ["dog", dog, "狗狗"]].map(([target, source, label]) => (
          <button key={target} type="button" className="ari-practice-animal" aria-label={label} disabled={!canAnswer} onClick={() => handleAnswer(target)}>
            <img src={source} alt="" draggable="false" />
          </button>
        ))}
      </div>
      <div className="ari-practice-bottom">
        <div className="ari-practice-guide-enter">
          <img className={`ari-practice-guide is-${guideMood}`} src={mouse} alt="試玩小幫手" draggable="false" />
        </div>
        <div className="ari-practice-progress">
          <div className={`ari-practice-stars ${state === "completed" ? "is-complete" : ""}`} role="img" aria-label={`連續答對 ${streak}/2 題`}>
            {[1, 2].map((star) => <span key={star} className={star <= streak ? "is-lit" : ""} aria-hidden="true">★</span>)}
          </div>
          <p className={`ari-practice-message ${feedback ? `is-${feedback}` : ""}`} role="status">{message}</p>
        </div>
        <button type="button" className={`ari-practice-replay ${playing ? "is-playing" : ""}`} aria-label="重播動物聲音" disabled={!canAnswer} onClick={replay}>
          <img src={voice} alt="" draggable="false" />
        </button>
      </div>
      {(audioIssue || state === "assistance_required" || completionReady) && (
        <div className="ari-practice-actions">
          {audioIssue && <button type="button" onClick={recoverAudio}>再播一次</button>}
          {completionReady && <button type="button" onClick={() => {
            if (busy.current) return;
            busy.current = true;
            session.current.abort();
            onComplete();
          }}>開始挑戰</button>}
          {state === "assistance_required" && <>
            <p>請家長或專業人員陪同，重看示範再試一次。</p>
            <button type="button" onClick={onReviewStep}>重看 STEP 示範</button>
            <button type="button" onClick={startPractice}>重新試玩</button>
          </>}
        </div>
      )}
    </main>
  );
}
