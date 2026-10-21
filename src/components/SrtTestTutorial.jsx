import React, { useEffect, useRef, useState } from "react";
import HandPointerHint from "./HandPointerHint";
import SrtRuleIllustration from "./SrtRuleIllustration";
import SrtNarrator from "./SrtNarrator";
import {
  buildSrtPracticeResult, createSrtPracticeQueue, emptySrtPracticeProgress,
  resolveSrtPracticeConfig, saveSrtPracticeResult, updateSrtPracticeProgress,
} from "../utils/srtPracticeProtocol";
import { playSrtCue, waitForSrtPractice } from "../utils/srtPracticeAudio";
import "../styles/SrtTestTutorial.css";

const randomPosition = () => ({ x: 18 + Math.random() * 64, y: 24 + Math.random() * 54 });
const initialView = () => ({ stage: "enter", item: null, visible: false, hintVisible: false, progress: emptySrtPracticeProgress(), feedback: null, responseFeedback: null, narrationEvent: null });

export default function SrtTestTutorial({ onReady, onExit, childId, assessmentTiming, config, getPosition = randomPosition }) {
  const [settings] = useState(() => resolveSrtPracticeConfig(config, assessmentTiming));
  const [view, setView] = useState(initialView);
  const [session, setSession] = useState(0);
  const respondRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const sessionOptionsRef = useRef({ childId, getPosition });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const { childId: practiceChildId, getPosition: pickPosition } = sessionOptionsRef.current;
    const startedAtMs = Date.now();
    const records = [];
    const audioEvents = [];
    const nextType = createSrtPracticeQueue(Math.random, settings.ratio);
    let progress = emptySrtPracticeProgress();
    let hintCount = 0;
    let finalized = false;
    let lastOnset = null;
    const show = (patch) => { if (!signal.aborted) setView((previous) => ({ ...previous, ...patch })); };
    const wait = (ms) => waitForSrtPractice(ms, signal);
    const pickInterval = () => settings.stimulusIntervalsMs[Math.floor(Math.random() * settings.stimulusIntervalsMs.length)];
    const persist = (status) => saveSrtPracticeResult(buildSrtPracticeResult({
      records, progress, hintCount, startedAtMs, status, config: settings, audioEvents,
    }), practiceChildId);
    const cue = async (event) => {
      const hasVoice = settings.audio.enabled && settings.audio.events[event];
      if (hasVoice) show({ narrationEvent: event });
      try {
        const outcome = await playSrtCue(event, settings.audio, signal);
        audioEvents.push({ event, outcome });
      } finally {
        if (hasVoice) show({ narrationEvent: null });
      }
    };

    const demonstrate = async () => {
      const demonstration = new AbortController();
      const stopDemonstration = () => demonstration.abort();
      signal.addEventListener("abort", stopDemonstration, { once: true });
      let clicked = false;
      show({ stage: "demonstration", item: { targetType: "normal", x: 50, y: 50 },
        visible: true, hintVisible: settings.handAnimation.enabled, feedback: null });
      // The example responds to a child's tap, but never counts as an independent trial.
      respondRef.current = ({ hit }) => {
        if (!hit || clicked || signal.aborted) return;
        clicked = true;
        respondRef.current = null;
        show({ stage: "demonstrationFeedback", item: null, visible: false, hintVisible: false, feedback: true });
        stopDemonstration();
      };
      try {
        const playback = cue("ruleGo");
        const handFinished = waitForSrtPractice(settings.handAnimation.enabled ? settings.handAnimation.durationMs : 0, demonstration.signal)
          .then(() => show({ hintVisible: false }));
        await waitForSrtPractice(Math.max(settings.stimulusDurationMs,
          settings.handAnimation.enabled ? settings.handAnimation.durationMs : 0), demonstration.signal);
        respondRef.current = null;
        show({ item: null, visible: false });
        await Promise.all([playback, handFinished, clicked ? wait(settings.feedbackDurationMs) : Promise.resolve()]);
      } finally {
        signal.removeEventListener("abort", stopDemonstration);
        stopDemonstration();
      }
    };

    const presentTrial = (targetType, plannedInterval, afterExtraHint) => new Promise((resolve) => {
      let locked = false;
      let hideTimer;
      let responseTimer;
      let displayEndTimer;
      let onset;
      const item = { targetType, ...pickPosition() };
      const cleanup = () => {
        clearTimeout(hideTimer);
        clearTimeout(responseTimer);
        clearTimeout(displayEndTimer);
        cancelAnimationFrame(frame);
        signal.removeEventListener("abort", abort);
        respondRef.current = null;
      };
      const abort = () => { locked = true; cleanup(); resolve(null); };
      const settle = ({ clicked = false, hit = false } = {}) => {
        if (locked || signal.aborted || onset == null) return;
        locked = true;
        const elapsed = performance.now() - onset;
        const validClick = clicked && elapsed < settings.responseWindowMs;
        const isGo = targetType === "normal";
        const isCorrect = isGo ? validClick && hit : !validClick;
        clearTimeout(responseTimer);
        respondRef.current = null;
        const record = {
          trialIndex: records.length + 1, targetType, clicked: validClick,
          clickedStimulus: validClick && hit, isCorrect,
          reactionTime: validClick ? Math.round(elapsed) : null,
          responseElapsedMs: Math.round(elapsed), timeout: isGo && !validClick,
          action: isGo ? (isCorrect ? "hit" : validClick ? "wrongLocation" : "miss") : (isCorrect ? "correctAvoid" : "falseAlarm"),
          afterExtraHint, stimulusOnsetMs: Math.round(onset),
          stimulusIntervalMs: lastOnset == null ? null : Math.round(onset - lastOnset),
          configuredNextIntervalMs: plannedInterval,
          stimulusDurationMs: settings.stimulusDurationMs, responseWindowMs: settings.responseWindowMs,
          positionX: item.x, positionY: item.y,
        };
        if (validClick) {
          show({ responseFeedback: isCorrect, progress: updateSrtPracticeProgress(progress, record, settings) });
        }
        const finish = () => {
          cleanup();
          show({ item: null, visible: false, responseFeedback: null });
          lastOnset = onset;
          resolve(record);
        };
        // A tap is acknowledged immediately; the acorn still completes its display.
        const remainingDisplayMs = settings.stimulusDurationMs - elapsed;
        if (remainingDisplayMs > 0) displayEndTimer = setTimeout(finish, remainingDisplayMs);
        else finish();
      };
      const frame = requestAnimationFrame(() => {
        if (signal.aborted) { abort(); return; }
        onset = performance.now();
        show({ stage: "trial", item, visible: true, feedback: null, responseFeedback: null });
        respondRef.current = settle;
        hideTimer = setTimeout(() => show({ visible: false }), settings.stimulusDurationMs);
        responseTimer = setTimeout(() => settle(), settings.responseWindowMs);
      });
      signal.addEventListener("abort", abort, { once: true });
    });

    const run = async () => {
      setView(initialView());
      await cue("enterPractice");
      if (signal.aborted) return;
      await demonstrate();
      if (signal.aborted) return;
      show({ stage: "rules", feedback: null });
      await cue("ruleNoGo");
      if (signal.aborted) return;
      let earliestOnset = performance.now() + pickInterval();
      let afterExtraHint = false;
      let needsStartCue = true;
      while (!signal.aborted) {
        show({ stage: "beforeTrial", item: null, visible: false, feedback: null });
        if (needsStartCue) await cue("beforeTrial");
        await wait(Math.max(0, earliestOnset - performance.now()));
        if (signal.aborted) return;
        const plannedInterval = pickInterval();
        const record = await presentTrial(nextType(), plannedInterval, afterExtraHint);
        if (!record || signal.aborted) return;
        records.push(record);
        progress = updateSrtPracticeProgress(progress, record, settings);
        show({ stage: "feedback", progress, feedback: record.isCorrect });
        persist("in_progress");

        if (progress.passed) {
          show({ stage: "completionAudio", feedback: null });
          await cue("practiceComplete");
          if (signal.aborted) return;
          show({ stage: "completion" });
          await wait(settings.completionAnimationMs);
          if (signal.aborted) return;
          finalized = true;
          persist("passed");
          show({ stage: "ready" });
          onReadyRef.current?.();
          return;
        }
        // The stimulus and its response window have ended before any feedback voice.
        // Keep at least the configured blank, and wait for speech before the next trial.
        await Promise.all([
          wait(settings.feedbackDurationMs),
          cue(record.isCorrect ? "correct" : record.targetType === "rotten" ? "wrongNoGo" : "missedGo"),
        ]);
        if (signal.aborted) return;
        persist("in_progress");
        if (records.length >= settings.maxTrials) {
          finalized = true;
          persist("assistance_required");
          show({ stage: "help", feedback: null });
          return;
        }
        afterExtraHint = !record.isCorrect;
        needsStartCue = afterExtraHint;
        if (afterExtraHint) {
          hintCount += 1;
          await cue("retry");
          if (signal.aborted) return;
          await demonstrate();
          persist("in_progress");
        }
        earliestOnset = lastOnset + plannedInterval;
      }
    };
    run().catch((error) => {
      if (signal.aborted) return;
      console.error("SRT 試玩暫停：", error);
      finalized = true;
      persist("assistance_required");
      show({ stage: "help", item: null, visible: false });
    });
    return () => {
      controller.abort();
      respondRef.current = null;
      if (!finalized) persist("interrupted");
    };
  }, [session, settings]);

  const { stage, item, visible, progress } = view;
  const stimulus = item && settings.stimuli[item.targetType];
  const isDemo = stage === "demonstration";
  const hasTeachingVisual = stage === "rules" || (isDemo && item && visible);
  const narratorLayout = settings.audio.enabled && hasTeachingVisual ? "beside" : "center";
  const target = item && (
    <button type="button" className="srt-practice-target" data-testid={isDemo ? "srt-practice-example" : "srt-practice-target"}
      data-visible={visible} data-target-type={item.targetType}
      aria-label={stimulus.label} onClick={(event) => { event.stopPropagation(); respondRef.current?.({ clicked: true, hit: true }); }}
      style={{ left: `${item.x}%`, top: `${item.y}%`, width: settings.itemSizePx, height: Math.round(settings.itemSizePx * stimulus.height / stimulus.width) }}>
      <img src={stimulus.img} width={stimulus.width} height={stimulus.height} alt="" draggable={false}
        style={{ visibility: visible ? "visible" : "hidden" }} />
    </button>
  );

  return (
    <main className="srt-play-page srt-practice-page" data-mode="practice" data-stage={stage}
      data-feedback-animation={settings.feedbackAnimationEnabled} aria-label="SRT 試玩">
      <div className="srt-practice-board" data-testid="srt-practice-area" data-narrator-layout={narratorLayout}
        onClick={() => respondRef.current?.({ clicked: true, hit: false })}>
        <div className="srt-practice-header">
          <div className="srt-practice-progress" role="progressbar" aria-label="連續答對進度"
            aria-valuenow={Math.min(progress.correctStreak, settings.requiredCorrectStreak)} aria-valuemin={0} aria-valuemax={settings.requiredCorrectStreak}>
            {Array.from({ length: settings.requiredCorrectStreak }, (_, index) => (
              <img key={index} src={settings.stimuli.normal.img} width="151" height="194" alt=""
                className={index < progress.correctStreak ? "is-complete" : ""} />
            ))}
          </div>
        </div>
        {(isDemo || stage === "rules") && (
          <div className="srt-practice-teaching-area">
            {stage === "rules" && (
              <div className="srt-practice-rule-example">
                <SrtRuleIllustration targetType="rotten" stimulus={settings.stimuli.rotten} size={settings.itemSizePx} />
              </div>
            )}
            {isDemo && target}
            {isDemo && view.hintVisible && settings.handAnimation.enabled && item && (
              <HandPointerHint position={item} itemSize={settings.itemSizePx} durationMs={settings.handAnimation.durationMs} />
            )}
          </div>
        )}
        {!isDemo && target}
        {stage === "trial" && item && view.responseFeedback === false && (
          <div className="srt-practice-response-feedback is-gentle" aria-hidden="true"
            style={{ left: `calc(${item.x}% + ${settings.itemSizePx / 2 - 10}px)`,
              top: `calc(${item.y}% - ${Math.round(settings.itemSizePx * stimulus.height / stimulus.width) / 2 - 10}px)` }}>
            🍃
          </div>
        )}
        {(view.narrationEvent || stage === "completion") && (
          <aside className="srt-practice-narrator-slot" aria-label="旁白小雞">
            <SrtNarrator event={view.narrationEvent} speaking={Boolean(view.narrationEvent)} />
          </aside>
        )}
        {stage === "help" && (
          <div className="srt-practice-assistance" onClick={(event) => event.stopPropagation()}>
            <p>先休息一下，請大人陪你確認遊戲規則，再重新試玩。</p>
            <button type="button" onClick={() => setSession((value) => value + 1)}>重新試玩</button>
            {onExit && <button type="button" onClick={onExit}>返回測驗地圖</button>}
          </div>
        )}
      </div>
    </main>
  );
}
