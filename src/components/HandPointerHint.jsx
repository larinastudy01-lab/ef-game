import React from "react";
import mouseImg from "../asset/mouse.webp";
import "../styles/HandPointerHint.css";

export default function HandPointerHint({ position, itemSize = 118, durationMs = 1800 }) {
  return <img className="hand-pointer-hint" data-testid="srt-hand-hint" src={mouseImg}
    width="156" height="156" alt="" aria-hidden="true" draggable={false}
    style={{ left: `calc(${position.x}% + ${itemSize / 2 + 8}px)`, top: `${position.y}%`, animationDuration: `${durationMs}ms` }} />;
}
