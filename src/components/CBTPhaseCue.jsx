import { useEffect, useRef } from "react";
import startSound from "../asset/CBT/start.mp3";
import rainImg from "../asset/CBT/rain.gif";
import thunderImg from "../asset/CBT/thunder.gif";

export function useCbtStartCue(phase) {
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = new Audio(startSound);
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase === "answer" || phase === "warmupAnswer") {
      audio.currentTime = 0;
      Promise.resolve(audio.play()).catch(() => {});
    } else {
      audio.pause();
    }
  }, [phase]);
}

export function CBTPhaseCue({ phase }) {
  const canAnswer = phase === "answer" || phase === "warmupAnswer";
  return <p className="cbt-quiet-prompt" role="status" aria-live="polite"
    style={{ color: "#fff4c7", fontSize: "clamp(21px, 2vw, 28px)", fontWeight: 900,
      textShadow: "0 2px 4px #125b69", margin: "0 0 12px", minHeight: 40 }}
    data-testid={canAnswer ? "cbt-ready-cue" : "cbt-observe-cue"}>
    {canAnswer ? "可以開始點了！" : "先看完亮燈，再依順序點石頭。"}
  </p>;
}

export function CBTEnvironment({ visible }) {
  if (!visible) return null;
  return <div data-testid="cbt-environment" aria-label="觀察階段環境干擾"
    style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 760,
      height: 84, margin: "0 auto", pointerEvents: "none", overflow: "hidden" }}>
    <img src={rainImg} alt="下雨" style={{ width: 84, height: 84, objectFit: "contain" }} />
    <img src={thunderImg} alt="雷電" style={{ width: 84, height: 84, objectFit: "contain" }} />
  </div>;
}
