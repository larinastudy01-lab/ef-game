import React from "react";
import chicken from "../asset/chicken.webp";
import chickenClosed from "../asset/chicken01.webp";

export default function CBTNarrator({ speaking = false, happy = false }) {
  return (
    <span className={`cbt-narrator${happy ? " is-happy" : ""}`} role="img" aria-label="小雞旁白"
      data-testid="cbt-narrator" data-speaking={speaking}>
      <img className="cbt-narrator-frame cbt-narrator-open" src={chicken}
        width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
      <img className="cbt-narrator-frame cbt-narrator-closed" src={chickenClosed}
        width="1408" height="1126" alt="" aria-hidden="true" draggable="false" />
    </span>
  );
}
