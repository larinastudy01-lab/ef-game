import { useCallback, useEffect, useRef, useState } from "react";
import { playLBPracticeCue, waitForLBPractice } from "./lbPracticeAudio";

export default function useLBPracticeFlow({ stage, displayItems, onPassed, onRetry }) {
  const [status, setStatus] = useState("inactive");
  const [mouse, setMouse] = useState(null);
  const [demoKeys, setDemoKeys] = useState([]);
  const [activity, setActivity] = useState(0);
  const flowRef = useRef(null);
  const idleCueRef = useRef(null);
  const passedRef = useRef(onPassed);
  const retryRef = useRef(onRetry);
  const completingRef = useRef(false);
  passedRef.current = onPassed;
  retryRef.current = onRetry;

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
      await playLBPracticeCue("question", signal);
      if (signal.aborted) return;
      setStatus("demonstrating");
      setMouse({ position: { left: "3%", top: "88%" }, clicking: false });
      await waitForLBPractice(120, signal);
      for (const key of stage.demoKeys) {
        if (signal.aborted) return;
        const item = displayItems.find((candidate) => candidate.key === key);
        setMouse({ position: item.position, clicking: false });
        await waitForLBPractice(650, signal);
        if (signal.aborted) return;
        setMouse({ position: item.position, clicking: true });
        setDemoKeys((previous) => [...previous, key]);
        await waitForLBPractice(550, signal);
      }
      if (signal.aborted) return;
      // Demonstrations never count as the child's answer.
      setMouse(null);
      setDemoKeys([]);
      setStatus("yourTurn");
      await playLBPracticeCue("yourTurn", signal);
      if (!signal.aborted) setStatus("answering");
    };
    introduce();
    return () => {
      controller.abort();
      idleCueRef.current?.abort();
      flowRef.current = null;
    };
  }, [stage, displayItems]);

  const registerActivity = useCallback(() => {
    idleCueRef.current?.abort();
    setActivity((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!stage || status !== "answering") return undefined;
    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      idleCueRef.current = controller;
      playLBPracticeCue("idle", controller.signal);
    }, 5000);
    return () => {
      window.clearTimeout(timer);
      idleCueRef.current?.abort();
    };
  }, [stage, status, activity]);

  const reviewAnswer = async ({ correct, durationMs }) => {
    if (status !== "answering" || completingRef.current || !flowRef.current) return;
    completingRef.current = true;
    registerActivity();
    setStatus("reviewing");
    const { signal } = flowRef.current;
    await waitForLBPractice(durationMs, signal);
    if (signal.aborted) return;
    if (!correct) {
      retryRef.current();
      completingRef.current = false;
      setStatus("answering");
      return;
    }
    setStatus("success");
    await playLBPracticeCue("complete", signal);
    if (!signal.aborted) passedRef.current();
  };

  return { status, mouse, demoKeys, registerActivity, reviewAnswer };
}
