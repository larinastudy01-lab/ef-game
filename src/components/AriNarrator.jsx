import React from "react";
import chicken from "../asset/chicken.webp";
import chickenClosed from "../asset/chicken01.webp";
import "../styles/AriNarrator.css";

export default function AriNarrator({ event, speaking = false }) {
  return (
    <span className="ari-narrator" role="img" aria-label="小雞旁白"
      data-testid="ari-narrator" data-narration-event={event} data-speaking={speaking}>
      <img className="ari-narrator-frame ari-narrator-open" src={chicken} alt="" aria-hidden="true" draggable={false} />
      <img className="ari-narrator-frame ari-narrator-closed" src={chickenClosed} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
}
