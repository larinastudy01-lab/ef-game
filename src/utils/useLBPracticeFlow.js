import { useCallback, useEffect, useRef, useState } from "react";
import { playLBPracticeCue, waitForLBPractice } from "./lbPracticeAudio";
import { LB_MODES } from "./lbPracticeProtocol";

export default function useLBPracticeFlow({ stage, displayItems, onPassed, onRetry, onPlayback }) {
  const [status, setStatus] = useState("inactive");
  const [mouse, setMouse] = useState(null);
  const [demoKeys, setDemoKeys] = useState([]);
  const [activity, setActivity] = useState(0);
  const flowRef = useRef(null);
  const feedbackCueRef = useRef(null);
  const passedRef = useRef(onPassed);
  const retryRef = useRef(onRetry);
  const completingRef = useRef(false);
  passedRef.current = onPassed;
  retryRef.current = onRetry;
  const playCue = useCallback((event, signal) => playLBPracticeCue(event, signal, onPlayback), [onPlayback]);

  useEffect(() => {
    if (!stage) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    flowRef.current = controller;
    completingRef.current = false;
    setStatus("opening");
    setMouse(null);
    setDemoKeys([]);

    const introduce = async () => {
      const cues = stage.id === LB_MODES.practiceMode1
        ? ["intro", "rule1"]
        : ["transition", "rule2", "guide2"];
      for (const cue of cues) {
        await playCue(cue, signal);
        if (signal.aborted) return;
      }
      setStatus("demonstrating");
      // Mount at the first demonstrated sign, without an off-board entry path.
      await waitForLBPractice(120, signal);
      for (const key of stage.demoKeys) {
        if (signal.aborted) return;
        const item = displayItems.find((candidate) => candidate.key === key);
        setMouse({ key, position: item.position, clicking: false });
        await waitForLBPractice(650, signal);
        if (signal.aborted) return;
        setMouse({ key, position: item.position, clicking: true });
        setDemoKeys((previous) => [...previous, key]);
        await waitForLBPractice(550, signal);
      }
      if (signal.aborted) return;
      // Demonstrations never count as the child's answer.
      setMouse(null);
      setDemoKeys([]);
      setStatus("yourTurn");
      await playCue(stage.id === LB_MODES.practiceMode1 ? "turn1" : "turn2", signal);
      if (!signal.aborted) setStatus("answering");
    };
    introduce();
    return () => {
      controller.abort();
      feedbackCueRef.current?.abort();
      flowRef.current = null;
    };
  }, [stage, displayItems, playCue]);

  const registerActivity = useCallback(() => {
    feedbackCueRef.current?.abort();
    setActivity((previous) => previous + 1);
  }, []);

  const checkSelection = (item, index) => {
    if (!stage || status !== "answering") return;
    const expected = stage.items.find((candidate) => candidate.key === stage.sequence[index]);
    if (!expected || item.key === expected.key) return;
    const cue = item.number !== expected.number
      ? (stage.id === LB_MODES.practiceMode1 ? "numberError1" : "numberError2")
      : "colorError";
    feedbackCueRef.current?.abort();
    const controller = new AbortController();
    feedbackCueRef.current = controller;
    playCue(cue, controller.signal);
  };

  useEffect(() => {
    if (!stage || status !== "answering") return undefined;
    const timer = window.setTimeout(() => {
      feedbackCueRef.current?.abort();
      const controller = new AbortController();
      feedbackCueRef.current = controller;
      playCue("idle", controller.signal);
    }, 5000);
    // registerActivity stops speech before starting any new error cue; resetting
    // this timer must not cancel that new cue during the following render.
    return () => window.clearTimeout(timer);
  }, [stage, status, activity, playCue]);

  const reviewAnswer = async ({ correct, durationMs }) => {
    if (status !== "answering" || completingRef.current || !flowRef.current) return;
    completingRef.current = true;
    registerActivity();
    setStatus("reviewing");
    const { signal } = flowRef.current;
    await waitForLBPractice(durationMs, signal);
    if (signal.aborted) return;
    if (!correct) {
      setStatus("retrying");
      // Restore the cards before the retry narration points back to number one.
      // The retrying status keeps them locked until the recording finishes.
      retryRef.current();
      await playCue(stage.id === LB_MODES.practiceMode1 ? "retry1" : "retry2", signal);
      if (signal.aborted) return;
      completingRef.current = false;
      setStatus("answering");
      return;
    }
    setStatus("success");
    await playCue("complete", signal);
    if (!signal.aborted) passedRef.current();
  };

  return { status, mouse, demoKeys, registerActivity, checkSelection, reviewAnswer };
}
