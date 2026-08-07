import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReturnButton from "../asset/return.webp";
import { useNavigate } from "react-router-dom";
import "../styles/SettingsPage.css";
import { supabase } from "../lib/supabaseClient";

const STORAGE_KEY = "efGameTrainingSettings";

const TIME_OPTIONS = [
  { value: 5, label: "5 分鐘", hint: "短短練習" },
  { value: 10, label: "10 分鐘", hint: "日常訓練" },
  { value: 15, label: "15 分鐘", hint: "完整練習" },
  { value: 20, label: "20 分鐘", hint: "加強訓練" },
];

const FONT_SIZE_OPTIONS = [
  { value: "normal", label: "標準字", hint: "一般閱讀" },
  { value: "large", label: "大字體", hint: "孩子更好看" },
];

const BUTTON_SIZE_OPTIONS = [
  { value: "normal", label: "標準按鈕", hint: "一般大小" },
  { value: "large", label: "大按鈕", hint: "比較好點" },
];

const REMINDER_TYPE_LABELS = {
  follow_up: "回診提醒",
  training: "訓練提醒",
  test: "測驗提醒",
  check_report: "報告提醒",
  inspection: "檢查提醒",
};

const REMINDER_STATUS_LABELS = {
  unread: "未讀",
  read: "已讀",
  done: "已完成",
};

const DEFAULT_SETTINGS = {
  bgmVolume: 60,
  sfxVolume: 75,
  trainingMinutes: 10,
  brightness: 72,
  eyeCareMode: true,
  parentLock: true,
  parentPin: "",
  fontSize: "normal",
  buttonSize: "large",
};

const SETTINGS_PAGE_LAYOUT_FIX = `
  .settings-page {
    position: relative !important;
    min-height: 100dvh !important;
    width: 100% !important;
    padding: clamp(14px, 3vw, 36px) !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    background: linear-gradient(180deg, #fff7d9 0%, #fff1b8 100%);
  }

  .settings-background-glow {
    position: fixed !important;
    inset: 0 !important;
    pointer-events: none !important;
    z-index: 0 !important;
    background:
      radial-gradient(circle at 12% 8%, rgba(255, 210, 92, 0.36), transparent 28%),
      radial-gradient(circle at 86% 18%, rgba(255, 246, 182, 0.46), transparent 30%);
  }

  .settings-card {
    position: relative !important;
    z-index: 1 !important;
    width: min(100%, 1320px) !important;
    margin: 0 auto !important;
    padding: clamp(18px, 3vw, 34px) !important;
    border: 5px solid rgba(245, 203, 123, 0.78) !important;
    border-radius: clamp(24px, 3vw, 34px) !important;
    background: rgba(255, 248, 214, 0.78) !important;
    box-shadow: 0 22px 46px rgba(118, 83, 32, 0.12) !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  .settings-header {
    position: relative !important;
    display: flex !important;
    align-items: flex-start !important;
    gap: clamp(12px, 1.8vw, 18px) !important;
    margin-bottom: clamp(18px, 2.4vw, 28px) !important;
    z-index: 2 !important;
  }

  .settings-header h1 {
    margin: 4px 0 6px !important;
    color: #663b08 !important;
    font-size: clamp(1.65rem, 3vw, 2.55rem) !important;
    line-height: 1.05 !important;
  }

  .settings-header p,
  .panel-title-row p {
    margin: 0 !important;
    color: #8a5a1c !important;
    font-weight: 800 !important;
    font-size: clamp(0.86rem, 1.25vw, 1rem) !important;
    line-height: 1.45 !important;
  }

  .settings-label {
    color: #b77814 !important;
    font-size: 0.8rem !important;
    font-weight: 900 !important;
    letter-spacing: 0.08em !important;
  }

  .settings-back-button {
    width: clamp(42px, 4.8vw, 56px) !important;
    height: clamp(42px, 4.8vw, 56px) !important;
    min-width: clamp(42px, 4.8vw, 56px) !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: #ffd56e !important;
    color: #6a3d08 !important;
    font-size: 1.45rem !important;
    font-weight: 900 !important;
    box-shadow: 0 10px 20px rgba(108, 77, 24, 0.18) !important;
    cursor: pointer !important;
  }

  .settings-grid {
    position: relative !important;
    z-index: 2 !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(320px, 1fr)) !important;
    grid-auto-flow: row !important;
    gap: clamp(16px, 2.2vw, 26px) !important;
    align-items: stretch !important;
    overflow: visible !important;
  }

  .settings-grid > * {
    position: relative !important;
    inset: auto !important;
    transform: none !important;
    opacity: 1 !important;
    visibility: visible !important;
    grid-row: auto !important;
    min-width: 0 !important;
    z-index: 1 !important;
    box-sizing: border-box !important;
  }

  .settings-panel,
  .settings-summary {
    min-width: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    padding: clamp(18px, 2.4vw, 26px) !important;
    border: 1px solid rgba(151, 111, 58, 0.16) !important;
    border-radius: 26px !important;
    background: rgba(255, 255, 255, 0.76) !important;
    box-shadow: 0 12px 28px rgba(108, 77, 24, 0.08) !important;
    backdrop-filter: blur(4px) !important;
    overflow: visible !important;
  }

  .settings-panel {
    grid-column: auto !important;
  }

  .settings-summary {
    grid-column: 1 / -1 !important;
    display: grid !important;
    grid-template-columns: repeat(4, minmax(180px, 1fr)) !important;
    gap: 14px !important;
    align-items: stretch !important;
    background: rgba(219, 238, 174, 0.72) !important;
    border-color: rgba(140, 183, 88, 0.24) !important;
  }

  .settings-summary h2,
  .summary-note {
    grid-column: 1 / -1 !important;
  }

  .panel-title-row {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    margin-bottom: 16px !important;
  }

  .panel-title-row h2,
  .settings-summary h2 {
    margin: 0 !important;
    color: #5c3a0b !important;
    font-size: clamp(1.05rem, 1.6vw, 1.32rem) !important;
    line-height: 1.2 !important;
  }

  .panel-icon {
    display: grid !important;
    place-items: center !important;
    width: clamp(42px, 4.5vw, 54px) !important;
    height: clamp(42px, 4.5vw, 54px) !important;
    min-width: clamp(42px, 4.5vw, 54px) !important;
    border-radius: 50% !important;
    background: #ffd978 !important;
    box-shadow: 0 10px 20px rgba(122, 82, 22, 0.13) !important;
    font-size: 1.2rem !important;
  }

  .volume-control,
  .brightness-control,
  .lock-control,
  .toggle-row {
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding: 15px 16px !important;
    margin-top: 14px !important;
    border-radius: 20px !important;
  }

  .volume-control,
  .brightness-control {
    background: rgba(255, 253, 244, 0.88) !important;
  }

  .volume-text,
  .setting-row-text {
    display: flex !important;
    justify-content: space-between !important;
    gap: 12px !important;
    align-items: center !important;
    margin-bottom: 10px !important;
    color: #5c3f1f !important;
    font-size: 0.92rem !important;
    font-weight: 900 !important;
  }

  .setting-row-text span,
  .volume-text span {
    color: #7b5c37 !important;
    white-space: nowrap !important;
  }

  .volume-control input[type="range"],
  .brightness-control input[type="range"] {
    width: 100% !important;
    height: 8px !important;
    accent-color: #f0be4f !important;
  }

  .toggle-row {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: center !important;
    gap: 16px !important;
    background: rgba(255, 255, 255, 0.78) !important;
    border: 1px solid rgba(151, 111, 58, 0.18) !important;
  }

  .toggle-row strong,
  .lock-control strong {
    display: block !important;
    color: #5c3f1f !important;
    font-size: 0.96rem !important;
    line-height: 1.3 !important;
  }

  .toggle-row small,
  .lock-control small {
    display: block !important;
    margin-top: 4px !important;
    color: #8b724f !important;
    font-weight: 700 !important;
    line-height: 1.4 !important;
  }

  .settings-toggle {
    position: relative !important;
    width: 62px !important;
    height: 36px !important;
    flex: 0 0 auto !important;
    border: 0 !important;
    border-radius: 999px !important;
    background: #d8c3a2 !important;
    cursor: pointer !important;
    transition: 0.2s ease !important;
  }

  .settings-toggle::after {
    content: "" !important;
    position: absolute !important;
    top: 4px !important;
    left: 4px !important;
    width: 28px !important;
    height: 28px !important;
    border-radius: 50% !important;
    background: #fffdf8 !important;
    box-shadow: 0 2px 8px rgba(91, 60, 21, 0.18) !important;
    transition: 0.2s ease !important;
  }

  .settings-toggle.active {
    background: #78b85c !important;
  }

  .settings-toggle.active::after {
    transform: translateX(26px) !important;
  }

  .time-options,
  .choice-options {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(130px, 1fr)) !important;
    gap: 12px !important;
  }

  .choice-options + .choice-options {
    margin-top: 12px !important;
  }

  .time-option,
  .choice-option {
    min-width: 0 !important;
    min-height: 68px !important;
    padding: 13px 14px !important;
    border-radius: 20px !important;
    border: 2px solid rgba(151, 111, 58, 0.16) !important;
    background: rgba(255, 255, 255, 0.76) !important;
    color: #6b4a24 !important;
    cursor: pointer !important;
    word-break: keep-all !important;
    overflow-wrap: anywhere !important;
  }

  .time-option.active,
  .choice-option.active {
    background: linear-gradient(180deg, #ffe49c, #ffd46d) !important;
    border-color: rgba(230, 177, 74, 0.78) !important;
    box-shadow: 0 10px 20px rgba(151, 111, 58, 0.16) !important;
  }

  .time-option:disabled {
    cursor: not-allowed !important;
    opacity: 0.52 !important;
    filter: grayscale(0.2) !important;
  }

  .time-option strong,
  .choice-option strong {
    display: block !important;
    font-size: clamp(0.92rem, 1.35vw, 1rem) !important;
    line-height: 1.22 !important;
  }

  .time-option span,
  .choice-option span {
    display: block !important;
    margin-top: 5px !important;
    font-size: 0.78rem !important;
    line-height: 1.25 !important;
  }

  .lock-control {
    background: rgba(255, 248, 224, 0.86) !important;
    border: 1px dashed rgba(151, 111, 58, 0.32) !important;
    color: #6b4a24 !important;
    font-size: 0.88rem !important;
    font-weight: 800 !important;
    line-height: 1.45 !important;
  }

  .parent-unlock-form,
  .parent-pin-form {
    display: grid !important;
    grid-template-columns: minmax(140px, 1fr) auto !important;
    gap: 12px !important;
    align-items: stretch !important;
    margin-top: 14px !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  .parent-pin-form {
    grid-template-columns: repeat(2, minmax(120px, 1fr)) auto !important;
  }

  .parent-unlock-input {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 48px !important;
    border-radius: 16px !important;
    border: 1px solid rgba(151, 111, 58, 0.32) !important;
    padding: 0 14px !important;
    background: rgba(255, 255, 255, 0.92) !important;
    color: #5c3f1f !important;
    font-size: 1rem !important;
    font-weight: 900 !important;
    box-sizing: border-box !important;
    outline: none !important;
  }

  .parent-unlock-form .settings-secondary-button,
  .parent-pin-form .settings-secondary-button {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 48px !important;
    padding-inline: 16px !important;
    white-space: nowrap !important;
  }

  .parent-lock-message {
    margin-top: 10px !important;
    padding: 10px 12px !important;
    border-radius: 14px !important;
    background: rgba(255, 231, 181, 0.84) !important;
    color: #7b4d16 !important;
    font-size: 0.86rem !important;
    font-weight: 900 !important;
    line-height: 1.35 !important;
  }

  .summary-item {
    padding: 14px 16px !important;
    border-radius: 18px !important;
    background: rgba(255, 255, 255, 0.78) !important;
  }

  .summary-item span {
    display: block !important;
    margin-bottom: 8px !important;
    color: #8b5d22 !important;
    font-size: 0.78rem !important;
    font-weight: 800 !important;
  }

  .summary-item strong {
    color: #5c3f1f !important;
    font-size: 0.98rem !important;
    line-height: 1.35 !important;
  }

  .summary-note {
    padding: 14px 16px !important;
    border-radius: 18px !important;
    background: rgba(232, 245, 194, 0.86) !important;
    color: #5f6521 !important;
    font-size: 0.86rem !important;
    font-weight: 800 !important;
    line-height: 1.45 !important;
  }

  .settings-actions {
    position: relative !important;
    z-index: 2 !important;
    display: flex !important;
    justify-content: flex-end !important;
    flex-wrap: wrap !important;
    margin-top: clamp(16px, 2vw, 24px) !important;
    gap: 12px !important;
  }

  .settings-secondary-button,
  .settings-primary-button {
    min-width: 0 !important;
    min-height: 46px !important;
    padding: 11px 22px !important;
    border: 0 !important;
    border-radius: 20px !important;
    font-size: 0.98rem !important;
    font-weight: 900 !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
  }

  .settings-secondary-button {
    background: linear-gradient(180deg, #d4efa7, #aedc74) !important;
    color: #4d6518 !important;
    box-shadow: 0 10px 18px rgba(87, 106, 43, 0.16) !important;
  }

  .settings-primary-button {
    background: linear-gradient(180deg, #ffd978, #f5bd4f) !important;
    color: #673f0a !important;
    box-shadow: 0 10px 18px rgba(151, 111, 58, 0.16) !important;
  }

  .settings-toast {
    position: fixed !important;
    left: 50% !important;
    bottom: 20px !important;
    transform: translateX(-50%) !important;
    z-index: 20 !important;
    padding: 11px 20px !important;
    border-radius: 999px !important;
    background: rgba(92, 63, 31, 0.92) !important;
    color: white !important;
    font-size: 0.92rem !important;
    font-weight: 900 !important;
  }


  .medical-reminder-panel {
    grid-column: 1 / -1 !important;
    background: rgba(246, 253, 236, 0.82) !important;
    border-color: rgba(132, 177, 92, 0.24) !important;
  }

  .reminder-title-actions {
    margin-left: auto !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
  }

  .reminder-badge {
    display: inline-flex !important;
    align-items: center !important;
    min-height: 32px !important;
    padding: 7px 12px !important;
    border-radius: 999px !important;
    background: rgba(255, 213, 110, 0.68) !important;
    color: #6a3d08 !important;
    font-size: 0.82rem !important;
    font-weight: 900 !important;
    white-space: nowrap !important;
  }

  .reminder-refresh-button {
    min-height: 34px !important;
    padding: 7px 13px !important;
    border: 0 !important;
    border-radius: 999px !important;
    background: linear-gradient(180deg, #d4efa7, #aedc74) !important;
    color: #4d6518 !important;
    font-size: 0.82rem !important;
    font-weight: 900 !important;
    cursor: pointer !important;
    box-shadow: 0 8px 16px rgba(87, 106, 43, 0.12) !important;
  }

  .reminder-refresh-button:disabled {
    cursor: wait !important;
    opacity: 0.62 !important;
  }

  .reminder-state-card {
    padding: 16px 18px !important;
    border-radius: 20px !important;
    background: rgba(255, 255, 255, 0.78) !important;
    color: #6b4a24 !important;
    font-size: 0.92rem !important;
    font-weight: 850 !important;
    line-height: 1.55 !important;
  }

  .reminder-state-card.warning {
    background: rgba(255, 237, 199, 0.82) !important;
    color: #835316 !important;
  }

  .reminder-list {
    display: grid !important;
    gap: 12px !important;
    max-height: 420px !important;
    overflow-y: auto !important;
    padding-right: 4px !important;
  }

  .reminder-card {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    gap: 14px !important;
    padding: 16px 18px !important;
    border-radius: 22px !important;
    border: 2px solid rgba(132, 177, 92, 0.16) !important;
    background: rgba(255, 255, 255, 0.82) !important;
    box-shadow: 0 10px 22px rgba(87, 106, 43, 0.08) !important;
  }

  .reminder-card.unread {
    border-color: rgba(236, 176, 57, 0.52) !important;
    background: rgba(255, 250, 231, 0.92) !important;
  }

  .reminder-meta {
    display: flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    margin-bottom: 9px !important;
  }

  .reminder-type-pill,
  .reminder-status-pill {
    display: inline-flex !important;
    align-items: center !important;
    min-height: 28px !important;
    padding: 5px 10px !important;
    border-radius: 999px !important;
    font-size: 0.76rem !important;
    font-weight: 900 !important;
  }

  .reminder-type-pill {
    background: rgba(213, 239, 168, 0.84) !important;
    color: #526a1a !important;
  }

  .reminder-status-pill {
    background: rgba(232, 221, 204, 0.8) !important;
    color: #6f5738 !important;
  }

  .reminder-status-pill.unread {
    background: rgba(255, 213, 110, 0.82) !important;
    color: #744507 !important;
  }

  .reminder-date {
    color: #8b724f !important;
    font-size: 0.78rem !important;
    font-weight: 800 !important;
  }

  .reminder-card h3 {
    margin: 0 0 8px !important;
    color: #5c3a0b !important;
    font-size: clamp(1rem, 1.45vw, 1.18rem) !important;
    line-height: 1.25 !important;
  }

  .reminder-card p {
    margin: 0 !important;
    color: #6d502b !important;
    font-size: 0.92rem !important;
    font-weight: 800 !important;
    line-height: 1.55 !important;
  }

  .reminder-read-button {
    align-self: center !important;
    min-width: 82px !important;
    min-height: 40px !important;
    padding: 9px 13px !important;
    border: 0 !important;
    border-radius: 16px !important;
    background: linear-gradient(180deg, #ffd978, #f5bd4f) !important;
    color: #673f0a !important;
    font-size: 0.86rem !important;
    font-weight: 900 !important;
    cursor: pointer !important;
    box-shadow: 0 8px 16px rgba(151, 111, 58, 0.14) !important;
    white-space: nowrap !important;
  }

  .reminder-read-button:disabled {
    cursor: wait !important;
    opacity: 0.6 !important;
  }

  @media (max-width: 1024px) {
    .settings-card {
      width: 100% !important;
      padding: clamp(16px, 2.5vw, 24px) !important;
    }

    .settings-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .settings-summary {
      grid-template-columns: repeat(2, minmax(180px, 1fr)) !important;
    }
  }

  @media (max-width: 720px) {
    .settings-page {
      padding: 10px !important;
    }

    .settings-header {
      align-items: center !important;
    }

    .settings-header p {
      font-size: 0.84rem !important;
    }

    .time-options,
    .choice-options,
    .settings-summary,
    .parent-unlock-form,
    .parent-pin-form {
      grid-template-columns: 1fr !important;
    }

    .settings-panel,
    .settings-summary {
      padding: 14px !important;
      border-radius: 22px !important;
    }
  }

  @media (max-width: 720px) {
    .reminder-card {
      grid-template-columns: 1fr !important;
    }

    .reminder-title-actions {
      width: 100% !important;
      margin-left: 0 !important;
      justify-content: flex-start !important;
    }

    .reminder-read-button {
      justify-self: end !important;
    }
  }

  @media (max-width: 420px) {
    .settings-card {
      padding: 12px !important;
      border-radius: 22px !important;
      border-width: 4px !important;
    }

    .settings-header {
      gap: 10px !important;
    }

    .toggle-row {
      grid-template-columns: 1fr !important;
    }

    .settings-toggle {
      justify-self: end !important;
    }

    .settings-actions {
      display: grid !important;
      grid-template-columns: 1fr !important;
    }

    .settings-secondary-button,
    .settings-primary-button {
      width: 100% !important;
    }
  }
`;

function sanitizeSettings(parsed) {
  const safeTrainingMinutes = TIME_OPTIONS.some(
    (item) => item.value === parsed?.trainingMinutes
  )
    ? parsed.trainingMinutes
    : DEFAULT_SETTINGS.trainingMinutes;

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    bgmVolume: Number.isFinite(Number(parsed?.bgmVolume))
      ? Number(parsed.bgmVolume)
      : DEFAULT_SETTINGS.bgmVolume,
    sfxVolume: Number.isFinite(Number(parsed?.sfxVolume))
      ? Number(parsed.sfxVolume)
      : DEFAULT_SETTINGS.sfxVolume,
    trainingMinutes: safeTrainingMinutes,
    brightness: Number.isFinite(Number(parsed?.brightness))
      ? Number(parsed.brightness)
      : DEFAULT_SETTINGS.brightness,
    eyeCareMode:
      typeof parsed?.eyeCareMode === "boolean"
        ? parsed.eyeCareMode
        : DEFAULT_SETTINGS.eyeCareMode,
    parentLock:
      typeof parsed?.parentLock === "boolean"
        ? parsed.parentLock
        : DEFAULT_SETTINGS.parentLock,
    parentPin:
      typeof parsed?.parentPin === "string"
        ? parsed.parentPin
        : DEFAULT_SETTINGS.parentPin,
    fontSize: FONT_SIZE_OPTIONS.some((item) => item.value === parsed?.fontSize)
      ? parsed.fontSize
      : DEFAULT_SETTINGS.fontSize,
    buttonSize: BUTTON_SIZE_OPTIONS.some(
      (item) => item.value === parsed?.buttonSize
    )
      ? parsed.buttonSize
      : DEFAULT_SETTINGS.buttonSize,
  };
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(saved));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsToStorage(nextSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(
    new CustomEvent("ef-game-settings-change", {
      detail: nextSettings,
    })
  );
}


function safeParseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getCurrentChildFromStorage() {
  const currentChild = safeParseJson(localStorage.getItem("currentChild"), null);
  const currentChildId =
    localStorage.getItem("currentChildId") ||
    currentChild?.id ||
    currentChild?.childId ||
    currentChild?.patient_id ||
    null;

  return {
    id: currentChildId,
    name: currentChild?.nickname || currentChild?.name || currentChild?.full_name || "目前選擇的孩子",
  };
}

function formatReminderDate(value) {
  if (!value) return "時間未記錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未記錄";
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReminderTitle(reminder) {
  return (
    reminder?.title ||
    REMINDER_TYPE_LABELS[reminder?.reminder_type] ||
    "醫療提醒"
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings);
  const [savedHint, setSavedHint] = useState(false);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [parentPinInput, setParentPinInput] = useState("");
  const [parentPinConfirm, setParentPinConfirm] = useState("");
  const [parentUnlockInput, setParentUnlockInput] = useState("");
  const [parentLockMessage, setParentLockMessage] = useState("");
  const lockMessageTimerRef = useRef(null);
  const savedHintTimerRef = useRef(null);
  const navigateTimerRef = useRef(null);
  const [currentChild, setCurrentChild] = useState(() => getCurrentChildFromStorage());
  const [reminders, setReminders] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderError, setReminderError] = useState("");
  const [readingReminderId, setReadingReminderId] = useState("");

  const hasParentPin = useMemo(
    () => Boolean(settings.parentPin?.trim()),
    [settings.parentPin]
  );
  const isFirstParentPinSetup = settings.parentLock && !hasParentPin;
  const needsExistingParentPinVerification =
    settings.parentLock && hasParentPin && !parentUnlocked;
  const importantSettingsLocked = needsExistingParentPinVerification;
  const unreadReminderCount = useMemo(
    () => reminders.filter((item) => item.status === "unread").length,
    [reminders]
  );

  const fetchReminders = useCallback(async () => {
    const selectedChild = getCurrentChildFromStorage();
    setCurrentChild(selectedChild);

    if (!selectedChild.id) {
      setReminders([]);
      setReminderError("尚未選擇兒童，請先回到兒童選擇頁選擇孩子。");
      return;
    }

    setReminderLoading(true);
    setReminderError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setReminders([]);
        setReminderError("請先登入家長帳號，才能查看醫療提醒。");
        return;
      }

      const { data, error } = await supabase
        .from("parent_reminders")
        .select("id, patient_id, clinician_id, reminder_type, title, message, status, created_at, read_at")
        .eq("patient_id", selectedChild.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReminders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("醫療提醒讀取失敗：", error);
      setReminders([]);
      setReminderError("目前無法讀取醫療提醒，請確認網路或稍後再試。");
    } finally {
      setReminderLoading(false);
    }
  }, []);

  const markReminderAsRead = async (reminder) => {
    if (!reminder?.id || reminder.status !== "unread") return;

    setReadingReminderId(reminder.id);

    try {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("parent_reminders")
        .update({ status: "read", read_at: readAt })
        .eq("id", reminder.id);

      if (error) throw error;

      setReminders((prev) =>
        prev.map((item) =>
          item.id === reminder.id ? { ...item, status: "read", read_at: readAt } : item
        )
      );
    } catch (error) {
      console.warn("醫療提醒標記已讀失敗：", error);
      setReminderError("提醒狀態更新失敗，請稍後再試。");
    } finally {
      setReadingReminderId("");
    }
  };

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.setAttribute("data-settings-page-layout-fix", "true");
    styleElement.textContent = SETTINGS_PAGE_LAYOUT_FIX;
    document.head.appendChild(styleElement);

    return () => {
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(lockMessageTimerRef.current);
      window.clearTimeout(savedHintTimerRef.current);
      window.clearTimeout(navigateTimerRef.current);
    };
  }, []);


  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNumberChange = (key, value) => {
    updateSetting(key, Number(value));
  };

  const handleTimeSelect = (minutes) => {
    if (importantSettingsLocked) return;
    updateSetting("trainingMinutes", minutes);
  };

  const showParentLockMessage = (message) => {
    window.clearTimeout(lockMessageTimerRef.current);
    setParentLockMessage(message);
    lockMessageTimerRef.current = window.setTimeout(
      () => setParentLockMessage(""),
      1800
    );
  };

  const filterPinDigits = (value) => value.replace(/\D/g, "").slice(0, 6);

  const handlePinInputChange = (setter) => (event) => {
    setter(filterPinDigits(event.target.value));
  };

  const isValidPin = (value) => /^\d{4,6}$/.test(value.trim());

  const handleParentPinSave = () => {
    const nextPin = filterPinDigits(parentPinInput);
    const confirmPin = filterPinDigits(parentPinConfirm);

    if (!isValidPin(nextPin)) {
      showParentLockMessage("請設定 4～6 位數字密碼");
      return;
    }

    if (nextPin !== confirmPin) {
      showParentLockMessage("兩次輸入的密碼不一樣");
      return;
    }

    updateSetting("parentPin", nextPin);
    setParentUnlocked(true);
    setParentPinInput("");
    setParentPinConfirm("");
    showParentLockMessage("家長密碼已設定");
  };

  const handleParentUnlock = () => {
    if (!hasParentPin) {
      showParentLockMessage("請先設定家長密碼");
      return;
    }

    if (parentUnlockInput.trim() !== settings.parentPin) {
      showParentLockMessage("密碼不正確，請再試一次");
      return;
    }

    setParentUnlocked(true);
    setParentUnlockInput("");
    setSavedHint(true);
    window.clearTimeout(savedHintTimerRef.current);
    savedHintTimerRef.current = window.setTimeout(() => setSavedHint(false), 800);
  };

  const handleParentLockToggle = () => {
    if (settings.parentLock && hasParentPin && !parentUnlocked) {
      showParentLockMessage("請先輸入家長密碼再關閉");
      return;
    }

    updateSetting("parentLock", !settings.parentLock);
    setParentUnlocked(false);
    setParentPinInput("");
    setParentPinConfirm("");
    setParentUnlockInput("");
    setParentLockMessage("");
  };

  const handleSave = () => {
    if (needsExistingParentPinVerification) {
      showParentLockMessage("請先輸入家長密碼再儲存重要設定");
      return;
    }

    saveSettingsToStorage(settings);
    setSavedHint(true);

    window.clearTimeout(savedHintTimerRef.current);
    window.clearTimeout(navigateTimerRef.current);
    navigateTimerRef.current = window.setTimeout(() => {
      setSavedHint(false);
      navigate(-1);
    }, 650);
  };

  const handleReset = () => {
    const resetSettings = { ...DEFAULT_SETTINGS };
    saveSettingsToStorage(resetSettings);
    setSettings(resetSettings);
    setParentUnlocked(false);
    setParentPinInput("");
    setParentPinConfirm("");
    setParentUnlockInput("");
    setParentLockMessage("");
    window.clearTimeout(lockMessageTimerRef.current);
  };

  return (
    <main className="settings-page">
      <div className="settings-background-glow" />

      <section className="settings-card">
        <header className="settings-header">
          <button
            className="settings-back-button"
            type="button"
            onClick={() => navigate(-1)}
            aria-label="回到上一頁"
          >
            <img src={ReturnButton} alt="" />
          </button>

          <div>
            <span className="settings-label">遊戲設定</span>
            <h1>調整聲音與畫面</h1>
            <p>設定音量、亮度、家長鎖與操作大小，讓孩子遊玩時更舒服。</p>
          </div>
        </header>

        <div className="settings-grid">
          <section className="settings-panel sound-panel">
            <div className="panel-title-row">
              <span className="panel-icon">♪</span>
              <div>
                <h2>音量設定</h2>
                <p>調整背景音樂與點擊音效。</p>
              </div>
            </div>

            <div className="volume-control">
              <div className="volume-text">
                <strong>背景音樂</strong>
                <span>{settings.bgmVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.bgmVolume}
                onChange={(event) =>
                  handleNumberChange("bgmVolume", event.target.value)
                }
                aria-label="背景音樂音量"
              />
            </div>

            <div className="volume-control">
              <div className="volume-text">
                <strong>音效</strong>
                <span>{settings.sfxVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.sfxVolume}
                onChange={(event) =>
                  handleNumberChange("sfxVolume", event.target.value)
                }
                aria-label="音效音量"
              />
            </div>
          </section>

          <section className="settings-panel display-panel">
            <div className="panel-title-row">
              <span className="panel-icon">☀</span>
              <div>
                <h2>亮度設定</h2>
                <p>讓森林畫面更柔和，降低幼兒長時間觀看的不適。</p>
              </div>
            </div>

            <div className="brightness-control">
              <div className="setting-row-text">
                <strong>畫面亮度</strong>
                <span>{settings.brightness}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                value={settings.brightness}
                onChange={(event) =>
                  handleNumberChange("brightness", event.target.value)
                }
                aria-label="畫面亮度"
              />
            </div>

            <div className="toggle-row">
              <div>
                <strong>護眼模式</strong>
                <small>降低刺眼亮度，讓背景更柔和。</small>
              </div>
              <button
                className={
                  settings.eyeCareMode
                    ? "settings-toggle active"
                    : "settings-toggle"
                }
                type="button"
                onClick={() =>
                  updateSetting("eyeCareMode", !settings.eyeCareMode)
                }
                aria-label="切換護眼模式"
                aria-pressed={settings.eyeCareMode}
              />
            </div>
          </section>

          <section className="settings-panel time-panel">
            <div className="panel-title-row">
              <span className="panel-icon">⏱</span>
              <div>
                <h2>預設訓練時間</h2>
                <p>家長可設定每次訓練的預設時間。</p>
              </div>
            </div>

            {importantSettingsLocked && (
              <div className="lock-control">
                家長鎖已開啟，請先輸入家長密碼後再調整訓練時間。
              </div>
            )}

            <div className="time-options">
              {TIME_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={importantSettingsLocked}
                  className={
                    settings.trainingMinutes === item.value
                      ? "time-option active"
                      : "time-option"
                  }
                  onClick={() => handleTimeSelect(item.value)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-panel access-panel">
            <div className="panel-title-row">
              <span className="panel-icon">Aa</span>
              <div>
                <h2>閱讀與操作</h2>
                <p>調整字體與按鈕大小，支援平板與小螢幕。</p>
              </div>
            </div>

            <div className="choice-options">
              {FONT_SIZE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={
                    settings.fontSize === item.value
                      ? "choice-option active"
                      : "choice-option"
                  }
                  onClick={() => updateSetting("fontSize", item.value)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>

            <div className="choice-options">
              {BUTTON_SIZE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={
                    settings.buttonSize === item.value
                      ? "choice-option active"
                      : "choice-option"
                  }
                  onClick={() => updateSetting("buttonSize", item.value)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-panel parent-panel">
            <div className="panel-title-row">
              <div>
                <h2>家長鎖</h2>
                <p>避免孩子誤改訓練時間等重要設定。</p>
              </div>
            </div>

            <div className="toggle-row">
              <div>
                <strong>開啟家長鎖</strong>
                <small>開啟後，重要設定需要家長密碼確認。</small>
              </div>
              <button
                className={
                  settings.parentLock
                    ? "settings-toggle active"
                    : "settings-toggle"
                }
                type="button"
                onClick={handleParentLockToggle}
                aria-label="切換家長鎖"
                aria-pressed={settings.parentLock}
              />
            </div>

            {isFirstParentPinSetup && (
              <div className="lock-control parent-pin-box">
                <strong>設定家長密碼</strong>
                <small>請設定 4～6 位數字密碼，之後調整重要設定時使用。</small>

                <div className="parent-pin-form">
                  <input
                    className="parent-unlock-input"
                    value={parentPinInput}
                    onChange={handlePinInputChange(setParentPinInput)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    type="password"
                    placeholder="輸入密碼"
                    aria-label="設定家長密碼"
                  />
                  <input
                    className="parent-unlock-input"
                    value={parentPinConfirm}
                    onChange={handlePinInputChange(setParentPinConfirm)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    type="password"
                    placeholder="再次輸入"
                    aria-label="確認家長密碼"
                  />
                  <button
                    className="settings-secondary-button parent-pin-button"
                    type="button"
                    onClick={handleParentPinSave}
                  >
                    設定密碼
                  </button>
                </div>
              </div>
            )}

            {needsExistingParentPinVerification && (
              <div className="lock-control parent-pin-box">
                <strong>輸入家長密碼</strong>
                <small>解鎖後，本次可調整訓練時間或關閉家長鎖。</small>

                <div className="parent-unlock-form">
                  <input
                    className="parent-unlock-input"
                    value={parentUnlockInput}
                    onChange={handlePinInputChange(setParentUnlockInput)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="current-password"
                    maxLength={6}
                    type="password"
                    placeholder="家長密碼"
                    aria-label="輸入家長密碼"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleParentUnlock();
                    }}
                  />
                  <button
                    className="settings-secondary-button"
                    type="button"
                    onClick={handleParentUnlock}
                  >
                    解鎖
                  </button>
                </div>
              </div>
            )}

            {settings.parentLock && hasParentPin && parentUnlocked && (
              <div className="lock-control parent-pin-box">
                <strong>家長鎖已解鎖</strong>
                <small>可以重新設定密碼，或關閉家長鎖。</small>

                <div className="parent-pin-form">
                  <input
                    className="parent-unlock-input"
                    value={parentPinInput}
                    onChange={handlePinInputChange(setParentPinInput)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    type="password"
                    placeholder="新密碼"
                    aria-label="新的家長密碼"
                  />
                  <input
                    className="parent-unlock-input"
                    value={parentPinConfirm}
                    onChange={handlePinInputChange(setParentPinConfirm)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    type="password"
                    placeholder="再次輸入"
                    aria-label="再次輸入新的家長密碼"
                  />
                  <button
                    className="settings-secondary-button parent-pin-button"
                    type="button"
                    onClick={handleParentPinSave}
                  >
                    更新密碼
                  </button>
                </div>
              </div>
            )}

            {parentLockMessage && (
              <div className="parent-lock-message">{parentLockMessage}</div>
            )}
          </section>

          <section className="settings-panel medical-reminder-panel">
            <div className="panel-title-row">
              <span className="panel-icon">✉</span>
              <div>
                <h2>醫療提醒</h2>
                <p>查看醫療端提供給家長的提醒與追蹤建議。</p>
              </div>

              <div className="reminder-title-actions">
                <span className="reminder-badge">
                  {unreadReminderCount > 0
                    ? `${unreadReminderCount} 則未讀`
                    : "沒有未讀提醒"}
                </span>
                <button
                  className="reminder-refresh-button"
                  type="button"
                  onClick={fetchReminders}
                  disabled={reminderLoading}
                >
                  {reminderLoading ? "更新中" : "重新整理"}
                </button>
              </div>
            </div>

            {!currentChild.id && (
              <div className="reminder-state-card warning">
                尚未選擇兒童，請先回到兒童選擇頁選擇孩子後，再查看醫療提醒。
              </div>
            )}

            {currentChild.id && reminderError && (
              <div className="reminder-state-card warning">{reminderError}</div>
            )}

            {currentChild.id && reminderLoading && (
              <div className="reminder-state-card">正在讀取 {currentChild.name} 的醫療提醒...</div>
            )}

            {currentChild.id && !reminderLoading && !reminderError && reminders.length === 0 && (
              <div className="reminder-state-card">
                目前沒有新的醫療提醒。若醫療端送出訊息，之後會顯示在這裡。
              </div>
            )}

            {currentChild.id && !reminderLoading && reminders.length > 0 && (
              <div className="reminder-list" aria-label="醫療提醒列表">
                {reminders.map((reminder) => {
                  const isUnread = reminder.status === "unread";

                  return (
                    <article
                      className={isUnread ? "reminder-card unread" : "reminder-card"}
                      key={reminder.id}
                    >
                      <div>
                        <div className="reminder-meta">
                          <span className="reminder-type-pill">
                            {REMINDER_TYPE_LABELS[reminder.reminder_type] || "醫療提醒"}
                          </span>
                          <span
                            className={
                              isUnread
                                ? "reminder-status-pill unread"
                                : "reminder-status-pill"
                            }
                          >
                            {REMINDER_STATUS_LABELS[reminder.status] || "已讀"}
                          </span>
                          <span className="reminder-date">
                            {formatReminderDate(reminder.created_at)}
                          </span>
                        </div>

                        <h3>{getReminderTitle(reminder)}</h3>
                        <p>{reminder.message}</p>
                      </div>

                      {isUnread && (
                        <button
                          className="reminder-read-button"
                          type="button"
                          onClick={() => markReminderAsRead(reminder)}
                          disabled={readingReminderId === reminder.id}
                        >
                          {readingReminderId === reminder.id ? "更新中" : "標為已讀"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="settings-summary">
            <h2>目前設定</h2>

            <div className="summary-item">
              <span>聲音</span>
              <strong>
                音樂 {settings.bgmVolume}%／音效 {settings.sfxVolume}%
              </strong>
            </div>

            <div className="summary-item">
              <span>畫面</span>
              <strong>
                亮度 {settings.brightness}%／
                {settings.eyeCareMode ? "護眼開" : "護眼關"}
              </strong>
            </div>

            <div className="summary-item">
              <span>操作</span>
              <strong>
                {settings.fontSize === "large" ? "大字" : "標準字"}／
                {settings.buttonSize === "large" ? "大按鈕" : "標準按鈕"}
              </strong>
            </div>

            <div className="summary-item">
              <span>訓練時間</span>
              <strong>{settings.trainingMinutes} 分鐘</strong>
            </div>

            <div className="summary-note">
              訓練能力已移到訓練流程中選擇，這裡只保留聲音、亮度、家長鎖與操作大小。
            </div>
          </aside>
        </div>

        <footer className="settings-actions">
          <button
            className="settings-secondary-button"
            type="button"
            onClick={handleReset}
          >
            還原預設
          </button>

          <button
            className="settings-primary-button"
            type="button"
            onClick={handleSave}
          >
            儲存並返回
          </button>
        </footer>

        {savedHint && <div className="settings-toast">已套用設定</div>}
      </section>
    </main>
  );
}

export default SettingsPage;
