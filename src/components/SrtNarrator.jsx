import React from "react";
import chickenImg from "../asset/chicken.webp";
import chickenClosedImg from "../asset/chicken01.webp";
import "../styles/SrtNarrator.css";

export default function SrtNarrator({ event, speaking = Boolean(event), className = "", alt = "小雞旁白" }) {
  return (
    <span className={`srt-narrator ${className}`} role="img" aria-label={alt}
      data-testid="srt-narrator" data-narration-event={event} data-speaking={speaking}>
      <img className="srt-narrator-frame srt-narrator-frame-open" src={chickenImg} alt="" aria-hidden="true" draggable={false} />
      <img className="srt-narrator-frame srt-narrator-frame-closed" src={chickenClosedImg} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
}
