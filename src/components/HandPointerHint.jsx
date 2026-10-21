import React from "react";
import mouseImg from "../asset/mouse.webp";
import "../styles/HandPointerHint.css";

export default function HandPointerHint({ position, itemSize = 118, durationMs = 1800 }) {
  return <img className="hand-pointer-hint" data-testid="srt-hand-hint" src={mouseImg}
    width="156" height="156" alt="" aria-hidden="true" draggable={false}
    style={{ left: `calc(${position.x}% - ${Math.round(itemSize * 0.1)}px)`, top: `calc(${position.y}% - ${Math.round(itemSize * 0.06)}px)`, animationDuration: `${durationMs}ms` }} />;
}
