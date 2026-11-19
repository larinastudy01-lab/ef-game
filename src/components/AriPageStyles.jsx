import React from "react";

// Keep the assessment and training presentation identical without leaking styles after navigation.
export default function AriPageStyles() {
  return <style>{ariPageCss}</style>;
}

const ariPageCss = `
.ari-page--soft {
  min-height: 100vh;
  padding: 0;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: #4b2c16;
  user-select: none;
  -webkit-user-select: none;
}

.ari-page--soft::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,0.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,239,188,0.10));
  z-index: 0;
}

.ari-center-shell {
  width: min(88vw, 1180px);
  min-height: 100vh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 28px 0;
  position: relative;
  z-index: 1;
}

.ari-start-shell,
.ari-result-shell {
  width: min(72vw, 860px);
}

.ari-soft-panel {
  width: 100%;
  position: relative;
  box-sizing: border-box;
  border: 7px solid #f6a51f;
  border-radius: 58px;
  background:
    linear-gradient(180deg, rgba(255, 252, 225, 0.98), rgba(255, 237, 168, 0.98));
  box-shadow:
    0 18px 0 rgba(202, 116, 24, 0.13),
    0 24px 42px rgba(95, 64, 22, 0.16),
    inset 0 0 0 8px rgba(255, 255, 255, 0.45),
    inset 0 0 0 16px rgba(255, 215, 105, 0.20);
}

.ari-soft-panel::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230, 170, 67, 0.42);
  pointer-events: none;
}

.ari-soft-panel::after {
  content: "";
  position: absolute;
  left: 30px;
  right: 30px;
  bottom: 18px;
  height: 42px;
  pointer-events: none;
  background:
    radial-gradient(circle at 4% 40%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 8% 15%, #a4da58 0 9px, transparent 10px),
    radial-gradient(circle at 92% 42%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 88% 18%, #a4da58 0 9px, transparent 10px);
  opacity: 0.92;
}

.ari-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 34px;
}

.ari-game-title {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: min(100%, 420px);
  padding: 14px 42px 16px;
  border-radius: 20px;
  border: 4px solid #e9a33c;
  background:
    linear-gradient(180deg, rgba(255, 226, 129, 0.96), rgba(255, 244, 194, 0.98));
  color: #7a3f16;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 950;
  line-height: 1.08;
  letter-spacing: 2px;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.85);
  box-shadow:
    0 8px 0 rgba(210, 130, 37, 0.24),
    0 14px 24px rgba(91, 57, 18, 0.12),
    inset 0 0 0 5px rgba(255, 255, 255, 0.34);
}

.ari-game-title::before,
.ari-game-title::after {
  content: "🌿";
  position: absolute;
  top: 50%;
  font-size: 28px;
  transform: translateY(-50%);
}

.ari-game-title::before { left: 18px; }
.ari-game-title::after { right: 18px; transform: translateY(-50%) scaleX(-1); }

.ari-start-content {
  position: relative;
  z-index: 2;
  width: min(100%, 690px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 158px;
  align-items: center;
  justify-content: center;
  gap: 44px;
}

.ari-dialog-bubble {
  min-height: 138px;
  border: 4px solid #f0c77b;
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
  color: #6d3717;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 30px;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.32;
  font-weight: 900;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 8px 0 rgba(225, 169, 84, 0.12), inset 0 0 0 5px rgba(255, 235, 174, 0.35);
}

.ari-opening-bubble {
  min-height: 132px;
}

.ari-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229, 189, 119, 0.55);
  pointer-events: none;
}

.ari-dialog-bubble::after {
  content: "";
  position: absolute;
  right: -30px;
  top: 50%;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #fff 0%, #fff9e9 80%);
  border-top: 4px solid #f0c77b;
  border-right: 4px solid #f0c77b;
  transform: translateY(-50%) rotate(45deg);
  border-radius: 4px;
}

.ari-round-icon {
  width: 158px;
  height: 158px;
  border-radius: 999px;
  background: linear-gradient(180deg, #82d9ff, #48aee8);
  border: 5px solid rgba(255,255,255,0.92);
  outline: 3px solid rgba(72, 157, 207, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
  box-shadow: 0 10px 0 rgba(42, 112, 165, 0.20), 0 18px 24px rgba(53, 91, 123, 0.18);
}

.ari-round-icon img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  transform: scale(1.2) translate(2%, 5%);
  border-radius: 50%;
  display: block;
}

.ari-start-avatar {
  background: linear-gradient(180deg, #84dcff, #42afe9);
}

.ari-forest-button {
  position: relative;
  z-index: 2;
  min-width: 220px;
  min-height: 76px;
  padding: 12px 36px;
  border-radius: 24px;
  color: #ffffff;
  font-family: inherit;
  font-size: clamp(25px, 2.8vw, 38px);
  font-weight: 950;
  line-height: 1.15;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
  text-shadow: 0 3px 0 rgba(35, 96, 36, 0.36), 0 0 8px rgba(35, 96, 36, 0.18);
}

.ari-forest-button::before,
.ari-forest-button::after {
  content: "";
  position: absolute;
  width: 30px;
  height: 22px;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 30% 55%, #e8ff9b 0 9px, transparent 10px),
    radial-gradient(ellipse at 72% 45%, #7bc946 0 11px, transparent 12px);
  filter: drop-shadow(0 2px 0 rgba(65, 115, 35, 0.20));
}

.ari-forest-button::before { left: 12px; bottom: 9px; transform: rotate(-18deg); }
.ari-forest-button::after { right: 12px; top: 9px; transform: rotate(154deg); }

.ari-forest-button:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.ari-forest-button:active:not(:disabled) {
  transform: translateY(1px);
}

.ari-forest-button:disabled {
  opacity: 0.52;
  cursor: default;
  filter: grayscale(0.18);
}

.ari-btn-start,
.ari-btn-home,
.ari-btn-replay,
.ari-btn-detail,
.ari-btn-skip,
.ari-btn-next {
  border: 4px solid rgba(255,255,255,0.86);
  outline: 3px solid #5d9d32;
  background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
  box-shadow:
    0 6px 0 #377721,
    0 13px 22px rgba(61, 97, 33, 0.20),
    inset 0 4px 0 rgba(255,255,255,0.48),
    inset 0 -5px 0 rgba(49, 128, 31, 0.26);
}

.ari-btn-replay {
  outline-color: #67a833;
}

.ari-btn-detail {
  outline-color: #598f2e;
}

.ari-btn-skip {
  min-width: 260px;
}


.ari-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.ari-image-button {
  min-width: 0;
  min-height: 0;
  width: clamp(188px, 18vw, 254px);
  height: auto;
  padding: 0;
  border: none;
  outline: none;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
  line-height: 0;
  overflow: visible;
}

.ari-image-button.ari-btn-start,
.ari-image-button.ari-btn-home,
.ari-image-button.ari-btn-replay,
.ari-image-button.ari-btn-detail,
.ari-image-button.ari-btn-skip,
.ari-image-button.ari-btn-next {
  min-width: 0;
  min-height: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.ari-image-button::before,
.ari-image-button::after {
  display: none;
}

.ari-image-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.ari-image-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.04);
}

.ari-image-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}

.ari-image-button:disabled {
  opacity: 0.56;
}

.ari-image-button:disabled img {
  filter: grayscale(0.35) drop-shadow(0 6px 6px rgba(74, 48, 16, 0.16));
}

.ari-btn-skip.ari-image-button,
.ari-btn-next.ari-image-button {
  width: clamp(198px, 19vw, 266px);
}

.ari-step-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(18px, 3vw, 34px);
  position: relative;
  z-index: 2;
}

.ari-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 8;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: ari-mouse-tap 1.15s ease-in-out infinite;
}

.ari-mouse-on-button {
  right: -18px;
  bottom: -18px;
  transform-origin: 18% 18%;
}

.ari-mouse-on-acorn {
  right: clamp(8px, 1.4vw, 18px);
  top: clamp(38px, 5vw, 70px);
  transform-origin: 18% 18%;
}

@keyframes ari-mouse-tap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.ari-video-panel,
.ari-tutorial-panel {
  min-height: 78vh;
  padding: 48px 68px 38px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.ari-video-frame {
  width: 100%;
  height: min(60vh, 560px);
  min-height: 360px;
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  box-shadow:
    0 8px 0 rgba(55, 121, 177, 0.18),
    inset 0 0 0 4px rgba(255,255,255,0.28);
}

.ari-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 前導互動教學保持原本結構，只微調在新背景中不破版 */
.ari-tutorial-scene {
  width: 100%;
  height: min(58vh, 540px);
  min-height: 360px;
  border: 2px solid rgba(115, 144, 82, 0.55);
  border-radius: 26px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(22px, 3vw, 42px);
}

.ari-tutorial-scene::before {
  content: "";
  position: absolute;
  left: 7%;
  right: 7%;
  bottom: 12%;
  height: 18%;
  border-radius: 999px;
  background: rgba(112, 174, 77, 0.14);
  filter: blur(2px);
}

.ari-tutorial-grid {
  width: min(100%, 1040px);
  height: 100%;
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(132px, 0.8fr) minmax(280px, 1.45fr) minmax(168px, 0.9fr);
  align-items: center;
  justify-items: center;
  column-gap: clamp(20px, 4vw, 56px);
}

.ari-avatar-guide {
  width: clamp(128px, 16vw, 182px);
  height: clamp(128px, 16vw, 182px);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 5px solid #ff9a4b;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
  box-shadow: 0 16px 24px rgba(92, 66, 29, 0.16);
  box-sizing: border-box;
}

.ari-avatar-guide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.ari-rule-steps {
  width: 100%;
  min-height: 260px;
  display: grid;
  grid-template-rows: auto 64px auto;
  align-items: center;
  justify-items: center;
  gap: 10px;
}

.ari-guide-bubble,
.ari-tap-hint {
  z-index: 2;
  padding: 12px 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 3px solid rgba(255, 132, 38, 0.78);
  color: #2c1d12;
  font-size: clamp(22px, 2.5vw, 36px);
  font-weight: 900;
  box-shadow: 0 10px 18px rgba(95, 70, 30, 0.12);
  white-space: nowrap;
}

.ari-guide-main,
.ari-guide-wait {
  position: static;
}

.ari-guide-arrow {
  width: min(100%, 320px);
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 153, 54, 0.12), rgba(255, 134, 38, 0.92));
  position: relative;
  transform: rotate(-4deg);
  transform-origin: center;
}

.ari-guide-arrow::after {
  content: "";
  position: absolute;
  right: -4px;
  top: 50%;
  width: 24px;
  height: 24px;
  border-top: 8px solid rgba(255, 134, 38, 0.92);
  border-right: 8px solid rgba(255, 134, 38, 0.92);
  transform: translateY(-50%) rotate(45deg);
}

.ari-tutorial-practice {
  min-width: 168px;
  min-height: 240px;
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: center;
  justify-items: center;
  gap: 16px;
  position: relative;
}

.ari-practice-acorn {
  width: clamp(96px, 12vw, 136px);
  height: clamp(96px, 12vw, 136px);
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  box-shadow: 0 12px 24px rgba(69, 49, 24, 0.18);
  animation: ari-practice-float 1.5s ease-in-out infinite;
}

.ari-practice-acorn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ari-practice-acorn.is-ready {
  box-shadow: 0 0 0 9px rgba(255, 230, 102, 0.32), 0 0 30px rgba(255, 204, 60, 0.85);
  animation: none;
}

.ari-tap-hint {
  font-size: clamp(18px, 2vw, 28px);
  color: #6b4b23;
  opacity: 0.95;
}

@keyframes ari-practice-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.06); }
}

.ari-demo-effect {
  left: 50%;
  top: 40%;
}

.ari-play-page {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.ari-test-game-area {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.ari-test-game-area::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.04), transparent 35%);
}

.ari-idle-flash::after {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 32px;
  pointer-events: none;
  z-index: 4;
  box-shadow: inset 0 0 40px rgba(255, 230, 120, 0.64);
  animation: ari-idle-flash 0.9s ease-out forwards;
}

@keyframes ari-idle-flash {
  0% { opacity: 0; }
  35% { opacity: 1; }
  100% { opacity: 0; }
}

.ari-test-item {
  position: absolute;
  cursor: pointer;
  transform: translate(-50%, -50%);
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-tap-highlight-color: transparent;
  z-index: 2;
  filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24));
  animation: ari-test-item-pop 0.18s ease-out;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.ari-test-item:hover {
  transform: translate(-50%, -50%) scale(1.04);
  filter: drop-shadow(0 13px 15px rgba(79, 57, 20, 0.28)) brightness(1.06);
}

.ari-test-item:active {
  transform: translate(-50%, -50%) scale(0.94);
}

@keyframes ari-test-item-pop {
  from { transform: translate(-50%, -50%) scale(0.72); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.ari-test-effect {
  position: absolute;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 5;
  border: 5px solid rgba(255, 236, 94, 0.92);
  background: rgba(255, 245, 158, 0.18);
  box-shadow: 0 0 22px rgba(255, 204, 48, 0.55);
  animation: ari-test-effect-pop 0.42s ease-out forwards;
}

.ari-test-effect.is-penalty {
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.86) 0 10%, rgba(255, 138, 120, 0.72) 11% 35%, rgba(255, 70, 50, 0.16) 60%, rgba(255, 70, 50, 0) 72%);
  box-shadow:
    0 0 0 7px rgba(255, 108, 87, 0.16),
    0 0 24px rgba(255, 96, 70, 0.52),
    0 0 44px rgba(209, 58, 38, 0.26);
}

@keyframes ari-test-effect-pop {
  from { transform: translate(-50%, -50%) scale(0.7); opacity: 0.95; }
  to { transform: translate(-50%, -50%) scale(1.45); opacity: 0; }
}

.ari-result-panel {
  min-height: 500px;
  padding: 92px 56px 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 44px;
}

.ari-result-panel::before {
  inset: 18px;
}

.ari-cute-stars {
  position: absolute;
  top: -78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  z-index: 3;
}

.ari-cute-star {
  font-size: clamp(82px, 8vw, 116px);
  line-height: 0.9;
  color: #c2cfc9;
  opacity: 0.6;
  -webkit-text-stroke: 7px rgba(255,255,255,0.96);
  text-shadow:
    0 5px 0 rgba(85, 111, 84, 0.20),
    0 10px 16px rgba(72, 58, 32, 0.16);
  display: inline-block;
  transform: rotate(-8deg);
}

.ari-cute-star:nth-child(2) {
  transform: translateY(-12px) rotate(2deg) scale(1.15);
}

.ari-cute-star:nth-child(3) {
  transform: rotate(7deg);
}

.ari-cute-star.is-on {
  color: #ffd53d;
  opacity: 1;
  -webkit-text-stroke: 7px rgba(255,255,255,0.98);
  text-shadow:
    0 4px 0 #e39d19,
    0 8px 16px rgba(121, 74, 6, 0.30),
    0 0 18px rgba(255, 249, 171, 0.95);
}

.ari-result-content {
  width: min(100%, 720px);
  grid-template-columns: minmax(300px, 1fr) 170px;
}

.ari-result-icon {
  width: 170px;
  height: 170px;
  padding: 0;
}

.ari-result-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  width: 100%;
}

.ari-result-actions .ari-forest-button {
  min-width: 188px;
  min-height: 70px;
  font-size: clamp(22px, 2.2vw, 30px);
  border-radius: 20px;
}

.ari-result-actions .ari-image-button {
  min-width: 0;
  min-height: 0;
  width: clamp(168px, 16vw, 232px);
  border-radius: 18px;
}


/* =========================================================
   Claymorphism visual upgrade: SRT forest test page
   - Keeps existing RWD structure intact.
   - Only enhances depth, glow, shadows, and motion.
   ========================================================= */

.ari-soft-panel {
  border-color: rgba(246, 165, 31, 0.96);
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.88) 0 9%, transparent 29%),
    radial-gradient(circle at 84% 18%, rgba(255, 238, 160, 0.58) 0 13%, transparent 34%),
    linear-gradient(145deg, rgba(255, 252, 222, 0.99) 0%, rgba(255, 229, 139, 0.98) 48%, rgba(239, 178, 83, 0.96) 100%);
  box-shadow:
    0 22px 0 rgba(151, 87, 28, 0.18),
    0 36px 62px rgba(66, 44, 15, 0.28),
    0 12px 26px rgba(255, 223, 128, 0.22),
    inset 0 12px 18px rgba(255, 255, 255, 0.72),
    inset 0 2px 0 rgba(255, 255, 255, 0.92),
    inset 0 -18px 24px rgba(139, 77, 22, 0.20),
    inset 0 -42px 72px rgba(119, 75, 21, 0.12);
}

.ari-soft-panel::before {
  border-color: rgba(255, 245, 205, 0.58);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.50),
    inset 0 -3px 8px rgba(139, 88, 23, 0.12);
}

.ari-soft-panel::after {
  filter:
    drop-shadow(0 4px 2px rgba(60, 105, 27, 0.22))
    drop-shadow(0 10px 10px rgba(88, 57, 19, 0.16));
}

.ari-test-item {
  filter:
    drop-shadow(0 14px 13px rgba(54, 38, 15, 0.34))
    drop-shadow(0 5px 2px rgba(118, 76, 23, 0.18))
    drop-shadow(0 0 15px rgba(255, 219, 75, 0.62))
    drop-shadow(0 0 32px rgba(255, 184, 28, 0.34));
  animation: ari-test-item-pop 0.28s cubic-bezier(0.19, 1.34, 0.32, 1) both;
  transition:
    transform 0.18s cubic-bezier(0.2, 1.25, 0.38, 1),
    filter 0.18s ease;
  will-change: transform, filter;
}

.ari-test-item:hover {
  transform: translate(-50%, -50%) scale(1.075) rotate(-1.5deg);
  filter:
    drop-shadow(0 17px 16px rgba(54, 38, 15, 0.38))
    drop-shadow(0 6px 2px rgba(118, 76, 23, 0.20))
    drop-shadow(0 0 19px rgba(255, 230, 97, 0.78))
    drop-shadow(0 0 42px rgba(255, 190, 34, 0.48))
    brightness(1.08)
    saturate(1.06);
}

.ari-test-item:active {
  transform: translate(-50%, -50%) scale(0.9) rotate(1.5deg);
  filter:
    drop-shadow(0 8px 8px rgba(54, 38, 15, 0.30))
    drop-shadow(0 0 18px rgba(255, 218, 72, 0.58))
    brightness(1.12);
}

@keyframes ari-test-item-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.42) rotate(-7deg);
    opacity: 0;
    filter:
      drop-shadow(0 4px 5px rgba(54, 38, 15, 0.18))
      drop-shadow(0 0 4px rgba(255, 224, 88, 0.12));
  }
  68% {
    transform: translate(-50%, -50%) scale(1.12) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.ari-test-effect {
  width: 86px;
  height: 86px;
  border: 0;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.92) 0 10%, rgba(255, 243, 128, 0.86) 11% 24%, rgba(255, 191, 44, 0.40) 25% 47%, rgba(255, 156, 20, 0.00) 70%),
    conic-gradient(from 14deg, rgba(255,255,255,0), rgba(255,247,153,0.78), rgba(255,184,28,0.18), rgba(255,255,255,0));
  box-shadow:
    0 0 0 7px rgba(255, 238, 123, 0.20),
    0 0 22px rgba(255, 218, 67, 0.86),
    0 0 48px rgba(255, 178, 28, 0.55),
    inset 0 0 18px rgba(255, 255, 255, 0.74);
  mix-blend-mode: screen;
  animation: ari-test-effect-pop 0.54s cubic-bezier(0.12, 1.55, 0.38, 1) forwards;
  will-change: transform, opacity, filter;
}

.ari-test-effect::before,
.ari-test-effect::after {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  pointer-events: none;
}

.ari-test-effect::before {
  border: 4px solid rgba(255, 245, 145, 0.70);
  box-shadow:
    0 0 18px rgba(255, 234, 95, 0.72),
    inset 0 0 12px rgba(255, 255, 255, 0.50);
}

.ari-test-effect::after {
  inset: 10px;
  background:
    radial-gradient(circle, rgba(255,255,255,0.86), rgba(255,229,85,0.48) 44%, transparent 70%);
  filter: blur(1px);
}

@keyframes ari-test-effect-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.28);
    opacity: 0;
    filter: blur(0) saturate(1.05);
  }
  18% {
    transform: translate(-50%, -50%) scale(1.08);
    opacity: 1;
    filter: blur(0) saturate(1.22);
  }
  52% {
    transform: translate(-50%, -50%) scale(1.62);
    opacity: 0.78;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.15);
    opacity: 0;
    filter: blur(2px) saturate(1.15);
  }
}

.ari-image-button {
  transform-origin: 50% 58%;
  transition:
    transform 0.2s cubic-bezier(0.18, 1.25, 0.38, 1),
    filter 0.2s ease;
  will-change: transform, filter;
}

.ari-image-button img {
  filter:
    drop-shadow(0 10px 8px rgba(74, 48, 16, 0.26))
    drop-shadow(0 0 14px rgba(255, 238, 150, 0.22));
  transition: filter 0.2s ease;
}

.ari-image-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.045);
  filter: brightness(1.06) saturate(1.05);
  animation:
    ari-button-breathe 1.15s ease-in-out infinite,
    ari-button-wobble 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.ari-image-button:hover:not(:disabled) img {
  filter:
    drop-shadow(0 14px 10px rgba(74, 48, 16, 0.30))
    drop-shadow(0 0 18px rgba(255, 238, 150, 0.38));
}

.ari-image-button:active:not(:disabled) {
  transform: translateY(2px) scale(0.965);
  animation: none;
}

@keyframes ari-button-wobble {
  0% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
  18% { transform: translateY(-4px) scale(1.055) rotate(-2.6deg); }
  36% { transform: translateY(-3px) scale(1.05) rotate(2.1deg); }
  54% { transform: translateY(-4px) scale(1.052) rotate(-1.4deg); }
  72% { transform: translateY(-3px) scale(1.047) rotate(0.8deg); }
  100% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
}

@keyframes ari-button-breathe {
  0%, 100% { transform: translateY(-3px) scale(1.045); }
  50% { transform: translateY(-5px) scale(1.065); }
}

@media (prefers-reduced-motion: reduce) {
  .ari-test-item,
  .ari-test-effect,
  .ari-image-button,
  .ari-image-button:hover:not(:disabled) {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    transition-duration: 0.01ms;
  }
}


@media (max-width: 1024px) {
  .ari-start-shell,
  .ari-result-shell {
    width: min(86vw, 920px);
  }

  .ari-soft-panel {
    border-radius: 50px;
  }

  .ari-start-panel,
  .ari-result-panel {
    padding-left: 44px;
    padding-right: 44px;
  }

  .ari-video-panel,
  .ari-tutorial-panel {
    padding: 42px 48px 30px;
  }
}

@media (max-width: 768px) {
  .ari-page--soft {
    overflow-y: auto;
  }

  .ari-center-shell,
  .ari-start-shell,
  .ari-result-shell {
    width: 92vw;
    min-height: 100svh;
    padding: 42px 0 28px;
  }

  .ari-soft-panel {
    border-width: 6px;
    border-radius: 38px;
  }

  .ari-soft-panel::before {
    inset: 12px;
    border-radius: 28px;
  }

  .ari-start-panel {
    min-height: 540px;
    padding: 44px 22px 40px;
    gap: 28px;
  }

  .ari-game-title {
    font-size: 30px;
    padding: 12px 24px;
  }

  .ari-game-title::before,
  .ari-game-title::after {
    display: none;
  }

  .ari-start-content,
  .ari-result-content {
    grid-template-columns: 1fr;
    gap: 22px;
    justify-items: center;
  }

  .ari-dialog-bubble {
    width: 100%;
    min-height: 120px;
  }

  .ari-dialog-bubble::after {
    display: none;
  }

  .ari-round-icon,
  .ari-result-icon {
    width: 138px;
    height: 138px;
    padding: 0;
  }

  .ari-video-panel,
  .ari-tutorial-panel {
    min-height: 560px;
    padding: 34px 26px 24px;
  }

  .ari-video-frame,
  .ari-tutorial-scene {
    height: 48vh;
    min-height: 320px;
  }

  .ari-tutorial-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    row-gap: 14px;
  }

  .ari-avatar-guide {
    width: 112px;
    height: 112px;
  }

  .ari-rule-steps {
    min-height: 130px;
    grid-template-rows: auto 24px auto;
  }

  .ari-guide-bubble,
  .ari-tap-hint {
    font-size: 20px;
    padding: 10px 16px;
  }

  .ari-guide-arrow {
    width: 150px;
  }

  .ari-practice-acorn {
    width: 92px;
    height: 92px;
  }

  .ari-tutorial-practice {
    min-height: 130px;
  }

  .ari-result-panel {
    min-height: 590px;
    padding: 84px 22px 40px;
    gap: 34px;
  }

  .ari-cute-stars {
    top: -54px;
    gap: 8px;
  }

  .ari-result-actions {
    gap: 16px;
  }

  .ari-result-actions .ari-forest-button {
    min-width: min(100%, 220px);
    min-height: 64px;
  }
}

@media (max-width: 480px) {
  .ari-center-shell,
  .ari-start-shell,
  .ari-result-shell {
    width: 94vw;
  }

  .ari-soft-panel {
    border-width: 5px;
    border-radius: 30px;
  }

  .ari-start-panel {
    padding: 34px 16px 30px;
  }

  .ari-game-title {
    font-size: 25px;
    padding: 10px 18px;
    min-width: auto;
  }

  .ari-dialog-bubble {
    padding: 18px 16px;
    font-size: 24px;
  }

  .ari-round-icon,
  .ari-result-icon {
    width: 114px;
    height: 114px;
    padding: 0;
  }

  .ari-forest-button {
    min-width: 150px;
    min-height: 60px;
    padding: 10px 22px;
    font-size: 24px;
  }

  .ari-video-panel,
  .ari-tutorial-panel {
    min-height: 500px;
    padding: 26px 16px 22px;
  }

  .ari-video-frame,
  .ari-tutorial-scene {
    height: 44vh;
    min-height: 270px;
  }

  .ari-avatar-guide {
    width: 86px;
    height: 86px;
  }

  .ari-guide-bubble,
  .ari-tap-hint {
    font-size: 17px;
  }

  .ari-practice-acorn {
    width: 76px;
    height: 76px;
  }

  .ari-test-item {
    width: 96px !important;
  }
}
@media (max-width: 720px) {
  .ari-image-button,
  .ari-result-actions .ari-image-button {
    min-width: 0;
    min-height: 0;
    width: min(72vw, 206px);
    padding: 0;
  }

  .ari-btn-skip.ari-image-button,
  .ari-btn-next.ari-image-button {
    width: min(74vw, 214px);
  }

  .ari-mouse-guide {
    width: 52px;
  }

  .ari-mouse-on-button {
    right: -10px;
    bottom: -14px;
  }
}



/* ARI 正式測驗區：保留 SRT 視覺語言，但動物直接顯示，不使用卡片。 */
.ari-container {
  position: relative;
  z-index: 1;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: clamp(12px, 2vw, 28px);
}

.ari-stage {
  position: relative;
  width: min(96vw, 1180px);
  height: min(88vh, 760px);
  border: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.ari-assessment-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ari-listen-status {
  position: absolute;
  z-index: 4;
  top: 4%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 300px;
  padding: 13px 30px;
  border: 4px solid #f0c77b;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff 0%, #fff9e9 100%);
  color: #6d3717;
  font-size: clamp(22px, 2.6vw, 34px);
  font-weight: 900;
  box-shadow: 0 8px 0 rgba(225,169,84,.12), inset 0 0 0 5px rgba(255,235,174,.35);
}

.ari-animal-choice-row {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  padding: 16px clamp(24px, 4vw, 60px);
  gap: clamp(50px, 10vw, 150px);
}

.ari-animal-choice {
  position: relative;
  width: min(100%, clamp(235px, 28vw, 370px), 48svh);
  aspect-ratio: 5 / 8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  outline: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  opacity: .72;
  cursor: default;
  transition: transform .16s ease, filter .16s ease, opacity .16s ease;
}

.ari-animal-choice > img:not(.ari-answer-mouse) {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: auto;
  max-width: none;
  transform: translate(-50%, -50%);
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 18px 16px rgba(74,54,25,.24));
}

.ari-animal-choice.is-clickable {
  cursor: pointer;
  opacity: 1;
  animation: ari-animal-ready 1s ease-in-out infinite alternate;
}

.ari-animal-choice.is-clickable:hover,
.ari-animal-choice.is-clickable:focus-visible {
  transform: translateY(-8px) scale(1.045);
  filter: brightness(1.05);
}

.ari-animal-choice.is-clickable:active {
  transform: translateY(2px) scale(.97);
}

.ari-retry-audio {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 7%;
  transform: translateX(-50%);
  min-width: 220px;
  min-height: 66px;
  padding: 12px 28px;
  border: 4px solid rgba(255,255,255,.86);
  outline: 3px solid #5d9d32;
  border-radius: 22px;
  background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
  color: #fff;
  font-family: inherit;
  font-size: clamp(20px,2.2vw,28px);
  font-weight: 900;
  box-shadow: 0 6px 0 #377721, 0 13px 22px rgba(61,97,33,.20);
  cursor: pointer;
}

@keyframes ari-animal-ready {
  from { filter: drop-shadow(0 18px 16px rgba(74,54,25,.20)); }
  to { filter: drop-shadow(0 0 24px rgba(255,218,84,.72)) drop-shadow(0 18px 16px rgba(74,54,25,.20)); }
}

@media (max-width: 780px) {
  .ari-animal-choice-row { padding: 16px 18px; gap: 16px; }
  .ari-animal-choice { width: min(100%, 43vw, 260px, 48svh); }
  .ari-listen-status { top: 3%; min-width: 220px; padding: 10px 18px; }
}
`;
