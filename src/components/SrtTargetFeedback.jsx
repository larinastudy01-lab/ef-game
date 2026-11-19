import React from "react";
import "../styles/SrtTargetFeedback.css";

export default function SrtTargetFeedback({ position }) {
  return position ? (
    <div className="srt-target-feedback" aria-hidden="true"
      style={{ left: `${position.x}%`, top: `${position.y}%` }} />
  ) : null;
}
