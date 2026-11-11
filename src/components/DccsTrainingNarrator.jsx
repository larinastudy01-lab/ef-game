import React from "react";
import chicken from "../asset/chicken.webp";
import chickenClosed from "../asset/chicken01.webp";

export default function DccsTrainingNarrator({ speaking = false, cue }) {
  return <span className="dccs-training-narrator" role="img" aria-label="小雞說明規則"
    data-testid="dccs-training-narrator" data-speaking={speaking} data-cue={cue}>
    <img className="dccs-training-narrator-frame dccs-training-narrator-open" src={chicken}
      width="1408" height="1126" alt="" aria-hidden="true" draggable={false} />
    <img className="dccs-training-narrator-frame dccs-training-narrator-closed" src={chickenClosed}
      width="1408" height="1126" alt="" aria-hidden="true" draggable={false} />
  </span>;
}
