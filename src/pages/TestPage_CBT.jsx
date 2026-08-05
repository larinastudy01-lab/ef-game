import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import stoneImg from "../asset/CBT/stone.webp";
import stoneShinyImg from "../asset/CBT/stone_shiny.webp";
import personImg from "../asset/CBT/CBT_person.webp";
import bgImg from "../asset/CBT/CBT_background.webp";
import storyVideo from "../asset/mp4/CBT_start.mp4";
import tutorialVideo from "../asset/mp4/CBT_step.mp4";
import endingVideo from "../asset/mp4/CBT_end.mp4";
import clickSoundFile from "../asset/Click.mp3";
import startAvatar from "../asset/avatar/deer.webp";
import homeStartBtn from "../asset/home/start.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import "../styles/GamePage_CBT.css";

import { saveUnifiedResult } from "../utils/resultManager";
import { calculateCBTScore } from "../utils/cbtScoring";
import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { detectCBTErrorPattern } from "../ai/cbtTrainingAnalyzer";

// 仍保留內部作答時間上限，但不在幼兒畫面顯示壓力式倒數。
const ANSWER_TIME = 10;
const SHOW_SPEED = 720;
const GAP_SPEED = 260;
const TOTAL_QUESTIONS = 10;
const START_MEMORY_LENGTH = 2;
const MAX_MEMORY_LENGTH = 6;
const TRIALS_PER_MEMORY_LENGTH = 2;
const MAX_CONSECUTIVE_TIMEOUTS = 2;
const IDLE_HINT_DELAY_MS = 6000;
const TEST_PAGE_ROUTE = "/test-map";

// 正式測驗棋盤尺寸。石頭座標會用這個範圍即時計算，
// 所以每一題都會真的「換位置」，不再固定成同一種排列。
const BOARD_WIDTH = 760;
const BOARD_HEIGHT = 455;
const STONE_SIZE = 190;
const PERSON_OFFSET_Y = 76;
const WALK_ANIMATION_MS = 260;

const RANDOM_LAYOUT_CONFIG = {
  5: { minDistance: 185, marginX: 115, marginY: 95 },
  6: { minDistance: 165, marginX: 105, marginY: 88 },
  8: { minDistance: 150, marginX: 105, marginY: 88 },
};

function getDistance(a, b) {
  return Math.hypot(a.left - b.left, a.top - b.top);
}

function createRandomLayout(blockCount) {
  const config = RANDOM_LAYOUT_CONFIG[blockCount] || RANDOM_LAYOUT_CONFIG[5];
  const positions = [];
  let attempts = 0;

  while (positions.length < blockCount && attempts < 1200) {
    attempts += 1;

    const candidate = {
      left:
        config.marginX +
        Math.random() * (BOARD_WIDTH - config.marginX * 2),
      top:
        config.marginY +
        Math.random() * (BOARD_HEIGHT - config.marginY * 2),
    };

    const isTooClose = positions.some(
      (position) => getDistance(position, candidate) < config.minDistance
    );

    if (!isTooClose) {
      positions.push(candidate);
    }
  }

  // 保底：如果隨機嘗試因為距離限制沒有排滿，就用大範圍備用點補齊。
  if (positions.length < blockCount) {
    const fallback = shuffleArray([
      { top: 92, left: 140 },
      { top: 92, left: 380 },
      { top: 92, left: 620 },
      { top: 240, left: 230 },
      { top: 240, left: 530 },
      { top: 365, left: 145 },
      { top: 365, left: 380 },
      { top: 365, left: 615 },
    ]);

    fallback.forEach((position) => {
      if (positions.length < blockCount) positions.push(position);
    });
  }

  return positions;
}

const COUNTDOWN_SECONDS = 5;

function shuffleArray(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function createRandomizedBlocks(blockCount) {
  return createRandomLayout(blockCount).map((position, index) => ({
    ...position,
    stoneId: index,
  }));
}

function createSequence(questionIndex, previousLastStone = null, forcedMemoryLength = null) {
  const setting = getQuestionSetting(questionIndex, forcedMemoryLength);
  const seq = [];

  for (let i = 0; i < setting.level; i += 1) {
    const previousStone = i > 0 ? seq[i - 1] : previousLastStone;
    const candidates = Array.from(
      { length: setting.blockCount },
      (_, stoneIndex) => stoneIndex
    ).filter((stoneIndex) => stoneIndex !== previousStone);

    const next = candidates[Math.floor(Math.random() * candidates.length)];
    seq.push(next);
  }

  return seq;
}


function getBlockCountByMemoryLength(memoryLength) {
  if (memoryLength <= 4) return 5;
  if (memoryLength <= 5) return 6;
  return 8;
}

function getQuestionSetting(index, forcedMemoryLength = null) {
  if (Number.isFinite(Number(forcedMemoryLength))) {
    const level = Math.max(START_MEMORY_LENGTH, Number(forcedMemoryLength));
    return { level, blockCount: getBlockCountByMemoryLength(level) };
  }

  if (index < 2) return { level: 2, blockCount: 5 };
  if (index < 4) return { level: 3, blockCount: 5 };
  if (index < 6) return { level: 4, blockCount: 5 };
  if (index < 8) return { level: 5, blockCount: 6 };
  return { level: 6, blockCount: 8 };
}


const cbtSrtLikeCss = `
.cbt-page {
  min-height: 100dvh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-image: var(--cbt-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(10px, 1.5vw, 20px);
  box-sizing: border-box;
  font-family: 'jf-openhuninn', 'Fredoka', 'Nunito', 'Microsoft JhengHei', sans-serif;
}

.cbt-start-shell,
.cbt-guide-shell,
.cbt-result-shell {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%);
  border: 5px solid #ffb21e;
  outline: 3px solid rgba(255, 132, 38, 0.92);
  outline-offset: -12px;
  border-radius: 58px;
  box-sizing: border-box;
  box-shadow: 0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
}

.cbt-start-shell {
  width: min(78vw, 820px);
  min-height: min(68vh, 610px);
  padding: clamp(30px, 4.6vw, 54px) clamp(34px, 5vw, 62px);
  gap: clamp(24px, 3.8vw, 42px);
}

.cbt-start-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: min(82%, 560px);
  padding: 14px 44px 18px;
  margin: 0;
  border-radius: 24px;
  border: 4px solid #f2ad35;
  outline: 2px solid rgba(255, 235, 160, 0.9);
  outline-offset: -10px;
  background: linear-gradient(180deg, #fff2ab 0%, #ffd764 100%);
  color: #744018;
  font-size: clamp(42px, 4.6vw, 62px);
  font-weight: 900;
  line-height: 1.08;
  text-align: center;
  letter-spacing: 0.04em;
  text-shadow: 0 3px 0 rgba(255,255,255,0.78);
  box-shadow: 0 8px 0 rgba(178, 103, 21, 0.18), inset 0 -4px 0 rgba(177, 116, 20, 0.12);
}

.cbt-start-content,
.cbt-result-content {
  width: min(760px, 86%);
  display: grid;
  grid-template-columns: 1fr 150px;
  align-items: center;
  gap: 34px;
  margin-bottom: 38px;
}

.cbt-dialog-bubble {
  padding: 22px 32px;
  border: 4px solid #ffb43d;
  border-radius: 28px;
  background: rgba(255, 255, 250, 0.9);
  color: #784014;
  font-size: clamp(27px, 3.2vw, 40px);
  font-weight: 900;
  line-height: 1.42;
  text-align: center;
  box-shadow: inset 0 0 0 2px rgba(245, 204, 132, 0.38), 0 6px 0 rgba(241, 167, 53, 0.28);
  position: relative;
}

.cbt-dialog-bubble::after {
  content: "";
  position: absolute;
  inset: 10px;
  border: 2px dashed rgba(238, 190, 111, 0.55);
  border-radius: 18px;
  pointer-events: none;
}

.cbt-round-avatar {
  width: 148px;
  height: 148px;
  border-radius: 50%;
  padding: 9px;
  border: 7px solid #69c6e8;
  background: radial-gradient(circle, #fff1bb 0%, #f6d78c 100%);
  box-shadow: 0 10px 0 rgba(90, 112, 92, 0.2), 0 10px 22px rgba(73, 54, 20, 0.2);
  display: grid;
  place-items: center;
}

.cbt-round-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.cbt-video-only-card {
  width: min(92vw, 900px);
  min-height: 610px;
  padding: 30px 28px 24px;
  border-radius: 36px;
  background: rgba(255, 252, 242, 0.94);
  box-shadow: 0 14px 30px rgba(51, 39, 20, 0.14);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.cbt-video-only-card .cbt-video-wrapper {
  width: min(78vw, 720px);
  margin: 0 auto 24px;
}

.cbt-video-only-card .cbt-video {
  width: 100%;
  max-height: 390px;
  object-fit: cover;
  border-radius: 22px;
  border: 3px solid rgba(40, 28, 18, 0.9);
  box-shadow: 0 12px 18px rgba(54, 38, 16, 0.16);
}

.cbt-guide-shell {
  min-height: 455px;
  justify-content: flex-start;
  gap: 14px;
}

.cbt-guide-pill {
  padding: 7px 20px;
  border-radius: 999px;
  border: 1px solid #f2b548;
  background: #fff1a5;
  color: #93551a;
  font-size: 18px;
  font-weight: 900;
}

.cbt-guide-title {
  margin: 0;
  color: #7a3f14;
  font-size: clamp(38px, 4.6vw, 58px);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: 0.04em;
}

.cbt-guide-flow {
  width: min(900px, 94%);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin-top: 2px;
}

.cbt-guide-card {
  min-height: 150px;
  padding: 18px 22px 22px;
  border-radius: 22px;
  background: rgba(255, 255, 250, 0.86);
  box-shadow: inset 0 0 0 1px rgba(255, 190, 73, 0.28);
}

.cbt-guide-card-title {
  margin-bottom: 12px;
  color: #7b4117;
  font-size: clamp(20px, 2vw, 26px);
  font-weight: 900;
  text-align: center;
}

.cbt-guide-items {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(12px, 2vw, 26px);
}

.cbt-guide-item {
  width: clamp(74px, 8vw, 96px);
  height: clamp(74px, 8vw, 96px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 4px solid rgba(169, 153, 132, 0.2);
  position: relative;
}

.cbt-guide-item img {
  width: 76%;
  height: 76%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.cbt-guide-item.is-memory {
  border-color: rgba(255, 203, 71, 0.92);
  box-shadow: 0 0 0 8px rgba(255, 217, 103, 0.22), 0 0 20px rgba(255, 193, 40, 0.42);
}

.cbt-guide-item.is-pick {
  border-color: #6caf5a;
  background: #ecffe5;
  box-shadow: 0 0 0 7px rgba(110, 175, 90, 0.18);
}

.cbt-guide-fake {
  width: 64%;
  height: 64%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #c98ef6, #7a57d7 58%, #5736af);
  box-shadow: inset 0 0 0 8px rgba(255,255,255,0.24);
}

.cbt-guide-arrow {
  color: #8b531d;
  font-size: clamp(42px, 4vw, 58px);
  font-weight: 900;
}

.cbt-guide-note {
  color: #7b4117;
  font-size: clamp(20px, 2vw, 26px);
  font-weight: 900;
  text-align: center;
  margin: 0 0 4px;
}

.cbt-forest-button {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 0;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
}

.cbt-forest-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.cbt-forest-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.035);
  filter: brightness(1.04);
}

.cbt-forest-button:active:not(:disabled) { transform: translateY(1px) scale(0.98); }
.cbt-forest-button:disabled { opacity: 0.46; cursor: default; filter: grayscale(0.25); }
.cbt-btn-start { width: clamp(170px, 18vw, 236px); }
.cbt-btn-skip { width: clamp(170px, 18vw, 232px); }
.cbt-btn-home, .cbt-btn-detail { width: clamp(180px, 18vw, 238px); }

.cbt-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.cbt-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 30;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: cbt-mouse-tap 1.15s ease-in-out infinite;
}

.cbt-mouse-on-button { right: -14px; bottom: -18px; transform-origin: 18% 18%; }
.cbt-mouse-on-guide-stone { right: -20px; bottom: -22px; transform-origin: 18% 18%; }

@keyframes cbt-mouse-tap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.93; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.cbt-result-shell {
  /* 對齊 TestPage_PM.jsx 的最終結果卡片：中型置中，不鋪滿全畫面 */
  width: min(82vw, 920px);
  min-height: 0;
  padding: clamp(34px, 4vw, 58px) clamp(30px, 5vw, 64px);
  border: 5px solid #ffb21e;
  outline: 3px solid rgba(255, 132, 38, 0.92);
  outline-offset: -12px;
  border-radius: 58px;
  background: linear-gradient(180deg, rgba(255, 252, 224, 0.97), rgba(255, 239, 166, 0.97));
  box-shadow: 0 18px 0 rgba(114, 108, 68, 0.22), 0 24px 34px rgba(60, 45, 12, 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(22px, 3vw, 34px);
  position: relative;
  overflow: visible;
  margin-top: 0;
  box-sizing: border-box;
}

/* 星星改成 PM 的大顆弧形排列 */
.cbt-cute-stars {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(22px, 2.8vw, 36px);
  height: clamp(138px, 12vw, 176px);
  margin-top: calc(clamp(96px, 9vw, 130px) * -1);
  margin-bottom: -18px;
  filter: drop-shadow(0 8px 0 rgba(63, 76, 111, 0.14));
  pointer-events: none;
}

.cbt-cute-star-shell {
  width: clamp(108px, 9.8vw, 148px);
  height: clamp(102px, 9.2vw, 140px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform-origin: 50% 80%;
}

.cbt-cute-star-shell:nth-child(1) { transform: translateY(14px) rotate(-14deg); }
.cbt-cute-star-shell:nth-child(2) { transform: translateY(-26px) scale(1.08); }
.cbt-cute-star-shell:nth-child(3) { transform: translateY(14px) rotate(14deg); }

.cbt-cute-star-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cbt-cute-star-path.is-on {
  fill: #ffd735;
  stroke: #fff9d6;
  stroke-width: 6;
  filter: drop-shadow(0 4px 0 rgba(230, 160, 0, 0.34));
}

.cbt-cute-star-path.is-off {
  fill: rgba(255, 251, 208, 0.68);
  stroke: #ffffff;
  stroke-width: 5;
}

.cbt-star-highlight { fill: rgba(255, 255, 153, 0.72); }
.cbt-star-shadow { fill: rgba(236, 155, 0, 0.52); }

.cbt-result-content {
  width: min(100%, 760px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 172px;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 4vw, 54px);
  margin: 0;
}

.cbt-result-content .cbt-dialog-bubble {
  min-height: 132px;
  border: 4px solid #ffb545;
  outline: 3px dashed rgba(238, 178, 76, 0.38);
  outline-offset: -15px;
  border-radius: 34px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96));
  color: #744018;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 34px;
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.28;
  font-weight: 900;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3);
}

.cbt-result-content .cbt-dialog-bubble::after { display: none; }

.cbt-result-content .cbt-round-avatar {
  width: 172px;
  height: 172px;
  border-radius: 999px;
  background: linear-gradient(180deg, #7fdcff 0%, #43aee5 100%);
  border: 4px solid #f7d35a;
  outline: 3px dashed rgba(255,255,255,0.72);
  outline-offset: -12px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px;
  box-shadow: 0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18);
}

.cbt-result-content .cbt-round-avatar img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 999px;
  display: block;
  pointer-events: none;
}

.cbt-result-actions {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(14px, 2vw, 22px);
  flex-wrap: wrap;
}

.cbt-result-actions .cbt-btn-home,
.cbt-result-actions .cbt-btn-detail {
  width: clamp(168px, 16vw, 232px);
}



/* 正式測驗卡片調淡，讓石頭更清楚。 */
.cbt-test-card {
  background: rgba(255, 253, 241, 0.68) !important;
  box-shadow: 0 14px 26px rgba(45, 33, 12, 0.12) !important;
  backdrop-filter: blur(0.6px);
}

.cbt-test-card .cbt-board {
  background: rgba(255, 253, 241, 0.10) !important;
}

.cbt-page,
.cbt-board,
.cbt-block,
.cbt-btn-home,
.cbt-btn-detail,
.cbt-btn-start,
.cbt-btn-skip {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.cbt-old-guide-card {
  width: min(92vw, 900px);
  min-height: 610px;
  padding: 30px 28px 34px;
  border-radius: 36px;
  background: rgba(255, 252, 242, 0.86);
  box-shadow: 0 14px 30px rgba(51, 39, 20, 0.14);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.cbt-old-guide-title {
  margin: 8px 0 6px;
  color: #754217;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 950;
  line-height: 1.2;
  text-align: center;
}

.cbt-old-guide-subtitle {
  margin: 0 0 12px;
  color: #754217;
  font-size: clamp(18px, 2.2vw, 22px);
  font-weight: 900;
  text-align: center;
}

.cbt-guide-board-old {
  width: min(78vw, 650px);
  height: 330px;
  position: relative;
  margin: 8px auto 10px;
}

.cbt-guide-stone-old {
  position: absolute;
  width: 112px;
  height: 112px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.cbt-guide-stone-old img {
  width: 100%;
  height: auto;
  aspect-ratio: 360 / 203;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.cbt-guide-stone-old.is-lit img {
  filter: brightness(1.24) drop-shadow(0 0 18px rgba(255, 202, 65, 0.9)) drop-shadow(0 0 28px rgba(255, 202, 65, 0.58));
}

.cbt-guide-stone-old.is-picked img {
  filter: drop-shadow(0 0 15px rgba(105, 180, 86, 0.88));
}

.cbt-guide-stone-old:disabled {
  cursor: default;
}

.cbt-guide-person-old {
  position: absolute;
  width: 82px;
  height: auto;
  object-fit: contain;
  transform: translate(-50%, -45%);
  filter: drop-shadow(0 8px 8px rgba(64, 44, 17, 0.22));
  pointer-events: none;
}

.cbt-guide-mouse-stone-old {
  right: -8px;
  bottom: -2px;
}

.cbt-guide-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 16px;
}

.cbt-guide-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 203, 82, 0.36);
}

.cbt-guide-dot.is-active {
  width: 18px;
  background: #ffc64d;
}

.cbt-old-guide-action-row {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}



/* 起始與結果內部內容也對齊 PM：對話框 + 圓形角色框同尺寸 */
.cbt-start-content,
.cbt-result-content {
  width: min(100%, 760px) !important;
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 172px !important;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 4vw, 54px) !important;
  margin: 0 !important;
}

.cbt-start-content .cbt-dialog-bubble,
.cbt-result-content .cbt-dialog-bubble {
  min-height: 132px;
  border: 4px solid #ffb545;
  outline: 3px dashed rgba(238, 178, 76, 0.38);
  outline-offset: -15px;
  border-radius: 34px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96));
  color: #744018;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 34px;
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.28;
  font-weight: 900;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3);
}

.cbt-start-content .cbt-dialog-bubble::after,
.cbt-result-content .cbt-dialog-bubble::after {
  display: none;
}

.cbt-start-content .cbt-round-avatar,
.cbt-result-content .cbt-round-avatar {
  width: 172px;
  height: 172px;
  border-radius: 999px;
  background: linear-gradient(180deg, #7fdcff 0%, #43aee5 100%);
  border: 4px solid #f7d35a;
  outline: 3px dashed rgba(255,255,255,0.72);
  outline-offset: -12px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px;
  box-shadow: 0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18);
}

.cbt-start-content .cbt-round-avatar img,
.cbt-result-content .cbt-round-avatar img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 999px;
  display: block;
  pointer-events: none;
}

/* 對齊 TestPage_PM.jsx：所有 CBT 卡片統一用 PM 的暖黃厚卡、橘色描邊與置中尺寸 */
.cbt-card,
.cbt-old-guide-card,
.cbt-video-only-card {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%) !important;
  border: 5px solid #ffb21e !important;
  outline: 3px solid rgba(255, 132, 38, 0.86) !important;
  outline-offset: -12px !important;
  border-radius: 54px !important;
  box-shadow: 0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18) !important;
  box-sizing: border-box;
  text-align: center;
}

.cbt-card {
  width: min(92vw, 1080px) !important;
  max-height: calc(100dvh - 26px);
  overflow: hidden;
  padding: clamp(16px, 2.1vw, 28px) clamp(18px, 2.4vw, 34px) !important;
}

.cbt-card--small {
  width: min(88vw, 760px) !important;
  max-height: calc(100dvh - 28px);
  padding: clamp(28px, 4vw, 44px) !important;
}

.cbt-card--wide {
  width: min(92vw, 1080px) !important;
}

.cbt-test-card {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%) !important;
  backdrop-filter: none !important;
}

.cbt-subtitle,
.cbt-title,
.cbt-old-guide-title {
  color: #744018 !important;
  text-shadow: 0 3px 0 rgba(255,255,255,0.78);
  letter-spacing: 0.02em;
}

.cbt-subtitle {
  font-size: clamp(28px, 3.7vw, 46px) !important;
  font-weight: 900 !important;
  margin: 0 0 12px !important;
  line-height: 1.15;
}

.cbt-title {
  font-size: clamp(34px, 4.2vw, 54px) !important;
}

.cbt-text,
.cbt-old-guide-subtitle {
  color: #5d3f22 !important;
  font-weight: 800 !important;
}

.cbt-board {
  background: rgba(255,255,255,0.36) !important;
  border: 2px solid rgba(243, 181, 75, 0.32);
  border-radius: 34px;
  box-shadow: inset 0 0 0 4px rgba(255,255,255,0.16), 0 10px 20px rgba(77, 53, 30, 0.08);
}

.cbt-video-only-card {
  width: min(92vw, 1120px) !important;
  min-height: min(86vh, 790px) !important;
  padding: clamp(22px, 3vw, 34px) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 2vw, 22px);
}

.cbt-video-only-card .cbt-video-wrapper {
  width: 100% !important;
  height: min(69vh, 635px);
  min-height: 430px;
  margin: 0;
  border-radius: 34px;
  background: linear-gradient(180deg, #36b3ff, #2f82df);
  border: 4px solid rgba(255,255,255,0.85);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 4px rgba(41, 113, 206, 0.18), 0 14px 28px rgba(77, 53, 30, 0.16);
}

.cbt-video-only-card .cbt-video {
  width: 100%;
  height: 100%;
  max-height: none;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.cbt-old-guide-card {
  width: min(92vw, 900px) !important;
  min-height: 0 !important;
  max-height: calc(100dvh - 28px);
  padding: clamp(16px, 2vw, 28px) !important;
  overflow: hidden;
}

/* CBT 影片統一採 SRT 式橫向 16:9 呈現。 */
.cbt-video-only-card {
  width: min(94vw, 980px) !important;
  min-height: 0 !important;
  padding: clamp(22px, 3vw, 34px) !important;
  gap: clamp(14px, 2vw, 22px);
}

.cbt-video-only-card .cbt-video-wrapper {
  width: min(86vw, 860px) !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 16 / 9;
  margin: 0;
  border-radius: 28px;
}

.cbt-video-only-card .cbt-video {
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

/* 正式測驗直接使用湖水背景：石頭與棋盤皆不再附加底色或外框。 */
.cbt-test-card {
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

/* 湖水背景上的標題改用高對比淺色，避免與水面顏色混在一起。 */
.cbt-test-card .cbt-subtitle {
  color: #fff4c7 !important;
  text-shadow:
    0 3px 0 rgba(18, 76, 91, 0.95),
    0 0 10px rgba(8, 54, 70, 0.72);
}

.cbt-test-card .cbt-text {
  color: #ffffff !important;
  text-shadow:
    0 2px 0 rgba(18, 76, 91, 0.95),
    0 0 8px rgba(8, 54, 70, 0.76);
}

.cbt-test-card .cbt-board,
.cbt-board {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.cbt-block {
  appearance: none;
  -webkit-appearance: none;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

@media (max-width: 768px) {
  .cbt-start-shell, .cbt-guide-shell, .cbt-result-shell {
    width: min(92vw, 620px);
    min-height: 0;
    padding: 28px 18px;
    border-radius: 34px;
    outline-offset: -12px;
  }
  .cbt-start-title { min-width: 0; width: min(90%, 430px); padding: 12px 20px; margin-bottom: 24px; font-size: clamp(34px, 8vw, 48px); }
  .cbt-start-content, .cbt-result-content { grid-template-columns: 1fr; gap: 18px; justify-items: center; margin-bottom: 24px; }
  .cbt-dialog-bubble { font-size: clamp(24px, 6vw, 32px); padding: 18px 22px; }
  .cbt-round-avatar { width: 116px; height: 116px; }
  .cbt-guide-flow { grid-template-columns: 1fr; gap: 10px; }
  .cbt-guide-arrow { transform: rotate(90deg); }
  .cbt-video-only-card { min-height: 0; padding: 20px 14px; }
  .cbt-video-only-card .cbt-video-wrapper { width: 100% !important; min-height: 250px; height: min(54vh, 430px); }
  .cbt-btn-home, .cbt-btn-detail, .cbt-btn-start, .cbt-btn-skip { width: clamp(142px, 38vw, 196px); }
  .cbt-result-shell { width: min(92vw, 620px); border-radius: 34px; padding: 44px 18px 28px; }
  .cbt-cute-stars { height: 112px; margin-top: -76px; margin-bottom: -10px; gap: 8px; }
  .cbt-cute-star-shell { width: 88px; height: 84px; }
  .cbt-result-content { width: min(100%, 500px); }
}
`;

const DEFAULT_ERRORS = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
};

function safeAnalyzeErrors(errorTypes) {
  try {
    return analyzeErrors(errorTypes);
  } catch (error) {
    console.warn("[TestPage_CBT] analyzeErrors failed:", error);
    const totalErrors = Object.values(errorTypes).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );

    return {
      totalErrors,
      warningLevel: totalErrors >= 10 ? "red" : totalErrors >= 5 ? "orange" : "green",
    };
  }
}

function safeCreateGameResult(payload) {
  try {
    return createGameResult(payload);
  } catch (error) {
    console.warn("[TestPage_CBT] createGameResult failed:", error);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  }
}

function safeParseStorageObject(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function getCurrentChildId() {
  const currentChildId = localStorage.getItem("currentChildId");
  if (currentChildId) return currentChildId;

  const currentChild = safeParseStorageObject("currentChild");
  if (currentChild?.childId || currentChild?.id) return currentChild.childId || currentChild.id;

  const selectedChild = safeParseStorageObject("selectedChild");
  if (selectedChild?.childId || selectedChild?.id) return selectedChild.childId || selectedChild.id;

  return "guest-child";
}

export default function TestPage_CBT() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("story");
  const [countdownLeft, setCountdownLeft] = useState(COUNTDOWN_SECONDS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sequence, setSequence] = useState([]);
  const [, setUserInput] = useState([]);

  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME);

  const [showStep, setShowStep] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [wrongIndex, setWrongIndex] = useState(null);

  const [personIndex, setPersonIndex] = useState(null);
  const [isWalking, setIsWalking] = useState(false);
  const [message, setMessage] = useState("");
  const [idleHintActive, setIdleHintActive] = useState(false);

  const [boardPositions, setBoardPositions] = useState(() => createRandomizedBlocks(5));
  const [finalResult, setFinalResult] = useState(null);

  const clickAudioRef = useRef(null);
  const historyRef = useRef([]);
  const answerStartRef = useRef(null);
  const questionStartRef = useRef(null);
  const currentRandomClicksRef = useRef(0);
  const currentRepeatedClicksRef = useRef(0);
  const endedRef = useRef(false);
  const lastShownStoneRef = useRef(null);
  const pendingFinalHistoryRef = useRef(null);
  const resultSavedRef = useRef(false);
  const sequenceTimerRef = useRef(new Set());
  const userInputRef = useRef([]);
  const accumulatedWalkingTimeRef = useRef(0);
  const isClickResolvingRef = useRef(false);
  const currentMemoryLengthRef = useRef(START_MEMORY_LENGTH);
  const currentLengthTrialCountRef = useRef(0);
  const currentLengthWrongCountRef = useRef(0);
  const consecutiveTimeoutRef = useRef(0);
  const maxPassedMemoryLengthRef = useRef(0);
  const stopReasonRef = useRef(null);
  const firstTapAtRef = useRef(null);
  const tapTimestampsRef = useRef([]);
  const idleHintShownRef = useRef(false);
  const idleHintCountRef = useRef(0);
  const idleBeforeFirstTapMsRef = useRef(null);

  const isWarmup =
    phase === "warmupShow" ||
    phase === "warmupAnswer" ||
    phase === "warmupFeedback";

  const currentSetting = useMemo(() => {
    if (isWarmup) return { level: 2, blockCount: 5 };
    return getQuestionSetting(questionIndex, currentMemoryLengthRef.current);
  }, [questionIndex, isWarmup]);

  const blocks = boardPositions;

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundFile);

    return () => {
      clickAudioRef.current = null;
    };
  }, []);

  function clearManagedTimeout(timerId) {
    if (!timerId) return;
    clearTimeout(timerId);
    sequenceTimerRef.current.delete(timerId);
  }

  function clearAllManagedTimers() {
    sequenceTimerRef.current.forEach((timerId) => clearTimeout(timerId));
    sequenceTimerRef.current.clear();
    isClickResolvingRef.current = false;
  }

  function setManagedTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      sequenceTimerRef.current.delete(timerId);
      callback();
    }, delay);

    sequenceTimerRef.current.add(timerId);
    return timerId;
  }

  useEffect(() => {
    return () => {
      clearAllManagedTimers();
    };
  }, []);

  function playClickSound() {
    if (!clickAudioRef.current) return;

    clickAudioRef.current.currentTime = 0;
    clickAudioRef.current.play().catch(() => {});
  }

  function readStoredResult(fallback = {}) {
    try {
      return JSON.parse(localStorage.getItem("cbtTestResult") || "{}");
    } catch (error) {
      console.warn("[TestPage_CBT] Failed to read stored result:", error);
      return fallback;
    }
  }

  function saveResultPayload({ resultPayload, scoring, childId }) {
    try {
      saveUnifiedResult({
        rawResult: resultPayload,
        gameId: "CBT",
        mode: "test",
        difficulty: scoring.summary?.finalMicroDifficultyKey || "normal2",
        route: "/test-cbt",
        visibleRoles: ["child", "parent", "clinician"],
        saveLegacy: true,
      });
    } catch (error) {
      console.warn("[TestPage_CBT] saveUnifiedResult failed:", error);
    }

    let serializedResult = "";
    try {
      serializedResult = JSON.stringify(resultPayload);
    } catch (error) {
      console.warn("[TestPage_CBT] Failed to serialize result:", error);
      return;
    }

    const storageKeys = [
      "cbtTestResult",
      "latestCBTTestResult",
      "ef_game_cbt_test_result",
      childId ? `cbtTestResult_${childId}` : null,
    ].filter(Boolean);

    storageKeys.forEach((key) => {
      try {
        localStorage.setItem(key, serializedResult);
      } catch (error) {
        console.warn(`[TestPage_CBT] Failed to save ${key}:`, error);
      }
    });
  }

  function resetTestData() {
    clearAllManagedTimers();
    historyRef.current = [];
    endedRef.current = false;
    userInputRef.current = [];
    accumulatedWalkingTimeRef.current = 0;
    currentMemoryLengthRef.current = START_MEMORY_LENGTH;
    currentLengthTrialCountRef.current = 0;
    currentLengthWrongCountRef.current = 0;
    consecutiveTimeoutRef.current = 0;
    maxPassedMemoryLengthRef.current = 0;
    stopReasonRef.current = null;
    firstTapAtRef.current = null;
    tapTimestampsRef.current = [];
    idleHintShownRef.current = false;
    idleHintCountRef.current = 0;
    idleBeforeFirstTapMsRef.current = null;

    setQuestionIndex(0);
    setSequence([]);
    setUserInput([]);
    setTimeLeft(ANSWER_TIME);
    setShowStep(0);
    setActiveIndex(null);
    setSelectedIndex(null);
    setWrongIndex(null);
    setPersonIndex(null);
    setIsWalking(false);
    setMessage("");
    setIdleHintActive(false);
    setCountdownLeft(COUNTDOWN_SECONDS);
    lastShownStoneRef.current = null;
    pendingFinalHistoryRef.current = null;
    resultSavedRef.current = false;
    setBoardPositions(createRandomizedBlocks(5));
    setFinalResult(null);
  }

  function startFormalTest() {
    resetTestData();
    setCountdownLeft(COUNTDOWN_SECONDS);
    setPhase("countdown");
  }

  function startQuestion(targetIndex) {
    clearAllManagedTimers();
    const setting = getQuestionSetting(targetIndex, currentMemoryLengthRef.current);
    const newSequence = createSequence(targetIndex, lastShownStoneRef.current, currentMemoryLengthRef.current);
    lastShownStoneRef.current = newSequence[newSequence.length - 1];
    setBoardPositions(createRandomizedBlocks(setting.blockCount));

    setQuestionIndex(targetIndex);
    setSequence(newSequence);
    userInputRef.current = [];
    accumulatedWalkingTimeRef.current = 0;
    isClickResolvingRef.current = false;
    setUserInput([]);
    setShowStep(0);
    setActiveIndex(null);
    setSelectedIndex(null);
    setWrongIndex(null);
    setPersonIndex(null);
    setIsWalking(false);
    setMessage("");
    setTimeLeft(ANSWER_TIME);
    currentRandomClicksRef.current = 0;
    currentRepeatedClicksRef.current = 0;
    firstTapAtRef.current = null;
    tapTimestampsRef.current = [];
    idleHintShownRef.current = false;
    idleHintCountRef.current = 0;
    idleBeforeFirstTapMsRef.current = null;
    setIdleHintActive(false);
    questionStartRef.current = Date.now();
    setPhase("show");
  }

  function getReactionTimeMs() {
    if (!answerStartRef.current) return null;

    const rawReactionTime = Date.now() - answerStartRef.current;
    const correctedReactionTime = rawReactionTime - accumulatedWalkingTimeRef.current;

    return Math.max(0, Math.round(correctedReactionTime));
  }

  function recordTrial({ correct, input, errorType }) {
    const reactionTime = getReactionTimeMs();
    const isTimeout = errorType === "timeout";
    const trialMemoryLength = currentMemoryLengthRef.current;
    const trialInLength = currentLengthTrialCountRef.current + 1;
    const firstTapTime = firstTapAtRef.current && answerStartRef.current
      ? Math.max(0, firstTapAtRef.current - answerStartRef.current)
      : null;
    const tapIntervals = tapTimestampsRef.current
      .slice(1)
      .map((time, index) => Math.max(0, time - tapTimestampsRef.current[index]));
    const averageTapInterval = tapIntervals.length > 0
      ? Math.round(tapIntervals.reduce((sum, value) => sum + value, 0) / tapIntervals.length)
      : null;
    const firstMismatchIndex = input.findIndex((value, index) => value !== sequence[index]);
    const firstErrorPosition = correct
      ? null
      : firstMismatchIndex >= 0
        ? firstMismatchIndex
        : input.length;
    const errorPattern = detectCBTErrorPattern({
      correct,
      isCorrect: correct,
      timeout: isTimeout,
      isTimeout,
      targetSequence: sequence,
      userSequence: input,
      sequenceLength: sequence.length,
      firstErrorPosition,
      errorType,
      idleHintShown: idleHintShownRef.current,
      cleanCorrect: correct && !idleHintShownRef.current && !isTimeout,
    });

    const trial = {
      trialIndex: questionIndex + 1,
      correct,
      isCorrect: correct,

      errorType,
      errorPattern,
      timeout: isTimeout,
      isTimeout,
      missed: isTimeout,
      randomClickCount: currentRandomClicksRef.current,
      repeatedClickCount: currentRepeatedClicksRef.current,

      level: currentSetting.level,
      length: sequence.length,
      sequenceLength: sequence.length,
      memoryLength: trialMemoryLength,
      memoryLengthTrialIndex: trialInLength,
      sameLengthWrongCountBefore: currentLengthWrongCountRef.current,
      consecutiveTimeoutCountBefore: consecutiveTimeoutRef.current,
      blockCount: currentSetting.blockCount,
      difficulty: "normal",
      difficultyKey: "normal",
      microDifficulty: `normal${Math.min(3, Math.max(1, trialMemoryLength - 2))}`,
      microDifficultyKey: `normal${Math.min(3, Math.max(1, trialMemoryLength - 2))}`,

      sequence,
      targetSequence: sequence,
      correctSequence: sequence,

      answer: input,
      userSequence: input,
      clickedSequence: input,

      reactionTime,
      answerTime: reactionTime,
      firstTapTime,
      averageTapInterval,
      firstErrorPosition,
      errorIndex: firstErrorPosition,
      idleHintShown: idleHintShownRef.current,
      idleHintCount: idleHintCountRef.current,
      idleBeforeFirstTapMs: idleBeforeFirstTapMsRef.current,
      cleanCorrect: correct && !idleHintShownRef.current && !isTimeout,
      rescueCorrect: false,
      rescueFailed: false,
      usedReplay: false,
      replayCount: 0,
      usedHint: false,
      remainingTime: timeLeft,
      totalTrialTime: questionStartRef.current ? Date.now() - questionStartRef.current : reactionTime,

      createdAt: new Date().toISOString(),
    };

    historyRef.current = [...historyRef.current, trial];

    return historyRef.current;
  }

  function buildCbtAiResult(finalHistory, correctCount, bestSpan) {
    const records = Array.isArray(finalHistory) ? finalHistory : [];
    const totalTrials = records.length || TOTAL_QUESTIONS;
    const reactionTimes = records
      .map((record) => record.reactionTime || record.answerTime)
      .filter((rt) => typeof rt === "number" && rt > 0);

    const errorTypes = {
      ...DEFAULT_ERRORS,
      miss: records.filter((record) => record.missed || record.timeout || record.isTimeout).length,
      randomClick: records.reduce(
        (sum, record) => sum + (Number(record.randomClickCount) || 0),
        0
      ),
      wrongTarget: 0,
      repeatedClick: records.reduce(
        (sum, record) => sum + (Number(record.repeatedClickCount) || 0),
        0
      ),
      timeout: records.filter((record) => record.timeout || record.isTimeout).length,
      sequenceError: records.filter(
        (record) => record.errorType === "sequenceError" || record.errorType === "sequence_error"
      ).length,
      ruleSwitchError: 0,
    };

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials: correctCount,
      reactionTimes,
      errorTypes,
      difficulty: "normal",
    });

    const errorResult = safeAnalyzeErrors(errorTypes);

    const middle = Math.ceil(records.length / 2);
    const firstHalfRecords = records.slice(0, middle);
    const secondHalfRecords = records.slice(middle);

    const getAverageRt = (items) => {
      const rts = items
        .map((record) => record.reactionTime || record.answerTime)
        .filter((rt) => typeof rt === "number" && rt > 0);

      if (rts.length === 0) return 0;
      return Math.round(rts.reduce((sum, rt) => sum + rt, 0) / rts.length);
    };

    const firstHalfMiss = firstHalfRecords.filter(
      (record) => record.missed || record.timeout || record.isTimeout
    ).length;
    const secondHalfMiss = secondHalfRecords.filter(
      (record) => record.missed || record.timeout || record.isTimeout
    ).length;

    const rawFatigueResult = analyzeFatigue({
      firstHalfRT: getAverageRt(firstHalfRecords),
      secondHalfRT: getAverageRt(secondHalfRecords),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });

    const fatigueResult =
      typeof rawFatigueResult === "string"
        ? { fatigueLevel: rawFatigueResult }
        : rawFatigueResult || { fatigueLevel: "low" };
    const fatigueLevel = fatigueResult.fatigueLevel || fatigueResult.level || "low";

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const gameResult = safeCreateGameResult({
      childId: getCurrentChildId(),
      gameId: "CBT",
      abilityType: "memory",
      mode: "test",
      difficulty: "normal",
      score: performanceResult.accuracy,
      stars: performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: Math.round(
        records.reduce((sum, record) => sum + (Number(record.totalTrialTime) || 0), 0) / 1000
      ),
      errorTypes,
      fatigueLevel,
      fatigueResult,
      attemptCount: totalTrials,
    });

    return {
      ...gameResult,
      ...performanceResult,
      ...errorResult,
      records,
      cbtHistory: records,
      history: records,
      correctCount,
      bestSpan,
      totalQuestions: TOTAL_QUESTIONS,
      errorTypes,
      fatigueLevel,
      fatigueResult,
      recommendedDifficulty,
      parentSummary: performanceResult.parentSummary,
      aiSummary: {
        recommendedDifficulty,
        reason:
          errorTypes.sequenceError > 0
            ? "本次石頭順序有錯誤，建議先縮短路線長度或增加暖身示範。"
            : errorTypes.miss > 0 || errorTypes.timeout > 0
            ? "本次有 miss 或等待過久的情形，建議延長作答時間並放大石頭間距。"
            : errorTypes.randomClick > 0 || errorTypes.repeatedClick > 0
            ? "本次出現亂點或重複點擊，建議降低刺激量並加強圖示提示。"
            : "本次表現穩定，可以維持目前難度或逐步增加石頭序列長度。",
      },
    };
  }

  function updateFormalProgress({ correct, isTimeout }) {
    currentLengthTrialCountRef.current += 1;

    if (correct) {
      maxPassedMemoryLengthRef.current = Math.max(
        maxPassedMemoryLengthRef.current,
        currentMemoryLengthRef.current
      );
    } else {
      currentLengthWrongCountRef.current += 1;
    }

    if (isTimeout) {
      consecutiveTimeoutRef.current += 1;
    } else {
      consecutiveTimeoutRef.current = 0;
    }

    if (consecutiveTimeoutRef.current >= MAX_CONSECUTIVE_TIMEOUTS) {
      stopReasonRef.current = "two_consecutive_timeouts";
      return { shouldFinish: true };
    }

    if (currentLengthTrialCountRef.current >= TRIALS_PER_MEMORY_LENGTH) {
      if (currentLengthWrongCountRef.current >= TRIALS_PER_MEMORY_LENGTH) {
        stopReasonRef.current = "two_failures_same_memory_length";
        return { shouldFinish: true };
      }

      if (currentMemoryLengthRef.current >= MAX_MEMORY_LENGTH) {
        stopReasonRef.current = "max_memory_length_reached";
        return { shouldFinish: true };
      }

      currentMemoryLengthRef.current += 1;
      currentLengthTrialCountRef.current = 0;
      currentLengthWrongCountRef.current = 0;
    }

    return { shouldFinish: false };
  }

  function completeTrial(finalHistory, { correct, isTimeout = false }) {
    const decision = updateFormalProgress({ correct, isTimeout });

    if (decision.shouldFinish) {
      setMessage("完成了！");
      setPhase("finish");
      setManagedTimeout(() => {
        prepareFinish(finalHistory);
      }, 700);
      return;
    }

    setMessage("下一題。");
    setPhase("next");

    setManagedTimeout(() => {
      startQuestion(questionIndex + 1);
    }, 900);
  }

  function prepareFinish(finalHistory = historyRef.current) {
    if (endedRef.current) return;

    clearAllManagedTimers();
    pendingFinalHistoryRef.current = finalHistory;
    endedRef.current = true;
    setPhase("endingVideo");
  }

  function finishTest(finalHistory = pendingFinalHistoryRef.current || historyRef.current) {
    if (resultSavedRef.current) return;
    resultSavedRef.current = true;

    const records = Array.isArray(finalHistory) ? finalHistory : [];
    let scoring = {};
    try {
      scoring = calculateCBTScore(records) || {};
    } catch (error) {
      console.warn("[TestPage_CBT] calculateCBTScore failed:", error);
      scoring = {
        taskName: "Corsi Block Tapping",
        totalScore: 0,
        stars: 1,
        summary: {
          totalTrials: records.length,
          correctCount: records.filter((item) => item.correct || item.isCorrect).length,
          accuracyRate: 0,
          accuracyPercent: 0,
        },
      };
    }

    const correctCount = records.filter((item) => item.correct || item.isCorrect).length;
    const bestSpan = scoring.summary?.rawSpan || records.reduce((max, item) => {
      if (!item.correct && !item.isCorrect) return max;
      return Math.max(max, item.length || item.sequenceLength || 0);
    }, 0);

    // 舊版 AI 欄位只保留相容用；正式分數、星級、家長端與醫療端說明
    // 一律以 cbtScoring.js 產生的 scoring 為準，避免結果頁與儲存資料不一致。
    const legacyAiResult = buildCbtAiResult(records, correctCount, bestSpan);
    const childId = getCurrentChildId();
    const generatedAt = new Date().toISOString();

    const resultPayload = {
      ...legacyAiResult,

      source: "test",
      mode: "test",
      resultType: "test",
      gameId: "CBT",
      taskCode: "CBT",
      taskName: scoring.taskName || "Corsi Block Tapping",
      childId,
      generatedAt,

      scoring,
      summary: scoring.summary,
      parentView: scoring.parentView,
      clinicalView: scoring.clinicalView,
      childView: scoring.childView,
      aiAnalysis: scoring.aiAnalysis,
      scoreBreakdown: scoring.scoreBreakdown,

      stars: scoring.stars,
      score: scoring.totalScore,
      totalScore: scoring.totalScore,
      accuracy: scoring.summary?.accuracyRate ?? scoring.summary?.accuracy ?? legacyAiResult.accuracy ?? 0,
      accuracyPercent: scoring.summary?.accuracyPercent ?? 0,
      correctCount: scoring.summary?.correctCount ?? correctCount,
      totalQuestions: records.length || TOTAL_QUESTIONS,
      totalTrials: scoring.summary?.totalTrials ?? records.length,

      recommendedDifficulty: scoring.recommendedDifficulty,
      recommendedAction: scoring.recommendedAction,
      recommendationReason: scoring.recommendationReason,
      mainWeakness: scoring.mainWeakness,

      records,
      history: records,
      cbtHistory: records,
      trials: records,

      bestSpan,
      maxPassedMemoryLength: maxPassedMemoryLengthRef.current,
      stopReason: stopReasonRef.current || "manual_finish",
      visibleResultRoles: ["child", "parent", "clinician"],
      hideMedicalResult: false,
    };

    saveResultPayload({ resultPayload, scoring, childId });

    setFinalResult(resultPayload);
    setPhase("result");
  }

  function openDetailedResult() {
    const resultPayload = finalResult || readStoredResult();
    navigate("/result-cbt", {
      state: resultPayload,
    });
  }


  function goNextQuestion(finalHistory, outcome = { correct: true, isTimeout: false }) {
    completeTrial(finalHistory, outcome);
  }


  function triggerPersonWalk(index, { countAsAnimationTime = false, onComplete } = {}) {
    setSelectedIndex(index);
    setPersonIndex(index);
    setIsWalking(true);
    isClickResolvingRef.current = true;

    setManagedTimeout(() => {
      setIsWalking(false);

      if (countAsAnimationTime) {
        accumulatedWalkingTimeRef.current += WALK_ANIMATION_MS;
      }

      isClickResolvingRef.current = false;

      if (typeof onComplete === "function") {
        onComplete();
      }
    }, WALK_ANIMATION_MS);
  }

  function handleWarmupClick(index) {
    if (phase !== "warmupAnswer") return;
    if (isClickResolvingRef.current) return;

    playClickSound();
    setIdleHintActive(false);

    if (userInputRef.current.length === 0 && !firstTapAtRef.current) {
      firstTapAtRef.current = Date.now();
      if (answerStartRef.current && idleBeforeFirstTapMsRef.current === null) {
        idleBeforeFirstTapMsRef.current = Math.max(0, firstTapAtRef.current - answerStartRef.current);
      }
    }
    tapTimestampsRef.current = [...tapTimestampsRef.current, Date.now()];

    const currentInput = userInputRef.current;
    const nextInput = [...currentInput, index];
    const nextInputLength = nextInput.length;
    const correctIndex = sequence[nextInputLength - 1];

    if (index !== correctIndex) {
      setWrongIndex(index);
      setMessage("再看一次。");

      triggerPersonWalk(index, {
        onComplete: () => {
          userInputRef.current = [];
          setUserInput([]);
          setSelectedIndex(null);
          setWrongIndex(null);
          setPersonIndex(null);
          setShowStep(0);
          setPhase("warmupShow");
        },
      });

      return;
    }

    triggerPersonWalk(index, {
      onComplete: () => {
        userInputRef.current = nextInput;
        setUserInput(nextInput);

        if (nextInputLength === sequence.length) {
          setMessage("做得好！");
          setPhase("warmupFeedback");
        }
      },
    });
  }

  function handleBlockClick(index) {
    if (phase !== "answer") return;
    if (endedRef.current) return;
    if (isClickResolvingRef.current) return;

    playClickSound();
    setIdleHintActive(false);

    if (userInputRef.current.length === 0 && !firstTapAtRef.current) {
      firstTapAtRef.current = Date.now();
      if (answerStartRef.current && idleBeforeFirstTapMsRef.current === null) {
        idleBeforeFirstTapMsRef.current = Math.max(0, firstTapAtRef.current - answerStartRef.current);
      }
    }
    tapTimestampsRef.current = [...tapTimestampsRef.current, Date.now()];

    const currentInput = userInputRef.current;
    const isRepeatedClick = currentInput.length > 0 && currentInput[currentInput.length - 1] === index;

    if (isRepeatedClick) {
      currentRepeatedClicksRef.current += 1;
    }

    const nextInput = [...currentInput, index];
    const nextInputLength = nextInput.length;
    const correctIndex = sequence[nextInputLength - 1];

    if (index !== correctIndex) {
      setWrongIndex(index);
      setMessage("走錯了。");

      triggerPersonWalk(index, {
        countAsAnimationTime: true,
        onComplete: () => {
          userInputRef.current = nextInput;
          setUserInput(nextInput);

          const finalHistory = recordTrial({
            correct: false,
            input: nextInput,
            errorType: isRepeatedClick ? "repeatedClick" : "sequenceError",
          });

          setManagedTimeout(() => {
            completeTrial(finalHistory, {
              correct: false,
              isTimeout: false,
            });
          }, 390);
        },
      });

      return;
    }

    triggerPersonWalk(index, {
      countAsAnimationTime: true,
      onComplete: () => {
        userInputRef.current = nextInput;
        setUserInput(nextInput);

        if (nextInputLength === sequence.length) {
          const finalHistory = recordTrial({
            correct: true,
            input: nextInput,
            errorType: null,
          });

          setManagedTimeout(() => {
            goNextQuestion(finalHistory, {
              correct: true,
              isTimeout: false,
            });
          }, 260);
        }
      },
    });
  }


  useEffect(() => {
    if (phase !== "show" && phase !== "warmupShow") return;
    if (sequence.length === 0) return;

    if (showStep >= sequence.length) {
      setActiveIndex(null);
      setSelectedIndex(null);
      setWrongIndex(null);
      setPersonIndex(null);
      userInputRef.current = [];
      setUserInput([]);

      if (phase === "warmupShow") {
        setPhase("warmupAnswer");
      } else {
        setTimeLeft(ANSWER_TIME);
        currentRandomClicksRef.current = 0;
        currentRepeatedClicksRef.current = 0;
        accumulatedWalkingTimeRef.current = 0;
        isClickResolvingRef.current = false;
        firstTapAtRef.current = null;
        tapTimestampsRef.current = [];
        idleHintShownRef.current = false;
        idleHintCountRef.current = 0;
        idleBeforeFirstTapMsRef.current = null;
        setIdleHintActive(false);
        answerStartRef.current = Date.now();
        setPhase("answer");
      }

      return;
    }

    const currentBlock = sequence[showStep];

    setActiveIndex(currentBlock);

    let gapTimer = null;
    const showTimer = setManagedTimeout(() => {
      setActiveIndex(null);

      gapTimer = setManagedTimeout(() => {
        setShowStep((prev) => prev + 1);
      }, GAP_SPEED);
    }, SHOW_SPEED);

    return () => {
      clearManagedTimeout(showTimer);
      clearManagedTimeout(gapTimer);
    };
  }, [phase, showStep, sequence]);

  useEffect(() => {
    if (phase !== "answer") {
      setIdleHintActive(false);
      return;
    }

    if (idleHintShownRef.current) return;

    const timer = setManagedTimeout(() => {
      if (phase !== "answer") return;
      if (endedRef.current || isClickResolvingRef.current) return;
      if (userInputRef.current.length > 0) return;

      idleHintShownRef.current = true;
      idleHintCountRef.current += 1;
      if (answerStartRef.current && idleBeforeFirstTapMsRef.current === null) {
        idleBeforeFirstTapMsRef.current = Math.max(0, Date.now() - answerStartRef.current);
      }
      setIdleHintActive(true);

      setManagedTimeout(() => {
        setIdleHintActive(false);
      }, 1100);
    }, IDLE_HINT_DELAY_MS);

    return () => clearManagedTimeout(timer);
  }, [phase, questionIndex]);

  useEffect(() => {
    if (phase !== "answer") return;
    if (endedRef.current) return;

    if (timeLeft <= 0) {
      const finalHistory = recordTrial({
        correct: false,
        input: userInputRef.current,
        errorType: "timeout",
      });

      setMessage("時間到了。");

      setManagedTimeout(() => {
        completeTrial(finalHistory, {
          correct: false,
          isTimeout: true,
        });
      }, 500);

      return;
    }

    const timer = setManagedTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearManagedTimeout(timer);
    // Timer callbacks use refs/current phase state; adding function deps resets the countdown loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownLeft <= 0) {
      startQuestion(0);
      return;
    }

    const timer = setManagedTimeout(() => {
      setCountdownLeft((prev) => prev - 1);
    }, 1000);

    return () => clearManagedTimeout(timer);
    // Countdown transition should only react to phase and countdownLeft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdownLeft]);

  return (
    <div
      className="cbt-page"
      style={{
        "--cbt-bg": `url(${bgImg})`,
      }}
    >
      <style>{cbtSrtLikeCss}</style>

      {phase === "story" && (
        <main className="cbt-start-shell game-start-card-artwork" aria-label="石頭路線記憶測驗開始畫面">
          <h1 className="cbt-start-title">石頭路線記憶</h1>

          <div className="cbt-start-content">
            <div className="cbt-dialog-bubble">幫小鹿記住石頭亮起的路線。</div>
            <div className="cbt-round-avatar">
              <img src={startAvatar} alt="引導遊戲的小鹿" width="1200" height="1200" decoding="async" draggable="false" />
            </div>
          </div>

          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始遊戲"
            ariaLabel="開始遊戲"
            onClick={() => setPhase("introVideo")}
            showMouse
            variant="start"
          />
        </main>
      )}

      {phase === "introVideo" && (
        <VideoOnlyPage
          videoSrc={storyVideo}
          onDone={() => setPhase("tutorialVideo")}
        />
      )}

      {phase === "tutorialVideo" && (
        <VideoOnlyPage
          videoSrc={tutorialVideo}
          onDone={startFormalTest}
        />
      )}

      {(phase === "warmupShow" || phase === "warmupAnswer") && (
        <div className="cbt-card cbt-card--wide">
          <div className="cbt-info">練習</div>

          <h2 className="cbt-subtitle">
            {phase === "warmupShow"
              ? "看亮燈"
              : "換你點"}
          </h2>

          <p className="cbt-text" style={{ fontSize: 20, marginBottom: 4 }}>
            {phase === "warmupShow"
              ? "先看，不用點。"
              : "照順序點。"}
          </p>

          <CBTBoard
            blocks={blocks}
            phase={phase}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            wrongIndex={wrongIndex}
            personIndex={personIndex}
            isWalking={isWalking}
            idleHintActive={false}
            onBlockClick={handleWarmupClick}
            disabled={phase !== "warmupAnswer"}
          />

          {phase === "warmupAnswer" && (
            <div className="cbt-hint-bubble">
              先亮，先點。
            </div>
          )}
        </div>
      )}

      {phase === "warmupFeedback" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">會了！</h1>

          <div className="cbt-result-message">{message}</div>

          <p className="cbt-text" style={{ marginTop: 18 }}>準備開始。</p>

          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始遊戲"
            ariaLabel="開始正式測驗"
            onClick={startFormalTest}
            showMouse
            variant="start"
          />
        </div>
      )}


      {phase === "countdown" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">準備</h1>
          <div
            className="cbt-result-message"
            style={{ fontSize: 72, lineHeight: 1, margin: "20px 0" }}
          >
            {countdownLeft}
          </div>
          <p className="cbt-text">看亮燈，照順序點。</p>
        </div>
      )}

      {(phase === "show" || phase === "answer") && (
        <div className="cbt-card cbt-card--wide cbt-test-card">

          <h2 className="cbt-subtitle">
            {phase === "show"
              ? "看亮燈"
              : "換你點"}
          </h2>

          <p className="cbt-text" style={{ fontSize: 20, marginBottom: 4 }}>
            {phase === "show"
              ? "先看，不用點。"
              : "照順序點。"}
          </p>

          <CBTBoard
            blocks={blocks}
            phase={phase}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            wrongIndex={wrongIndex}
            personIndex={personIndex}
            isWalking={isWalking}
            idleHintActive={idleHintActive}
            onBlockClick={handleBlockClick}
            onBoardClick={() => {
              currentRandomClicksRef.current += 1;
              setMessage("點亮過的石頭。");
            }}
            disabled={phase !== "answer" || endedRef.current}
          />
        </div>
      )}

      {phase === "next" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">對了！</h1>
          <div className="cbt-result-message">{message}</div>
        </div>
      )}

      {phase === "endingVideo" && (
        <VideoOnlyPage
          videoSrc={endingVideo}
          onDone={() => finishTest()}
        />
      )}

      {phase === "result" && (
        <main className="cbt-result-shell game-result-card-artwork" aria-label="測驗結果">
          <div className="cbt-cute-stars" aria-label={`${finalResult?.stars || 1} 顆星`}>
            {[1, 2, 3].map((star) => {
              const isOn = star <= (finalResult?.stars || 1);
              return (
                <span key={star} className="cbt-cute-star-shell">
                  <svg viewBox="0 0 100 95" className="cbt-cute-star-svg" aria-hidden="true">
                    <path
                      d="M50 5 L61 34 L92 35 L67 54 L76 86 L50 68 L24 86 L33 54 L8 35 L39 34 Z"
                      className={`cbt-cute-star-path ${isOn ? "is-on" : "is-off"}`}
                    />
                    {isOn && (
                      <>
                        <path d="M48 14 C53 14 55 26 53 34 C51 42 46 43 43 38 C40 32 42 15 48 14 Z" className="cbt-star-highlight" />
                        <path d="M72 43 C80 43 84 47 82 53 C80 60 70 61 66 56 C62 51 65 44 72 43 Z" className="cbt-star-shadow" />
                      </>
                    )}
                  </svg>
                </span>
              );
            })}
          </div>

          <div className="cbt-result-content">
            <div className="cbt-dialog-bubble">關卡完成！你很認真記住圖片喔。</div>
            <div className="cbt-round-avatar">
              <img src={startAvatar} alt="完成 CBT 測驗的小鹿" width="1200" height="1200" loading="lazy" decoding="async" draggable="false" />
            </div>
          </div>

          <div className="cbt-result-actions">
            <GuidedImageButton
              imgSrc={homeBackBtn}
              imgAlt="回到森林"
              ariaLabel="回到森林"
              onClick={() => navigate(TEST_PAGE_ROUTE)}
              showMouse
              variant="home"
            />
            <GuidedImageButton
              imgSrc={homeResultBtn}
              imgAlt="詳細結果"
              ariaLabel="詳細結果"
              onClick={openDetailedResult}
              variant="detail"
            />
          </div>
        </main>
      )}

      {phase === "finish" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">完成了</h1>
          <div className="cbt-result-message">整理結果...</div>
        </div>
      )}
    </div>
  );
}


function VideoOnlyPage({ videoSrc, onDone }) {
  return (
    <main className="cbt-video-only-card game-start-card-artwork" aria-label="影片">
      <div className="cbt-video-wrapper">
        <video
          src={videoSrc}
          autoPlay
          muted
          playsInline
          controls
          className="cbt-video"
          onEnded={onDone}
        />
      </div>

      <GuidedImageButton
        imgSrc={homeSkipBtn}
        imgAlt="跳過動畫"
        ariaLabel="跳過動畫"
        onClick={onDone}
        showMouse
        variant="skip"
      />
    </main>
  );
}

function GuidedImageButton({
  imgSrc,
  imgAlt,
  ariaLabel,
  onClick,
  disabled = false,
  showMouse = false,
  variant = "start",
}) {
  return (
    <div className={`cbt-guided-action cbt-guided-action--${variant}`}>
      <button
        type="button"
        className={`cbt-forest-button cbt-btn-${variant}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || imgAlt}
      >
        <img loading="lazy" src={imgSrc} alt={imgAlt} width="1600" height="533" decoding="async" draggable="false" />
      </button>
      {showMouse && !disabled && (
        <img
          className="cbt-mouse-guide cbt-mouse-on-button"
          src={mouseGuideImg}
          alt=""
          width="1200"
          height="1200"
          loading="lazy"
          decoding="async"
          aria-hidden="true"
          draggable="false"
        />
      )}
    </div>
  );
}

/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
function InteractiveGuide({ guideStep, setGuideStep, onReady, stoneImg, personImg }) {
  const guideStones = [
    { left: "24%", top: "42%" },
    { left: "50%", top: "34%" },
    { left: "76%", top: "42%" },
  ];
  const demoSequence = [0, 2];
  const mode = guideStep === 0 ? "demo" : guideStep === 1 ? "practice" : "ready";
  const [activeDemoIndex, setActiveDemoIndex] = useState(null);
  const [personIndex, setPersonIndex] = useState(null);
  const [demoDone, setDemoDone] = useState(false);
  const [practiceInput, setPracticeInput] = useState([]);
  const [practiceDone, setPracticeDone] = useState(false);
  const [guideMessage, setGuideMessage] = useState("記住亮燈的順序。");
  const guideTimerRef = useRef(new Set());

  function clearGuideTimers() {
    guideTimerRef.current.forEach((timerId) => clearTimeout(timerId));
    guideTimerRef.current.clear();
  }

  function setGuideTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      guideTimerRef.current.delete(timerId);
      callback();
    }, delay);

    guideTimerRef.current.add(timerId);
    return timerId;
  }

  function replayDemo() {
    clearGuideTimers();
    setDemoDone(false);
    setPersonIndex(null);
    setActiveDemoIndex(null);
    setGuideMessage("先看，不用點。");

    demoSequence.forEach((stoneIndex, order) => {
      setGuideTimeout(() => setActiveDemoIndex(stoneIndex), 480 + order * 900);
      setGuideTimeout(() => setPersonIndex(stoneIndex), 690 + order * 900);
      setGuideTimeout(() => setActiveDemoIndex(null), 1050 + order * 900);
    });

    setGuideTimeout(() => {
      setPersonIndex(null);
      setDemoDone(true);
      setGuideMessage("換你照順序點。");
    }, 2600);
  }

  useEffect(() => {
    clearGuideTimers();
    setPracticeInput([]);
    setPracticeDone(false);
    setGuideMessage(guideStep === 0 ? "記住亮燈的順序。" : guideStep === 1 ? "照剛剛順序點。" : "準備開始囉。");

    if (guideStep === 0) {
      replayDemo();
    }

    return clearGuideTimers;
  }, [guideStep]);

  function handlePracticeClick(index) {
    if (mode !== "practice" || practiceDone) return;

    const expected = demoSequence[practiceInput.length];
    if (index !== expected) {
      setGuideMessage("想一想，剛剛哪一顆先亮？");
      return;
    }

    const nextInput = [...practiceInput, index];
    setPracticeInput(nextInput);
    setPersonIndex(index);

    if (nextInput.length === demoSequence.length) {
      setPracticeDone(true);
      setGuideMessage("做得很好！可以開始遊戲。");
    } else {
      setGuideMessage("很好，再點下一顆。");
    }
  }

  const nextTarget = demoSequence[practiceInput.length];

  return (
    <main className="cbt-old-guide-card" aria-label="前導教學">
      <h1 className="cbt-old-guide-title">
        {mode === "demo" ? "看亮燈，照順序點" : mode === "practice" ? "換你" : "準備開始"}
      </h1>
      <p className="cbt-old-guide-subtitle">
        {mode === "demo" ? "記住亮燈" : mode === "practice" ? "照順序點" : "等一下正式測驗不會有提示"}
      </p>

      <div className="cbt-guide-board-old">
        {guideStones.map((stone, index) => {
          const isPicked = practiceInput.includes(index);
          const shouldShowMouse = mode === "practice" && !practiceDone && index === nextTarget;

          return (
            <button
              key={index}
              type="button"
              className={`cbt-guide-stone-old ${activeDemoIndex === index ? "is-lit" : ""} ${isPicked ? "is-picked" : ""}`}
              style={stone}
              disabled={mode !== "practice" || practiceDone}
              onClick={() => handlePracticeClick(index)}
              aria-label={`石頭 ${index + 1}`}
            >
              <img src={stoneImg} alt={`第 ${index + 1} 顆示範石頭`} width="360" height="203" loading="lazy" decoding="async" draggable="false" />
              {shouldShowMouse && (
                <img
                  className="cbt-mouse-guide cbt-guide-mouse-stone-old"
                  src={mouseGuideImg}
                  alt=""
                  width="1200"
                  height="1200"
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                  draggable="false"
                />
              )}
            </button>
          );
        })}

        {personIndex !== null && (
          <img
            className="cbt-guide-person-old"
            src={personImg}
            alt="沿著示範石頭前進的小朋友"
            width="156"
            height="126"
            loading="lazy"
            decoding="async"
            style={guideStones[personIndex]}
            draggable="false"
          />
        )}
      </div>

      <div className="cbt-guide-dots" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className={`cbt-guide-dot ${guideStep === dot ? "is-active" : ""}`} />
        ))}
      </div>

      <p className="cbt-old-guide-subtitle" style={{ minHeight: 30 }}>{guideMessage}</p>

      <div className="cbt-old-guide-action-row">
        {mode === "demo" && (
          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始遊戲"
            ariaLabel="繼續練習"
            disabled={!demoDone}
            onClick={() => setGuideStep(1)}
            showMouse={demoDone}
            variant="start"
          />
        )}

        {mode === "practice" && (
          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始遊戲"
            ariaLabel="繼續"
            disabled={!practiceDone}
            onClick={() => setGuideStep(2)}
            showMouse={practiceDone}
            variant="start"
          />
        )}

        {mode === "ready" && (
          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始遊戲"
            ariaLabel="開始正式測驗"
            onClick={onReady}
            showMouse
            variant="start"
          />
        )}
      </div>
    </main>
  );
}
/* eslint-enable no-unused-vars, react-hooks/exhaustive-deps */

function CBTBoard({
  blocks,
  phase,
  activeIndex,
  selectedIndex,
  wrongIndex,
  personIndex,
  isWalking,
  idleHintActive = false,
  onBlockClick,
  onBoardClick,
  disabled,
}) {
  return (
    <div
      className={["cbt-board", idleHintActive ? "is-idle-hint" : ""].filter(Boolean).join(" ")}
      style={{
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        marginTop: 4,
      }}
      onClick={(event) => {
        if (disabled) return;
        if (event.target === event.currentTarget && typeof onBoardClick === "function") {
          onBoardClick();
        }
      }}
    >
      {blocks.map((block, index) => {
        const isGlowing = activeIndex === index;
        const isSelected = selectedIndex === index;
        const isWrong = wrongIndex === index;

        return (
          <button
            key={index}
            type="button"
            className="cbt-block"
            style={{
              top: block.top,
              left: block.left,
              width: STONE_SIZE,
              height: STONE_SIZE,
            }}
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onBlockClick(index);
            }}
          >
            <img
              src={isGlowing ? stoneShinyImg : stoneImg}
              alt={`第 ${index + 1} 顆石頭`}
              width="360"
              height="203"
              loading="lazy"
              decoding="async"
              className={[
                "cbt-stone",
                isGlowing ? "is-glowing" : "",
                isSelected ? "is-selected" : "",
                isWrong ? "is-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ width: STONE_SIZE, height: "auto" }}
              draggable="false"
            />
          </button>
        );
      })}

      {(phase === "answer" || phase === "warmupAnswer") &&
        personIndex !== null && (
          <img
            src={personImg}
            alt="沿著石頭路線前進的小朋友"
            width="156"
            height="126"
            loading="lazy"
            decoding="async"
            className={["cbt-person", isWalking ? "is-walking" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: blocks[personIndex]?.left ?? "50%",
              top: (blocks[personIndex]?.top ?? 0) - PERSON_OFFSET_Y,
              transform: "translate(-50%, -50%)",
            }}
            draggable="false"
          />
        )}
    </div>
  );
}
