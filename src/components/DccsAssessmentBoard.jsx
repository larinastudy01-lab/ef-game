import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import chicken from "../asset/chicken.webp";
import chickenClosed from "../asset/chicken01.webp";
import mouse from "../asset/mouse.webp";
import leftBox from "../asset/DCCS/box_left.webp";
import rightBox from "../asset/DCCS/box_right.webp";
import { DCCS_ASSESSMENT_CONFIG as CONFIG } from "../config/dccsAssessmentConfig";
import { getDccsCorrectPosition } from "../utils/dccsAssessmentProtocol";

export default function DccsAssessmentBoard({ rule, ruleIndex, phase, trial, presentationKey,
  onAssetsReady, onAnswer, locked, selected, feedback, feedbackShown,
  speaking, audioFailed, onReplay, onContinue }) {
  const root = useRef(null);
  const stimulus = useRef(null);
  const boxes = useRef({});
  const [imageError, setImageError] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
  const practice = phase.startsWith("practice_");
  const question = phase.endsWith("_question");
  const intro = phase.endsWith("_intro");
  const passed = phase === "practice_passed";
  const showHandHint = practice && question && !locked && !selected && !imageError;
  const handHintPosition = showHandHint ? getDccsCorrectPosition(trial) : null;
  const hasVisualContent = Boolean(trial) && !passed;
  const stimulusVisible = hasVisualContent && !(intro && !practice) && !(selected && feedbackShown);
  const narratorLayout = stimulusVisible ? "fixed" : hasVisualContent ? "above-boxes" : "center";
  const characterState = passed || (feedbackShown && feedback?.type === "correct") ? "happy"
    : feedbackShown ? "encourage" : speaking ? "speaking" : intro && ruleIndex > 0 ? "transition" : "idle";
  useEffect(() => { setImageError(false); }, [presentationKey, imageRetry]);
  const checkImages = () => {
    const images = Array.from(root.current?.querySelectorAll("img[data-stimulus-asset]") || []);
    if (images.length === 3 && images.every((img) => img.complete && img.naturalWidth > 0)) onAssetsReady();
  };
  useEffect(checkImages, [presentationKey, imageRetry, onAssetsReady]); // cached assets also gate presentation
  useLayoutEffect(() => {
    if (!selected || !stimulus.current || !boxes.current[selected]) return;
    const source = stimulus.current.getBoundingClientRect();
    const target = boxes.current[selected].getBoundingClientRect();
    stimulus.current.style.setProperty("--deposit-x", `${target.left + target.width / 2 - source.left - source.width / 2}px`);
    stimulus.current.style.setProperty("--deposit-y", `${target.top + target.height * 0.18 - source.top - source.height / 2}px`);
  }, [selected]);

  return <main ref={root} className="dccs-assessment" data-testid="dccs-assessment"
    data-mode={practice ? "practice" : "formal"} data-rule={rule.id} data-phase={phase}
    style={{ "--reveal-ms": `${CONFIG.revealMs}ms`, "--deposit-ms": `${CONFIG.depositMs}ms` }}>
    {(practice || intro || speaking) && <aside className={`dccs-narrator is-${characterState}`}
      data-state={characterState} data-speaking={speaking} data-layout={narratorLayout}>
      <span className="dccs-narrator-slot" role="img" aria-label="小雞旁白" data-testid="dccs-narrator">
        <span className="dccs-narrator-portrait">
          <img className="dccs-narrator-frame dccs-narrator-open" src={chicken}
            width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
          <img className="dccs-narrator-frame dccs-narrator-closed" src={chickenClosed}
            width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
        </span>
      </span>
    </aside>}

    {hasVisualContent && <>
      <div className={`dccs-stimulus-stage ${trial.imageVariant === "bag" ? "is-bagged" : ""} ${intro ? "is-intro" : ""} ${!stimulusVisible ? "is-hidden" : ""}`}>
        <div ref={stimulus} className={`dccs-stimulus ${selected ? "is-depositing" : ""}`}>
          <img key={`${presentationKey}-${imageRetry}`} data-stimulus-asset data-testid="dccs-stimulus" src={trial.imageVariant === "bag" ? trial.card.bagImg : trial.card.normalImg}
            className={`${question ? "is-revealing" : ""} ${intro && practice && rule.id === "bag_color" ? "is-bag-intro" : ""}`}
            alt={`${trial.imageVariant === "bag" ? "透明袋裡的" : ""}${trial.card.colorText}${trial.card.typeText}`}
            width="330" height="330" onLoad={checkImages} onError={() => setImageError(true)} draggable="false" />
        </div>
      </div>
      <div className="dccs-assessment-boxes">
        {[["top", leftBox, "左側"], ["bottom", rightBox, "右側"]].map(([side, src, label]) =>
          <button key={side} ref={(node) => { boxes.current[side] = node; }} type="button"
            data-position={side === "top" ? "left" : "right"}
            className={`dccs-assessment-box ${selected === side ? "is-selected" : ""}`}
            aria-label={`${label}分類箱`} onClick={() => onAnswer(side)} disabled={locked || !question || imageError}>
            <span className="dccs-box-artwork">
              <img key={imageRetry} data-stimulus-asset src={src} alt={`${label}分類箱參照物`} width="319" height="131"
                onLoad={checkImages} onError={() => setImageError(true)} draggable="false" />
              {/* Magnify the original printed label in place; reuse the loaded
                  box asset without replacing its reference or redrawing it. */}
              <span className="dccs-box-reference" aria-hidden="true">
                <img src={src} alt="" width="319" height="131" draggable="false" />
              </span>
            </span>
            {handHintPosition === side && <img className="dccs-practice-hand" data-testid="dccs-practice-hand"
              src={mouse} width="1024" height="1024" alt="" aria-hidden="true" draggable="false" />}
          </button>)}
      </div>
    </>}
    {audioFailed && <div className="dccs-audio-fallback" role="status">
      <span>語音暫時無法播放，請大人協助確認說明。</span>
      <button type="button" onClick={onReplay}>重試語音</button>
      {intro && <button type="button" onClick={onContinue}>{practice ? "開始試玩" : "開始挑戰"}</button>}
    </div>}
    {imageError && <div className="dccs-image-fallback" role="alert">圖片尚未載入，請大人協助。
      <button type="button" onClick={() => setImageRetry((value) => value + 1)}>重試圖片</button>
    </div>}
  </main>;
}
