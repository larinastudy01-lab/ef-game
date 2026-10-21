import React from "react";
import chicken from "../asset/chicken.webp";
import chickenClosed from "../asset/chicken01.webp";

export default function PMNarrator({ event, speaking = false }) {
  return (
    <span className="pm-narrator" role="img" aria-label="小雞旁白" data-testid="pm-narrator"
      data-narration-event={event} data-speaking={speaking}>
      <img className="pm-narrator-frame pm-narrator-open" src={chicken} width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
      <img className="pm-narrator-frame pm-narrator-closed" src={chickenClosed} width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
    </span>
  );
}
