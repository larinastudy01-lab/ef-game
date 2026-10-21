import React, { useCallback, useEffect, useRef, useState } from "react";
import mouse from "../asset/mouse.webp";
import voice from "../asset/voice.webp";
import start from "../asset/home/start.webp";
import cat from "../asset/ARI/cat.webp";
import dog from "../asset/ARI/dog.webp";
import AriNarrator from "./AriNarrator";
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
  const [feedback, setFeedback] = useState(null);
  const [audioIssue, setAudioIssue] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [completionReady, setCompletionReady] = useState(false);
  const [narration, setNarration] = useState(null);
  const [speaking, setSpeaking] = useState(false);
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
      const isNarration = source !== ARI_PRACTICE_AUDIO.cat && source !== ARI_PRACTICE_AUDIO.dog;
      setNarration(isNarration ? nextState : null);
      setSpeaking(false);
      try {
        await playAriPracticeAudio(source, signal, isNarration ? (playing) => {
          if (!signal.aborted) setSpeaking(playing);
        } : undefined);
      } catch {
        if (signal.aborted) return;
        setNarration(null);
        setSpeaking(false);
        busy.current = false;
        setReplaying(false);
        retry.current = () => playSequence(cues.slice(index), done, signal);
        setAudioIssue(true);
        return;
      }
      if (signal.aborted) return;
      setNarration(null);
      setSpeaking(false);
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
    setFeedback(null);
    setAudioIssue(false);
    setReplaying(false);
    setCompletionReady(false);
    transition("initializing");
    runCues([
      ["intro", ARI_PRACTICE_AUDIO.intro],
      ["dog_rule", ARI_PRACTICE_AUDIO.dogRule],
      ["cat_rule", ARI_PRACTICE_AUDIO.catRule],
    ], () => {
      askQuestion(randomSound(), controller.signal);
    }, controller.signal);
  }, [askQuestion, runCues, transition]);

  useEffect(() => {
    startPractice();
    return () => session.current?.abort();
  }, [startPractice]);

  const handleAnswer = (selected) => {
    if (busy.current || stateRef.current !== "awaiting_answer" || retry.current) return;
    busy.current = true; // Synchronous guard also covers rapid touch/click events.
    const signal = session.current.signal;
    const sound = soundRef.current;
    const correct = selected === opposite(sound);
    records.current.push({ soundType: sound, selectedTarget: selected, isCorrect: correct });
    streakRef.current = correct ? streakRef.current + 1 : 0;
    if (!correct) failedRounds.current += 1;
    setFeedback(correct ? "correct" : "wrong");
    const feedbackDelay = waitForAriPractice(FEEDBACK_MS, signal);
    const cues = [["feedback", correct ? ARI_PRACTICE_AUDIO.correct : ARI_PRACTICE_AUDIO.wrong]];
    if (!correct && failedRounds.current < MAX_PRACTICE_ROUNDS) {
      cues.push(["retry_prompt", ARI_PRACTICE_AUDIO.retry]);
    }
    runCues(cues, async () => {
      await feedbackDelay;
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
    }, signal);
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
  const guidedTarget = canAnswer ? opposite(soundRef.current) : null;
  const passed = state === "completed" || state === "assessment_intro";
  const solo = state === "intro" || passed;
  const narratorEvent = narration || (solo ? state : null);
  const message = audioIssue ? "聲音沒播出來，請再試一次" :
    state === "intro" ? "仔細聽喔！這次要找跟聲音不一樣的動物！" :
    state === "dog_rule" ? "聽到狗狗的叫聲，就要點貓咪！" :
    state === "cat_rule" ? "聽到貓咪的叫聲，就要點狗狗！" :
    state === "question_prompt" ? "小耳朵準備好！聽一聽，再點相反的動物！" :
    state === "assessment_intro" ? "記得喔！聽到聲音，要點另一隻動物！" :
    state === "assistance_required" ? "請大人陪你再練習" :
    state === "retry_prompt" ? "沒關係，重新找另一隻動物！" :
    feedback === "correct" ? "太棒了！你有找到正確的動物喔！" :
    feedback === "wrong" ? "哎呀！要點另一隻動物！" : canAnswer ? "換你選囉" : "仔細聽一聽";

  return (
    <main className="ari-practice" data-testid="ari-practice" data-state={state} data-can-answer={canAnswer} aria-label="動物聲音試玩">
      <h1 className="ari-practice-sr-only">請選擇相反的動物</h1>
      <p className="ari-practice-sr-only" role="status">{message}</p>
      <div className="ari-practice-scene" data-narrator-layout={solo ? "center" : narratorEvent ? "beside" : "animals"}>
        {!solo && <div className="ari-practice-animals" aria-label="選擇動物">
        {[["cat", cat, "貓咪"], ["dog", dog, "狗狗"]].map(([target, source, label]) => (
          <button key={target} type="button" className="ari-practice-animal" aria-label={label} disabled={!canAnswer} onClick={() => handleAnswer(target)}>
            <img src={source} alt="" draggable="false" />
            {target === guidedTarget && <img className="ari-practice-guide" src={mouse} alt="提示點擊正確動物" aria-hidden="true" draggable="false" />}
          </button>
        ))}
        </div>}
        {narratorEvent && <AriNarrator event={narratorEvent} speaking={speaking} />}
      </div>
      {!solo && <div className="ari-practice-toolbar">
        <button type="button" className={`ari-practice-replay ${playing ? "is-playing" : ""}`} aria-label="重播動物聲音" disabled={!canAnswer} onClick={replay}>
          <img src={voice} alt="" draggable="false" />
        </button>
      </div>}
      {(audioIssue || state === "assistance_required" || completionReady) && (
        <div className="ari-practice-actions">
          {audioIssue && <button type="button" onClick={recoverAudio}>再播一次</button>}
          {completionReady && <button type="button" className="ari-practice-start" aria-label="開始挑戰" onClick={() => {
            if (busy.current) return;
            setCompletionReady(false);
            runCues([["assessment_intro", ARI_PRACTICE_AUDIO.assessmentStart]], () => {
              session.current.abort();
              onComplete();
            }, session.current.signal);
          }}>
            <img className="ari-practice-start-image" src={start} width="280" height="180" alt="" draggable="false" />
            <img className="ari-practice-guide" src={mouse} alt="提示點擊開始挑戰" aria-hidden="true" draggable="false" />
          </button>}
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
