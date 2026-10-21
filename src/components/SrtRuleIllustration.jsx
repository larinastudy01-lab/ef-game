import React from "react";
import normalImg from "../asset/SRT/training/acorn.webp";
import rottenImg from "../asset/SRT/training/rotten_acorn.webp";
import mouseImg from "../asset/mouse.webp";
import "../styles/SrtRuleIllustration.css";

const stimuli = {
  normal: { img: normalImg, width: 151, height: 194 },
  rotten: { img: rottenImg, width: 166, height: 201 },
};

export default function SrtRuleIllustration({ targetType, stimulus = stimuli[targetType], size, animate = false }) {
  const isGo = targetType === "normal";
  return (
    <span className="srt-rule-illustration" role="img"
      aria-label={isGo ? "用手指點擊好橡實" : "壞橡實上打叉，不要點擊"}
      data-animate={animate} style={size ? { "--srt-rule-size": `${size}px` } : undefined}>
      <img className="srt-rule-acorn" src={stimulus.img} width={stimulus.width} height={stimulus.height}
        alt="" draggable={false} />
      {isGo ? (
        <img className="srt-rule-mouse" data-testid="srt-rule-mouse" src={mouseImg} width="156" height="156" alt="" draggable={false} />
      ) : (
        <svg className="srt-rule-cross" data-testid="srt-rule-cross" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M18 18L82 82M82 18L18 82" fill="none" stroke="#fffaf1" strokeWidth="18" strokeLinecap="round" />
          <path d="M18 18L82 82M82 18L18 82" fill="none" stroke="#cf3c2d" strokeWidth="11" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
