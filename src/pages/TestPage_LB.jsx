// src/pages/TestPage_LB.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import calculateLBScore from "../utils/lbScoring";

import backgroundImg from "../asset/LB/background.png";
import sheepImg from "../asset/LB/sheep.png";
import homeImg from "../asset/LB/home.png";
import houseNumber01Img from "../asset/LB/house number_01.png";

/*
  TestPage_LB.jsx — clean restart version

  這版故意從最簡單開始：
  1. 不做複雜 grid。
  2. 加入互動式前導教學，正式測驗不顯示答案提示。
  3. 畫面維持寬版：背景、遊戲卡片、門牌區、底部訊息、提交答案。
  4. 三關規則保留：
     - 第一關：1 → 10
     - 第二關：10 → 1
     - 第三關：紅1 → 藍1 → 紅2 → 藍2 ... → 紅10 → 藍10
  5. 結束後寫入 sessionStorage/localStorage，再導向 /result-lb。

  先讓版面穩定，再慢慢加動畫、影片、AI 分析。
*/

const RESULT_ROUTE = "/result-lb";
const SESSION_KEY = "LB_RESULT";
const LOCAL_KEY = "lbTestResult";

const ANSWER_LIMIT_MS = 10000;

const TUTORIAL_STEPS = [
  {
    id: "forward",
    order: "1",
    iconLine: ["🐑", "1", "→", "2", "→", "3", "→", "🏠"],
    sequence: ["1", "2", "3", "4"],
    choices: ["1", "2", "3", "4"],
  },
  {
    id: "backward",
    order: "2",
    iconLine: ["🐑", "4", "→", "3", "→", "2", "→", "🏠"],
    sequence: ["4", "3", "2", "1"],
    choices: ["1", "2", "3", "4"],
  },
  {
    id: "red-blue",
    order: "3",
    iconLine: ["🐑", "red-1", "→", "blue-1", "→", "red-2", "→", "🏠"],
    sequence: ["red-1", "blue-1", "red-2", "blue-2"],
    choices: ["red-1", "blue-1", "red-2", "blue-2"],
  },
];

function getTutorialNumber(value) {
  if (value.startsWith("red-")) return value.replace("red-", "");
  if (value.startsWith("blue-")) return value.replace("blue-", "");
  return value;
}

function getTutorialColor(value) {
  if (value.startsWith("red-")) return "red";
  if (value.startsWith("blue-")) return "blue";
  return "cream";
}

const STAGES = [
  {
    id: "forward",
    title: "第一關",
    subtitle: "請從 1 點到 10",
    ruleText: "1 → 2 → 3 → ... → 10",
    items: Array.from({ length: 10 }, (_, index) => ({
      key: `n-${index + 1}`,
      number: index + 1,
      color: "cream",
      label: `${index + 1}`,
    })),
    sequence: Array.from({ length: 10 }, (_, index) => `n-${index + 1}`),
  },
  {
    id: "backward",
    title: "第二關",
    subtitle: "請從 10 點回 1",
    ruleText: "10 → 9 → 8 → ... → 1",
    items: Array.from({ length: 10 }, (_, index) => ({
      key: `n-${10 - index}`,
      number: 10 - index,
      color: "cream",
      label: `${10 - index}`,
    })),
    sequence: Array.from({ length: 10 }, (_, index) => `n-${10 - index}`),
  },
  {
    id: "red-blue",
    title: "第三關",
    subtitle: "請照門牌顏色交替點",
    ruleText: "看顏色點門牌",
    items: Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      return [
        {
          key: `red-${number}`,
          number,
          color: "red",
          label: `${number}`,
        },
        {
          key: `blue-${number}`,
          number,
          color: "blue",
          label: `${number}`,
        },
      ];
    }).flat(),
    sequence: Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      return [`red-${number}`, `blue-${number}`];
    }).flat(),
  },
];

const SIMPLE_POSITIONS_10 = [
  { left: "16%", top: "24%" },
  { left: "72%", top: "18%" },
  { left: "35%", top: "34%" },
  { left: "84%", top: "42%" },
  { left: "22%", top: "61%" },
  { left: "55%", top: "27%" },
  { left: "68%", top: "66%" },
  { left: "43%", top: "72%" },
  { left: "12%", top: "46%" },
  { left: "88%", top: "69%" },
];

const SIMPLE_POSITIONS_20 = [
  { left: "11%", top: "20%" },
  { left: "28%", top: "13%" },
  { left: "48%", top: "22%" },
  { left: "66%", top: "14%" },
  { left: "82%", top: "25%" },
  { left: "18%", top: "39%" },
  { left: "37%", top: "47%" },
  { left: "57%", top: "37%" },
  { left: "76%", top: "46%" },
  { left: "90%", top: "58%" },
  { left: "9%", top: "64%" },
  { left: "25%", top: "73%" },
  { left: "44%", top: "66%" },
  { left: "62%", top: "75%" },
  { left: "79%", top: "68%" },
  { left: "21%", top: "55%" },
  { left: "52%", top: "56%" },
  { left: "69%", top: "31%" },
  { left: "34%", top: "27%" },
  { left: "86%", top: "38%" },
];

function nowISO() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getExpectedText(item) {
  if (!item) return "";
  if (item.color === "red") return `紅 ${item.number}`;
  if (item.color === "blue") return `藍 ${item.number}`;
  return `${item.number}`;
}

function buildStageItems(stage) {
  const positions = stage.items.length > 10 ? SIMPLE_POSITIONS_20 : SIMPLE_POSITIONS_10;
  const offsetMap = { forward: 3, backward: 7, "red-blue": 11 };
  const offset = offsetMap[stage.id] || 0;

  return stage.items.map((item, index) => ({
    ...item,
    position: positions[(index + offset) % positions.length] || {
      left: `${15 + (index % 5) * 17}%`,
      top: `${18 + Math.floor(index / 5) * 20}%`,
    },
  }));
}

function buildSimpleSummary({ trials, startedAt, endedAt, completed }) {
  const total = trials.length;
  const correct = trials.filter((trial) => trial.correct).length;
  const wrong = trials.filter((trial) => !trial.correct && trial.errorType !== "timeout").length;
  const timeout = trials.filter((trial) => trial.errorType === "timeout").length;
  const reactionTimes = trials
    .filter((trial) => trial.correct)
    .map((trial) => safeNumber(trial.reactionTime, 0))
    .filter((value) => value > 0);

  const averageReactionTime =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
      : 0;

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  let stars = 1;
  if (completed && accuracy >= 85) stars = 3;
  else if (completed && accuracy >= 60) stars = 2;

  return {
    gameId: "LB",
    gameName: "Linking Balloons",
    mode: "test",
    completed,
    startedAt,
    endedAt,
    totalTrials: total,
    correct,
    wrong,
    timeout,
    accuracy,
    averageReactionTime,
    stars,
  };
}

function createResultPayload({ trials, stageRecords, startedAt, completed }) {
  const endedAt = nowISO();
  const summary = buildSimpleSummary({
    trials,
    stageRecords,
    startedAt,
    endedAt,
    completed,
  });

  let scoreResult = null;
  try {
    if (typeof calculateLBScore === "function") {
      scoreResult = calculateLBScore({
        mode: "test",
        trials,
        stageRecords,
        startedAt,
        endedAt,
        completed,
      });
    }
  } catch (error) {
    console.warn("[TestPage_LB] calculateLBScore failed, using simple summary.", error);
  }

  return {
    ...summary,
    ...(scoreResult || {}),
    summary,
    raw: {
      trials,
      stageRecords,
      startedAt,
      endedAt,
      completed,
    },
  };
}

function DoorplateButton({ item, disabled, completed, isWrong, isCorrect, onClick }) {
  return (
    <button
      type="button"
      className={[
        "lb-doorplate",
        `lb-doorplate-${item.color}`,
        completed ? "is-completed" : "",
        isWrong ? "is-wrong" : "",
        isCorrect ? "is-correct" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: item.position.left,
        top: item.position.top,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick(item);
      }}
      disabled={disabled || completed}
      aria-label={getExpectedText(item)}
    >
      <img src={houseNumber01Img} alt="" aria-hidden="true" draggable="false" />
      <span>{item.label}</span>
    </button>
  );
}

function TestPageLB() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("intro");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialCompletedKeys, setTutorialCompletedKeys] = useState([]);
  const [tutorialMessage, setTutorialMessage] = useState("輪到你點點看。");
  const [tutorialErrorKey, setTutorialErrorKey] = useState("");
  const [tutorialSuccessKey, setTutorialSuccessKey] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedKeys, setCompletedKeys] = useState([]);
  const [trials, setTrials] = useState([]);
  const [stageRecords, setStageRecords] = useState([]);
  const [message, setMessage] = useState("請依照前導教學中的規則完成測驗。");
  const [wrongKey, setWrongKey] = useState("");
  const [correctKey, setCorrectKey] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  const startedAtRef = useRef(nowISO());
  const stageStartedAtRef = useRef(Date.now());
  const stepStartedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const timeoutRef = useRef(null);

  const currentStage = STAGES[stageIndex];
  const displayItems = useMemo(() => buildStageItems(currentStage), [currentStage]);
  const expectedKey = currentStage.sequence[stepIndex];
  const expectedItem = currentStage.items.find((item) => item.key === expectedKey);
  const stageDone = stepIndex >= currentStage.sequence.length;

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing" || stageDone) return undefined;

    stepStartedAtRef.current = Date.now();
    const timerId = window.setTimeout(() => {
      handleTimeout();
    }, ANSWER_LIMIT_MS);

    return () => {
      window.clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stageIndex, stepIndex, stageDone]);

  const resetStageState = (nextStageIndex) => {
    window.clearTimeout(timeoutRef.current);
    setStageIndex(nextStageIndex);
    setStepIndex(0);
    setCompletedKeys([]);
    setWrongKey("");
    setCorrectKey("");
    setIsLocked(false);
    stageStartedAtRef.current = Date.now();
    stepStartedAtRef.current = Date.now();

    setMessage("請依照剛剛記住的規則繼續完成測驗。");
  };

  const currentTutorial = TUTORIAL_STEPS[tutorialStep];
  const tutorialExpectedKey = currentTutorial?.sequence[tutorialCompletedKeys.length];
  const tutorialDone = Boolean(
    currentTutorial && tutorialCompletedKeys.length >= currentTutorial.sequence.length
  );

  const resetTutorialStep = (nextStep) => {
    setTutorialStep(nextStep);
    setTutorialCompletedKeys([]);
    setTutorialErrorKey("");
    setTutorialSuccessKey("");
    setTutorialMessage("輪到你點點看。");
  };

  const handleTutorialChoice = (choice) => {
    if (!currentTutorial || tutorialDone) return;

    if (choice === tutorialExpectedKey) {
      setTutorialCompletedKeys((previous) => [...previous, choice]);
      setTutorialSuccessKey(choice);
      setTutorialErrorKey("");
      setTutorialMessage("很好！");

      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setTutorialSuccessKey("");
      }, 280);
      return;
    }

    setTutorialErrorKey(choice);
    setTutorialMessage("再試一次。");
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setTutorialErrorKey("");
    }, 420);
  };

  const goNextTutorial = () => {
    if (!tutorialDone) {
      setTutorialMessage("先完成小練習。");
      return;
    }

    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      startGame();
      return;
    }

    resetTutorialStep(tutorialStep + 1);
  };

  const goPreviousTutorial = () => {
    resetTutorialStep(Math.max(0, tutorialStep - 1));
  };

  const startGame = () => {
    startedAtRef.current = nowISO();
    resetStageState(0);
    setTrials([]);
    setStageRecords([]);
    setPhase("playing");
  };

  const recordTrial = ({ item, correct, errorType }) => {
    const reactionTime = Math.max(0, Date.now() - stepStartedAtRef.current);

    const trial = {
      gameId: "LB",
      mode: "test",
      stageId: currentStage.id,
      stageTitle: currentStage.title,
      stepIndex,
      expectedKey,
      expectedNumber: expectedItem?.number ?? null,
      expectedColor: expectedItem?.color ?? null,
      clickedKey: item?.key ?? null,
      clickedNumber: item?.number ?? null,
      clickedColor: item?.color ?? null,
      correct,
      errorType: correct ? null : errorType,
      reactionTime,
      timestamp: nowISO(),
    };

    setTrials((previous) => [...previous, trial]);
  };

  const goNextStep = (clickedItem) => {
    setCompletedKeys((previous) => [...previous, clickedItem.key]);
    setStepIndex((previous) => previous + 1);
    setCorrectKey(clickedItem.key);
    setMessage("已記錄，請繼續完成測驗。");

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setCorrectKey("");
    }, 350);
  };

  const handleNumberClick = (item) => {
    if (phase !== "playing" || isLocked || stageDone || finishedRef.current) return;

    const isCorrect = item.key === expectedKey;
    recordTrial({
      item,
      correct: isCorrect,
      errorType: isCorrect ? null : "sequenceError",
    });

    if (isCorrect) {
      goNextStep(item);
      return;
    }

    setWrongKey(item.key);
    setMessage("順序不太對，請照規則繼續。");
    setIsLocked(true);

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setWrongKey("");
      setIsLocked(false);
    }, 450);
  };

  const handleBlankClick = () => {
    if (phase !== "playing" || isLocked || stageDone || finishedRef.current) return;

    recordTrial({
      item: null,
      correct: false,
      errorType: "randomClick",
    });

    setMessage("請點門牌，不要點空白處。");
  };

  const handleTimeout = () => {
    if (phase !== "playing" || isLocked || stageDone || finishedRef.current) return;

    recordTrial({
      item: null,
      correct: false,
      errorType: "timeout",
    });

    setMessage("這一步時間到了，請繼續完成測驗。");
    setIsLocked(true);

    timeoutRef.current = window.setTimeout(() => {
      setIsLocked(false);
      setStepIndex((previous) => previous + 1);
    }, 500);
  };

  const saveStageRecord = () => {
    const now = Date.now();
    const stageRecord = {
      stageId: currentStage.id,
      stageTitle: currentStage.title,
      startedAt: new Date(stageStartedAtRef.current).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMs: Math.max(0, now - stageStartedAtRef.current),
      completedSteps: completedKeys.length,
      totalSteps: currentStage.sequence.length,
    };

    setStageRecords((previous) => [...previous, stageRecord]);
    return stageRecord;
  };

  const handleSubmitStage = () => {
    if (!stageDone || isLocked) return;

    const currentRecord = saveStageRecord();
    const nextStageIndex = stageIndex + 1;

    if (nextStageIndex < STAGES.length) {
      setPhase("stageComplete");
      setMessage(`${currentStage.title}完成。`);
      return;
    }

    finishGame({
      completed: true,
      extraStageRecord: currentRecord,
    });
  };

  const goNextStage = () => {
    const nextStageIndex = stageIndex + 1;
    if (nextStageIndex >= STAGES.length) return;

    resetStageState(nextStageIndex);
    setPhase("playing");
  };

  const finishGame = ({ completed, extraStageRecord = null }) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const finalStageRecords = extraStageRecord
      ? [...stageRecords, extraStageRecord]
      : [...stageRecords];

    const resultPayload = createResultPayload({
      trials,
      stageRecords: finalStageRecords,
      startedAt: startedAtRef.current,
      completed,
    });

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(resultPayload));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(resultPayload));
    } catch (error) {
      console.warn("[TestPage_LB] failed to save result", error);
    }

    navigate(RESULT_ROUTE, {
      replace: true,
      state: {
        result: resultPayload,
        gameId: "LB",
        mode: "test",
      },
    });
  };

  const progressPercent = currentStage.sequence.length
    ? Math.min(100, Math.round((stepIndex / currentStage.sequence.length) * 100))
    : 0;

  if (phase === "intro") {
    const isLastTutorial = tutorialStep >= TUTORIAL_STEPS.length - 1;

    return (
      <div className="lb-simple-page">
        <LBResetStyle />
        <main className="lb-simple-card lb-intro-card">
          <div className="lb-intro-visual" aria-hidden="true">
            <img className="lb-intro-sheep" src={sheepImg} alt="綿羊奶奶" draggable="false" />
          </div>

          <section className="lb-tutorial-content" aria-label="互動式前導教學">
            <p className="lb-kicker">Linking Balloons</p>
            <h1>幫綿羊奶奶走回家</h1>
            <div className="lb-rule-card" aria-label={`前導教學 ${currentTutorial.order}`}>
              <div className="lb-rule-icons" aria-hidden="true">
                {currentTutorial.iconLine.map((icon, index) => {
                  const color = getTutorialColor(icon);
                  return (
                    <span
                      key={`${icon}-${index}`}
                      className={[
                        color === "red" ? "is-red" : "",
                        color === "blue" ? "is-blue" : "",
                        icon === "→" ? "is-arrow" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {color === "red" || color === "blue" ? getTutorialNumber(icon) : icon}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="lb-tutorial-board" aria-label="互動練習門牌">
              {currentTutorial.choices.map((choice) => {
                const isCompleted = tutorialCompletedKeys.includes(choice);
                const isExpected = choice === tutorialExpectedKey;
                const isError = choice === tutorialErrorKey;
                const isSuccess = choice === tutorialSuccessKey;

                return (
                  <button
                    key={choice}
                    type="button"
                    className={[
                      "lb-tutorial-chip",
                      choice.startsWith("red-") ? "is-red" : "",
                      choice.startsWith("blue-") ? "is-blue" : "",
                      isCompleted ? "is-completed" : "",
                      isExpected ? "is-expected" : "",
                      isError ? "is-error" : "",
                      isSuccess ? "is-success" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleTutorialChoice(choice)}
                    disabled={isCompleted || tutorialDone}
                    aria-label={choice.startsWith("red-") ? `紅色 ${getTutorialNumber(choice)}` : choice.startsWith("blue-") ? `藍色 ${getTutorialNumber(choice)}` : getTutorialNumber(choice)}
                  >
                    {getTutorialNumber(choice)}
                  </button>
                );
              })}
            </div>


            <p className={tutorialDone ? "lb-tutorial-message is-done" : "lb-tutorial-message"}>
              {tutorialDone ? "完成！" : tutorialMessage}
            </p>

            <div className="lb-tutorial-dots" aria-label="教學進度">
              {TUTORIAL_STEPS.map((step, index) => (
                <span key={step.id} className={index === tutorialStep ? "is-active" : ""} />
              ))}
            </div>

            <div className="lb-tutorial-actions">
              <button
                type="button"
                className="lb-secondary-button"
                onClick={goPreviousTutorial}
                disabled={tutorialStep === 0}
              >
                上一步
              </button>
              <button
                type="button"
                className="lb-primary-button"
                onClick={goNextTutorial}
                disabled={!tutorialDone}
              >
                {isLastTutorial ? "開始測驗" : "下一步"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "stageComplete") {
    const nextStage = STAGES[stageIndex + 1];

    return (
      <div className="lb-simple-page">
        <LBResetStyle />
        <main className="lb-simple-card lb-stage-card">
          <div className="lb-intro-visual" aria-hidden="true">
            <img className="lb-stage-home" src={homeImg} alt="小屋" draggable="false" />
          </div>
          <section className="lb-tutorial-content">
            <p className="lb-kicker">Linking Balloons</p>
            <h1>{currentStage.title}完成</h1>
            <p>很好，準備走下一段小路。</p>
            <button type="button" className="lb-primary-button" onClick={goNextStage}>
              開始{nextStage?.title || "下一關"}
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="lb-simple-page">
      <LBResetStyle />
      <main className="lb-game-card">
        <header className="lb-game-top">
          <div>
            <p className="lb-kicker">LB 測驗</p>
            <h1>{currentStage.title}</h1>
          </div>
</header>

        <section className="lb-progress-wrap" aria-label="目前進度">
          <div className="lb-progress-bar">
            <div style={{ width: `${progressPercent}%` }} />
          </div>
        </section>

        <section className="lb-play-board" onClick={handleBlankClick}>
          <img className="lb-map-home" src={homeImg} alt="終點小屋" draggable="false" />
          {displayItems.map((item) => (
            <DoorplateButton
              key={item.key}
              item={item}
              disabled={isLocked}
              completed={completedKeys.includes(item.key)}
              isWrong={wrongKey === item.key}
              isCorrect={correctKey === item.key}
              onClick={handleNumberClick}
            />
          ))}
        </section>

        <footer className="lb-game-footer">
          <div className="lb-message">
            <strong>{message}</strong>
          </div>

          <button
            type="button"
            className="lb-submit-button"
            onClick={handleSubmitStage}
            disabled={!stageDone || isLocked}
          >
            {stageIndex + 1 >= STAGES.length ? "看結果" : "提交答案"}
          </button>
        </footer>
      </main>
    </div>
  );
}

function LBResetStyle() {
  return (
    <style>{`
      .lb-simple-page,
      .lb-simple-page * {
        box-sizing: border-box;
      }

      .lb-simple-page {
        width: 100%;
        min-height: 100dvh;
        height: 100dvh;
        padding: clamp(10px, 1.4vw, 18px);
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 50% 22%, rgba(255, 255, 220, 0.25) 0%, rgba(255, 255, 255, 0.08) 42%, rgba(69, 118, 38, 0.08) 100%),
          linear-gradient(rgba(241, 255, 237, 0.18), rgba(255, 248, 222, 0.22)),
          url(${backgroundImg});
        background-size: cover;
        background-position: center;
        overflow: hidden;
        font-family:
          'jf-openhuninn',
          'Fredoka',
          'Nunito',
          'Noto Sans TC',
          'Microsoft JhengHei',
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;
        touch-action: manipulation;
      }

      .lb-simple-card,
      .lb-game-card {
        position: relative;
        width: min(1180px, calc(100vw - clamp(20px, 2.8vw, 36px)));
        max-width: calc(100vw - clamp(20px, 2.8vw, 36px));
        border: clamp(4px, 0.65vw, 6px) solid #f6a51f;
        outline: 3px solid rgba(255, 132, 38, 0.86);
        outline-offset: -12px;
        border-radius: clamp(34px, 4.6vw, 56px);
        background:
          linear-gradient(180deg, rgba(255, 252, 225, 0.985) 0%, rgba(255, 242, 185, 0.985) 52%, rgba(255, 229, 145, 0.985) 100%);
        box-shadow:
          0 14px 0 rgba(194, 125, 33, 0.13),
          0 24px 42px rgba(86, 61, 27, 0.18),
          inset 0 0 0 7px rgba(255, 255, 255, 0.42),
          inset 0 0 0 15px rgba(255, 215, 105, 0.16);
        overflow: hidden;
      }

      .lb-simple-card::before,
      .lb-game-card::before {
        content: '';
        position: absolute;
        inset: clamp(12px, 1.6vw, 18px);
        border-radius: clamp(24px, 3.6vw, 42px);
        border: 2px dashed rgba(230, 170, 67, 0.42);
        pointer-events: none;
        z-index: 0;
      }

      .lb-simple-card::after,
      .lb-game-card::after {
        content: '';
        position: absolute;
        left: 34px;
        right: 34px;
        bottom: 13px;
        height: 34px;
        pointer-events: none;
        background:
          radial-gradient(circle at 4% 40%, #8bc947 0 12px, transparent 13px),
          radial-gradient(circle at 8% 15%, #a4da58 0 8px, transparent 9px),
          radial-gradient(circle at 92% 42%, #8bc947 0 12px, transparent 13px),
          radial-gradient(circle at 88% 18%, #a4da58 0 8px, transparent 9px);
        opacity: 0.82;
        z-index: 0;
      }

      .lb-simple-card > *,
      .lb-game-card > * {
        position: relative;
        z-index: 1;
        min-width: 0;
      }

      .lb-simple-card {
        height: min(690px, calc(100dvh - clamp(22px, 3vw, 38px)));
        min-height: 0;
        padding: clamp(22px, 3.4vw, 44px) clamp(28px, 4.6vw, 58px);
        display: grid;
        grid-template-columns: minmax(220px, 0.88fr) minmax(430px, 1.12fr);
        align-items: center;
        justify-content: center;
        gap: clamp(22px, 4vw, 52px);
        text-align: left;
      }

      .lb-intro-visual {
        min-width: 0;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .lb-intro-sheep {
        width: min(250px, 24vw);
        max-width: 100%;
        max-height: min(280px, 46vh);
        object-fit: contain;
        border: 0;
        background: transparent;
        filter:
          drop-shadow(0 16px 20px rgba(78, 57, 28, 0.22))
          drop-shadow(0 0 18px rgba(255, 223, 112, 0.32));
        animation: lbFloat 2.8s ease-in-out infinite;
      }

      .lb-stage-card {
        grid-template-columns: minmax(210px, 0.85fr) minmax(390px, 1.15fr);
        text-align: left;
      }

      .lb-stage-home {
        width: min(260px, 30vw);
        max-height: min(240px, 42vh);
        object-fit: contain;
        filter: drop-shadow(0 16px 18px rgba(78, 57, 28, 0.20));
      }

      .lb-tutorial-content {
        width: 100%;
        min-width: 0;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: clamp(8px, 1.3vh, 12px);
      }

      .lb-stage-card .lb-tutorial-content {
        align-items: flex-start;
      }

      .lb-kicker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 6px 16px;
        border-radius: 999px;
        border: 2px solid rgba(243, 181, 75, 0.56);
        background: linear-gradient(180deg, #fff5c9, #ffe28c);
        color: #8a531d;
        font-size: clamp(14px, 1.35vw, 18px);
        font-weight: 950;
        letter-spacing: 0.06em;
        box-shadow: inset 0 -3px 0 rgba(140, 92, 35, 0.12);
      }

      .lb-intro-card h1,
      .lb-stage-card h1,
      .lb-game-top h1 {
        margin: 0;
        color: #744018;
        font-size: clamp(30px, 4.1vw, 50px);
        font-weight: 950;
        line-height: 1.05;
        letter-spacing: 0.035em;
        text-shadow: 0 3px 0 rgba(255, 255, 255, 0.78);
      }

      .lb-intro-text,
      .lb-stage-card p,
      .lb-game-top p,
      .lb-tutorial-text {
        margin: 0;
        color: #5d3f22;
        font-size: clamp(16px, 1.8vw, 22px);
        font-weight: 850;
        line-height: 1.42;
      }

      .lb-tutorial-text {
        width: 100%;
        padding: clamp(10px, 1.3vw, 14px) clamp(14px, 1.7vw, 20px);
        border: 4px solid #f0c77b;
        border-radius: 24px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }


      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {        width: 100%;
        max-width: 100%;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: clamp(8px, 1.2vw, 14px);
        padding: clamp(12px, 1.5vw, 18px);
        border-radius: 30px;
        border: 4px solid rgba(113, 144, 60, 0.35);
        background:
          radial-gradient(circle at 20% 15%, rgba(255,255,255,0.72), transparent 28%),
          linear-gradient(180deg, rgba(206, 238, 161, 0.9), rgba(151, 211, 119, 0.92));
        box-shadow:
          inset 0 10px 22px rgba(255, 255, 255, 0.36),
          inset 0 -12px 24px rgba(57, 105, 49, 0.14),
          0 10px 18px rgba(87, 81, 38, 0.12);
        overflow: visible;
      }

      .lb-tutorial-chip {
        width: 100%;
        min-width: 0;
        min-height: clamp(58px, 8.2vh, 78px);
        border: 4px solid rgba(255, 255, 255, 0.86);
        outline: 3px solid #e9a33c;
        border-radius: 24px;
        background:
          linear-gradient(180deg, #fff8d0 0%, #ffe28c 58%, #ffc657 100%);
        color: #744018;
        font-family: inherit;
        font-size: clamp(23px, 2.6vw, 34px);
        font-weight: 950;
        cursor: pointer;
        box-shadow:
          0 7px 0 rgba(178, 103, 21, 0.22),
          0 14px 22px rgba(91, 57, 18, 0.13),
          inset 0 4px 0 rgba(255, 255, 255, 0.48),
          inset 0 -5px 0 rgba(177, 116, 20, 0.12);
        transition: transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease;
      }

      .lb-tutorial-chip.is-red {
        outline-color: #e1705d;
        background: linear-gradient(180deg, #ffe6df 0%, #ffb3a6 58%, #ef705d 100%);
        color: #8f2e24;
      }

      .lb-tutorial-chip.is-blue {
        outline-color: #4c9bdc;
        background: linear-gradient(180deg, #e6f3ff 0%, #b9dcff 58%, #55a3e0 100%);
        color: #1e5a93;
      }

      .lb-tutorial-chip:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.025);
        filter: brightness(1.05);
      }

      .lb-tutorial-chip:active:not(:disabled) {
        transform: translateY(1px) scale(0.98);
      }

      .lb-tutorial-chip.is-expected {
        filter: drop-shadow(0 0 14px rgba(255, 215, 91, 0.72));
      }

      .lb-tutorial-chip.is-completed {
        opacity: 0.48;
        filter: grayscale(0.16);
        transform: translateY(5px);
        box-shadow:
          0 2px 0 rgba(178, 103, 21, 0.20),
          inset 0 4px 0 rgba(255, 255, 255, 0.42);
      }

      .lb-tutorial-chip.is-success {
        animation: lbPop 0.32s cubic-bezier(.18, .89, .32, 1.28);
        filter: drop-shadow(0 0 18px rgba(255, 223, 73, 0.95));
      }

      .lb-tutorial-chip.is-error {
        animation: lbChipShake 0.30s ease;
        filter: drop-shadow(0 0 16px rgba(255, 95, 95, 0.86));
      }

      .lb-tutorial-message {
        width: 100%;
        min-height: 28px;
        margin: 0;
        color: #7a4a1a;
        font-size: clamp(15px, 1.55vw, 19px);
        font-weight: 900;
        line-height: 1.35;
      }

      .lb-tutorial-message.is-done {
        color: #4f7d3a;
      }

      .lb-tutorial-dots {
        display: flex;
        gap: 9px;
        align-items: center;
      }

      .lb-tutorial-dots span {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: rgba(138, 83, 29, 0.22);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
      }

      .lb-tutorial-dots span.is-active {
        width: 30px;
        background: linear-gradient(90deg, #8ed36f, #f7c44c);
      }

      .lb-tutorial-actions {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        margin-top: 2px;
      }

      .lb-primary-button,
      .lb-secondary-button,
      .lb-submit-button {
        position: relative;
        border: 4px solid rgba(255, 255, 255, 0.86);
        border-radius: 22px;
        color: #ffffff;
        font-family: inherit;
        font-weight: 950;
        line-height: 1.15;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
        text-shadow: 0 3px 0 rgba(35, 96, 36, 0.32), 0 0 8px rgba(35, 96, 36, 0.18);
      }

      .lb-primary-button,
      .lb-submit-button {
        outline: 3px solid #5d9d32;
        background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
        box-shadow:
          0 7px 0 #377721,
          0 14px 22px rgba(61, 97, 33, 0.20),
          inset 0 4px 0 rgba(255,255,255,0.48),
          inset 0 -5px 0 rgba(49, 128, 31, 0.26);
      }

      .lb-secondary-button {
        outline: 3px solid #d28525;
        background: linear-gradient(180deg, #ffd868 0%, #f6a83b 52%, #d97a25 100%);
        box-shadow:
          0 7px 0 #a85e1d,
          0 14px 22px rgba(97, 65, 33, 0.18),
          inset 0 4px 0 rgba(255,255,255,0.42),
          inset 0 -5px 0 rgba(143, 76, 20, 0.22);
      }

      .lb-primary-button,
      .lb-secondary-button {
        min-width: 134px;
        min-height: 56px;
        padding: 10px 22px;
        font-size: clamp(18px, 2vw, 26px);
        white-space: nowrap;
      }

      .lb-primary-button:hover:not(:disabled),
      .lb-secondary-button:hover:not(:disabled),
      .lb-submit-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.025);
        filter: brightness(1.05);
      }

      .lb-primary-button:active:not(:disabled),
      .lb-secondary-button:active:not(:disabled),
      .lb-submit-button:active:not(:disabled) {
        transform: translateY(1px) scale(0.98);
      }

      .lb-primary-button:disabled,
      .lb-secondary-button:disabled,
      .lb-submit-button:disabled {
        opacity: 0.48;
        cursor: not-allowed;
        filter: grayscale(0.28);
      }

      .lb-game-card {
        height: min(740px, calc(100dvh - clamp(20px, 2.8vw, 34px)));
        min-height: 0;
        padding: clamp(16px, 2vw, 28px);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .lb-game-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 4px 12px 0;
        flex: 0 0 auto;
      }

      .lb-game-top h1 {
        font-size: clamp(28px, 3.6vw, 44px);
      }

      .lb-game-top p {
        margin-top: 5px;
        font-size: clamp(15px, 1.55vw, 19px);
      }

      .lb-progress-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        color: #7a5730;
        font-size: clamp(15px, 1.5vw, 19px);
        font-weight: 950;
        flex: 0 0 auto;
      }

      .lb-progress-bar {
        flex: 1;
        height: 16px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(127, 91, 45, 0.18);
        box-shadow:
          inset 0 2px 4px rgba(83, 60, 24, 0.16),
          0 2px 0 rgba(255,255,255,0.55);
        overflow: hidden;
      }

      .lb-progress-bar div {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #8ed36f 0%, #f7c44c 58%, #ffb545 100%);
        box-shadow: 0 0 14px rgba(247, 196, 76, 0.42);
        transition: width 0.2s ease;
      }

      .lb-play-board {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        border-radius: 36px;
        background:
          radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.72), transparent 26%),
          radial-gradient(circle at 80% 10%, rgba(255, 240, 154, 0.35), transparent 22%),
          linear-gradient(180deg, rgba(195, 232, 150, 0.92), rgba(126, 200, 108, 0.94));
        border: 5px solid rgba(255, 255, 255, 0.72);
        outline: 4px solid rgba(91, 147, 56, 0.45);
        outline-offset: -10px;
        overflow: hidden;
        box-shadow:
          0 12px 0 rgba(89, 134, 53, 0.10),
          inset 0 14px 26px rgba(255, 255, 255, 0.38),
          inset 0 -18px 32px rgba(57, 105, 49, 0.16);
      }

      .lb-play-board::before {
        content: '';
        position: absolute;
        inset: auto -10% -28% -10%;
        height: 48%;
        border-radius: 50% 50% 0 0;
        background:
          radial-gradient(circle at 18% 38%, rgba(255,255,255,0.14), transparent 10%),
          linear-gradient(180deg, rgba(104, 174, 82, 0.42), rgba(77, 145, 68, 0.38));
        pointer-events: none;
      }

      .lb-play-board::after {
        content: '';
        position: absolute;
        inset: 24px;
        border-radius: 30px;
        border: 2px dashed rgba(255, 255, 255, 0.36);
        pointer-events: none;
      }

      .lb-map-home {
        position: absolute;
        right: 4%;
        bottom: 4%;
        width: clamp(86px, 11vw, 140px);
        max-height: 140px;
        object-fit: contain;
        z-index: 1;
        opacity: 0.96;
        filter: drop-shadow(0 12px 14px rgba(54, 82, 42, 0.22));
        pointer-events: none;
      }

      .lb-doorplate {
        position: absolute;
        z-index: 3;
        width: clamp(54px, 6.7vw, 82px);
        height: clamp(54px, 6.7vw, 82px);
        transform: translate(-50%, -50%);
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 0;
        transition: transform 0.12s ease, filter 0.12s ease, opacity 0.12s ease;
      }

      .lb-doorplate img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        filter:
          drop-shadow(0 8px 0 rgba(144, 84, 31, 0.10))
          drop-shadow(0 12px 12px rgba(80, 58, 31, 0.20));
      }

      .lb-doorplate span {
        position: absolute;
        left: 50%;
        top: 49%;
        transform: translate(-50%, -50%);
        min-width: clamp(30px, 3.4vw, 40px);
        height: clamp(30px, 3.4vw, 40px);
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5b3818;
        background: linear-gradient(180deg, #fff8d9 0%, #ffe8a8 100%);
        border: 3px solid rgba(255, 255, 255, 0.82);
        outline: 2px solid rgba(128, 87, 33, 0.18);
        font-size: clamp(19px, 2.3vw, 29px);
        font-weight: 950;
        line-height: 1;
        text-shadow: 0 2px 0 rgba(255,255,255,0.78);
        box-shadow:
          0 3px 0 rgba(144, 84, 31, 0.12),
          inset 0 -3px 0 rgba(165, 102, 31, 0.10);
      }

      .lb-doorplate-red span {
        background: linear-gradient(180deg, #ffe5df 0%, #ffb0a4 100%);
        color: #9e3328;
        outline-color: rgba(177, 56, 42, 0.26);
      }

      .lb-doorplate-blue span {
        background: linear-gradient(180deg, #e5f3ff 0%, #b9dcff 100%);
        color: #1f5f9f;
        outline-color: rgba(39, 99, 170, 0.26);
      }

      .lb-doorplate:hover:not(:disabled) {
        transform: translate(-50%, -50%) scale(1.055);
        filter: brightness(1.06) drop-shadow(0 0 12px rgba(255, 226, 94, 0.48));
      }

      .lb-doorplate.is-completed {
        opacity: 0.34;
        pointer-events: none;
        filter: grayscale(0.25);
      }

      .lb-doorplate.is-correct {
        transform: translate(-50%, -50%) scale(1.14);
        filter:
          brightness(1.15)
          drop-shadow(0 0 18px rgba(255, 212, 73, 0.95));
      }

      .lb-doorplate.is-wrong {
        animation: lbShake 0.30s ease;
        filter:
          brightness(0.95)
          drop-shadow(0 0 16px rgba(255, 95, 95, 0.90));
      }

      .lb-game-footer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        flex: 0 0 auto;
      }

      .lb-message {
        min-width: 0;
        min-height: 58px;
        padding: 10px 18px;
        border-radius: 26px;
        background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,249,230,0.92));
        border: 4px solid #f0c77b;
        color: #674522;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        box-shadow:
          0 8px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.32);
      }

      .lb-message strong {
        font-size: clamp(15px, 1.7vw, 20px);
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .lb-message span {
        flex: 0 0 auto;
        min-width: 70px;
        text-align: center;
        padding: 7px 12px;
        border-radius: 999px;
        background: linear-gradient(180deg, #fff5c9, #ffe28c);
        color: #8a531d;
        font-size: clamp(16px, 1.8vw, 22px);
        font-weight: 950;
        box-shadow: inset 0 -3px 0 rgba(140, 92, 35, 0.12);
      }

      .lb-submit-button {
        min-width: 150px;
        min-height: 58px;
        padding: 11px 22px;
        font-size: clamp(18px, 2vw, 25px);
        white-space: nowrap;
      }

      @keyframes lbFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      @keyframes lbPop {
        0% { transform: scale(1); }
        55% { transform: scale(1.12); }
        100% { transform: scale(1); }
      }

      @keyframes lbShake {
        0%, 100% { transform: translate(-50%, -50%); }
        25% { transform: translate(calc(-50% - 7px), -50%); }
        75% { transform: translate(calc(-50% + 7px), -50%); }
      }

      @keyframes lbChipShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-7px); }
        75% { transform: translateX(7px); }
      }

      @media (max-width: 920px) {
        .lb-simple-card {
          width: calc(100vw - 20px);
          max-width: calc(100vw - 20px);
          height: calc(100dvh - 20px);
          padding: 22px 24px;
          grid-template-columns: minmax(150px, 0.72fr) minmax(0, 1.28fr);
          gap: 22px;
          border-radius: 34px;
          outline-offset: -9px;
        }

        .lb-intro-sheep {
          width: min(190px, 23vw);
          max-height: 220px;
        }

        .lb-intro-card h1,
        .lb-stage-card h1,
        .lb-game-top h1 {
          font-size: clamp(27px, 4.4vw, 40px);
        }

        .lb-intro-text,
        .lb-stage-card p,
        .lb-game-top p,
        .lb-tutorial-text {
          font-size: clamp(15px, 2vw, 19px);
        }

  
      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {          gap: 8px;
          padding: 12px;
        }

        .lb-tutorial-chip {
          min-height: 56px;
          font-size: clamp(21px, 3.2vw, 29px);
          border-radius: 20px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-width: 116px;
          min-height: 50px;
          padding: 9px 18px;
          font-size: clamp(17px, 2.4vw, 23px);
        }

        .lb-game-card {
          width: calc(100vw - 20px);
          max-width: calc(100vw - 20px);
          height: calc(100dvh - 20px);
          padding: 15px;
          border-radius: 34px;
          outline-offset: -9px;
        }

        .lb-doorplate {
          width: clamp(48px, 6.5vw, 62px);
          height: clamp(48px, 6.5vw, 62px);
        }

        .lb-doorplate span {
          min-width: 28px;
          height: 28px;
          font-size: 19px;
          border-width: 2px;
        }
      }

      @media (max-height: 650px) {
        .lb-simple-card {
          height: calc(100dvh - 20px);
          padding-top: 18px;
          padding-bottom: 18px;
          gap: 20px;
        }

        .lb-tutorial-content {
          gap: 7px;
        }

        .lb-intro-sheep {
          max-height: 190px;
        }

        .lb-tutorial-chip {
          min-height: 50px;
          font-size: clamp(20px, 2.5vw, 28px);
        }

        .lb-tutorial-text {
          padding-top: 9px;
          padding-bottom: 9px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-height: 46px;
        }

        .lb-game-card {
          height: calc(100dvh - 20px);
          padding: 14px;
          gap: 9px;
        }

        .lb-game-top p:not(.lb-kicker) {
          display: none;
        }

        .lb-message,
        .lb-submit-button {
          min-height: 52px;
        }
      }

      @media (max-width: 720px) {
        .lb-simple-page {
          overflow: hidden;
        }

        .lb-simple-card {
          grid-template-columns: minmax(96px, 0.55fr) minmax(0, 1.45fr);
          padding: 18px;
          gap: 14px;
        }

        .lb-intro-sheep,
        .lb-stage-home {
          width: min(132px, 23vw);
          max-height: 160px;
        }

        .lb-kicker {
          font-size: 12px;
          padding: 5px 12px;
        }

  
      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {          border-width: 3px;
          border-radius: 22px;
          padding: 9px;
        }

        .lb-tutorial-chip {
          min-height: 48px;
          border-width: 3px;
          outline-width: 2px;
          border-radius: 18px;
        }

        .lb-tutorial-message {
          font-size: 13px;
        }

        .lb-tutorial-actions {
          gap: 8px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-width: 96px;
          min-height: 44px;
          padding: 8px 12px;
          border-width: 3px;
          outline-width: 2px;
          border-radius: 18px;
          font-size: 16px;
        }

        .lb-game-footer {
          grid-template-columns: 1fr auto;
          gap: 9px;
        }

        .lb-message {
          padding: 8px 12px;
          border-radius: 22px;
        }

        .lb-message strong {
          font-size: 14px;
        }

        .lb-message span {
          min-width: 58px;
          font-size: 16px;
        }

        .lb-submit-button {
          min-width: 116px;
          padding: 8px 14px;
          font-size: 17px;
        }
      }
    
    `}</style>
  );
}

export default TestPageLB;
