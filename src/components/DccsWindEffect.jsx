import React from "react";

// Wind paths adapted from the user's soft_wind_effect.html reference.
const PATHS = [
  ["M-120 160 C20 105 120 210 255 156 S450 120 570 155", "M-90 184 C60 150 120 226 290 186 S480 160 560 181"],
  ["M-150 278 C-20 240 90 316 240 275 S450 239 580 274", "M-90 302 C60 270 165 344 330 298"],
  ["M-200 410 C-30 366 105 455 260 405 S470 376 600 412", "M-120 432 C20 410 140 480 300 432"],
  ["M-170 220 C-20 185 110 248 250 211 S450 177 550 215", "M-100 245 C30 215 130 270 275 240"],
  ["M-160 348 C0 315 120 385 255 340 S450 306 560 347", "M-100 366 C30 346 150 405 302 362"],
];

export default function DccsWindEffect() {
  return <div className="dccs-training-wind" data-testid="dccs-training-wind" aria-hidden="true">
    <svg viewBox="0 0 1000 600" preserveAspectRatio="none">
      {PATHS.map(([main, thin], index) => <g className="dccs-training-gust" key={main} style={{ animationDelay: `${-index * 1.1}s` }}>
        <path d={main} /><path className="thin" d={thin} />
      </g>)}
    </svg>
  </div>;
}
