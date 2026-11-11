import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CBTNarrator from "./CBTNarrator";
import answerVoice from "../asset/voice/換你開始點囉.mp3";
import { createCBTPracticeAudioPlayer } from "../utils/cbtPracticeAudio";
import { CBT_ASSESSMENT_LAYOUT } from "../utils/cbtAssessmentLayout";
import "../styles/CBTPractice.css";
import "../styles/CBTAssessmentStage.css";

export const CBT_ASSESSMENT_ANSWER_AUDIO = answerVoice;
export default function CBTAssessmentStage({ children, cue, onCueComplete, answerAudio = answerVoice, layout = CBT_ASSESSMENT_LAYOUT }) {
  const frameRef = useRef(null);
  const completeRef = useRef(onCueComplete);
  completeRef.current = onCueComplete;
  const [scale, setScale] = useState(1);
  const [voiceState, setVoiceState] = useState("idle");
  const audio = useMemo(() => createCBTPracticeAudioPlayer({ answer: answerAudio }), [answerAudio]);
  const play = useCallback(() => {
    setVoiceState("loading");
    audio.play("answer", {
      onPlaying: () => setVoiceState("speaking"),
      onWaiting: () => setVoiceState("loading"),
      onBlocked: setVoiceState,
      onEnded: () => { setVoiceState("idle"); completeRef.current(); },
    });
  }, [audio]);

  useEffect(() => {
    const frame = frameRef.current;
    const resize = () => setScale(Math.min(1,
      (frame.clientWidth || layout.width) / layout.width));
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(frame);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [layout.width]);

  useEffect(() => {
    if (cue) play();
    return () => audio.stop();
  }, [cue, audio, play]);

  const blocked = voiceState === "blocked" || voiceState === "error";
  return <div className="cbt-assessment-stage" data-testid="cbt-assessment-stage"
    style={{ "--cbt-assessment-board-width": `${layout.width}px` }}>
    <div className="cbt-assessment-board-frame" ref={frameRef}
      style={{ height: layout.height * scale, "--cbt-assessment-board-scale": scale }}>{children}</div>
    <aside className="cbt-assessment-narrator-slot" aria-label="旁白角色區">
      {cue && (blocked ? <button type="button" className="cbt-assessment-audio-retry"
        aria-label="播放作答提示" title="點一下小雞播放提示" onClick={play}>
        <CBTNarrator speaking={false} />
      </button> : <CBTNarrator speaking={voiceState === "speaking"} />)}
    </aside>
  </div>;
}
