import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import capImage from "../asset/cap.png";
import startButtonImage from "../asset/home/start.png";
import againButtonImage from "../asset/home/again.png";
import backHomeButtonImage from "../asset/home/backhome.png";

import stickerR1 from "../asset/sticker/regular/R1.png";
import stickerR2 from "../asset/sticker/regular/R2.png";
import stickerR3 from "../asset/sticker/regular/R3.png";
import stickerR4 from "../asset/sticker/regular/R4.png";
import stickerR5 from "../asset/sticker/regular/R5.png";
import stickerR6 from "../asset/sticker/regular/R6.png";
import stickerR7 from "../asset/sticker/regular/R7.png";
import stickerR8 from "../asset/sticker/regular/R8.png";
import stickerR9 from "../asset/sticker/regular/R9.png";
import stickerR10 from "../asset/sticker/regular/R10.png";
import stickerR11 from "../asset/sticker/regular/R11.png";
import stickerR12 from "../asset/sticker/regular/R12.png";
import stickerR13 from "../asset/sticker/regular/R13.png";
import stickerR14 from "../asset/sticker/regular/R14.png";
import stickerR15 from "../asset/sticker/regular/R15.png";
import stickerR16 from "../asset/sticker/regular/R16.png";
import stickerR17 from "../asset/sticker/regular/R17.png";
import stickerR18 from "../asset/sticker/regular/R18.png";
import stickerR19 from "../asset/sticker/regular/R19.png";
import stickerR20 from "../asset/sticker/regular/R20.png";
import stickerR21 from "../asset/sticker/regular/R21.png";
import stickerR22 from "../asset/sticker/regular/R22.png";
import stickerR23 from "../asset/sticker/regular/R23.png";

const MAX_ROUNDS = 5;
const MAP_ROUTE = "/game-menu";

const PHASE = Object.freeze({
  READY: "ready",
  PREVIEW: "preview",
  SHUFFLING: "shuffling",
  CHOOSE: "choose",
  RESULT: "result",
});

const ROUND_CONFIG = [
  { hatCount: 3, swaps: 2, duration: 760 },
  { hatCount: 4, swaps: 3, duration: 680 },
  { hatCount: 5, swaps: 4, duration: 590 },
  { hatCount: 6, swaps: 5, duration: 510 },
  { hatCount: 7, swaps: 6, duration: 440 },
];

function createHats(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `hat-${index}`,
    slot: index,
  }));
}

const STICKERS = [
  { id: "R1", image: stickerR1, name: "蜂蜜小熊" },
  { id: "R2", image: stickerR2, name: "森林狐狸" },
  { id: "R3", image: stickerR3, name: "快樂小雞" },
  { id: "R4", image: stickerR4, name: "森林小兔" },
  { id: "R5", image: stickerR5, name: "花角小鹿" },
  { id: "R6", image: stickerR6, name: "藍羽小鳥" },
  { id: "R7", image: stickerR7, name: "點心狐狸" },
  { id: "R8", image: stickerR8, name: "蜂蜜刺蝟" },
  { id: "R9", image: stickerR9, name: "勤勞蜜蜂" },
  { id: "R10", image: stickerR10, name: "森林花朵" },
  { id: "R11", image: stickerR11, name: "森林木屋" },
  { id: "R12", image: stickerR12, name: "蜂蜜小屋" },
  { id: "R13", image: stickerR13, name: "蜂蜜罐" },
  { id: "R14", image: stickerR14, name: "花朵提籃" },
  { id: "R15", image: stickerR15, name: "森林樹樁" },
  { id: "R16", image: stickerR16, name: "溫暖提燈" },
  { id: "R17", image: stickerR17, name: "森林松鼠" },
  { id: "R18", image: stickerR18, name: "花朵刺蝟" },
  { id: "R19", image: stickerR19, name: "智慧貓頭鷹" },
  { id: "R20", image: stickerR20, name: "池塘青蛙" },
  { id: "R21", image: stickerR21, name: "紅色蘑菇" },
  { id: "R22", image: stickerR22, name: "向日葵花束" },
  { id: "R23", image: stickerR23, name: "森林寶箱" },
];

function safeParse(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function randomInteger(max) {
  return Math.floor(Math.random() * max);
}

function randomDifferentPair(count) {
  const first = randomInteger(count);
  let second = randomInteger(count);

  while (second === first) {
    second = randomInteger(count);
  }

  return [first, second];
}

function resolveChildId(locationState) {
  const stateChildId =
    locationState?.childId ||
    locationState?.child?.id ||
    locationState?.currentChild?.id;

  if (stateChildId) return String(stateChildId);

  const possibleKeys = [
    "currentChildId",
    "selectedChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value && value !== "null" && value !== "undefined") {
      return value;
    }
  }

  const possibleObjects = [
    "currentChild",
    "selectedChild",
    "activeChild",
  ];

  for (const key of possibleObjects) {
    const parsed = safeParse(localStorage.getItem(key), null);

    if (parsed?.id) {
      return String(parsed.id);
    }
  }

  return "unassigned";
}

function createFallbackSessionId() {
  return `hat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function HatStickerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const childId = useMemo(
    () => resolveChildId(location.state),
    [location.state]
  );

  const initialSessionId = useMemo(() => {
    return (
      location.state?.rewardSessionId ||
      location.state?.sessionId ||
      sessionStorage.getItem(`activeHatSession_${childId}`) ||
      createFallbackSessionId()
    );
  }, [childId, location.state]);

  const [rewardSessionId] = useState(initialSessionId);
  const [phase, setPhase] = useState(PHASE.READY);
  const [round, setRound] = useState(1);
  const [hats, setHats] = useState(() => createHats(3));
  const [winningHatId, setWinningHatId] = useState(null);
  const [selectedHatId, setSelectedHatId] = useState(null);
  const [currentSticker, setCurrentSticker] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [awardedCount, setAwardedCount] = useState(0);

  const timerIdsRef = useRef([]);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  const roundConfig =
    ROUND_CONFIG[Math.min(round - 1, ROUND_CONFIG.length - 1)];

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });

    timerIdsRef.current = [];
  }, []);

  const wait = useCallback((duration) => {
    return new Promise((resolve) => {
      const timerId = window.setTimeout(resolve, duration);
      timerIdsRef.current.push(timerId);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    sessionStorage.setItem(
      `activeHatSession_${childId}`,
      rewardSessionId
    );

    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      clearTimers();
    };
  }, [childId, clearTimers, rewardSessionId]);

  const collectionStorageKey = useMemo(
    () => `hatStickerCollection_${childId}`,
    [childId]
  );

  const claimedStorageKey = useMemo(
    () => `hatStickerClaims_${childId}`,
    [childId]
  );

  const getClaimId = useCallback(
    (roundNumber) => `${rewardSessionId}:round-${roundNumber}`,
    [rewardSessionId]
  );

  const awardSticker = useCallback(
    (sticker, roundNumber) => {
      if (!sticker) return false;

      const claimId = getClaimId(roundNumber);
      const claims = safeParse(
        localStorage.getItem(claimedStorageKey),
        {}
      );

      if (claims[claimId]) {
        return false;
      }

      const collection = safeParse(
        localStorage.getItem(collectionStorageKey),
        {}
      );

      const previousItem = collection[sticker.id] || {
        stickerId: sticker.id,
        name: sticker.name,
        count: 0,
        firstObtainedAt: null,
        lastObtainedAt: null,
        source: "hat-game",
      };

      const obtainedAt = new Date().toISOString();

      collection[sticker.id] = {
        ...previousItem,
        count: Number(previousItem.count || 0) + 1,
        firstObtainedAt:
          previousItem.firstObtainedAt || obtainedAt,
        lastObtainedAt: obtainedAt,
      };

      claims[claimId] = {
        claimId,
        rewardSessionId,
        childId,
        stickerId: sticker.id,
        round: roundNumber,
        claimedAt: obtainedAt,
      };

      try {
        localStorage.setItem(
          collectionStorageKey,
          JSON.stringify(collection)
        );

        localStorage.setItem(
          claimedStorageKey,
          JSON.stringify(claims)
        );

        window.dispatchEvent(
          new CustomEvent("stickerCollectionUpdated", {
            detail: {
              childId,
              stickerId: sticker.id,
              count: collection[sticker.id].count,
            },
          })
        );

        return true;
      } catch (error) {
        console.error("貼紙儲存失敗：", error);
        return false;
      }
    },
    [
      childId,
      claimedStorageKey,
      collectionStorageKey,
      getClaimId,
      rewardSessionId,
    ]
  );

  const swapHatSlots = useCallback((firstSlot, secondSlot) => {
    setHats((previousHats) =>
      previousHats.map((hat) => {
        if (hat.slot === firstSlot) {
          return { ...hat, slot: secondSlot };
        }

        if (hat.slot === secondSlot) {
          return { ...hat, slot: firstSlot };
        }

        return hat;
      })
    );
  }, []);

  const beginRound = useCallback(async () => {
    if (runningRef.current) return;

    runningRef.current = true;
    clearTimers();

    const roundHats = createHats(roundConfig.hatCount);
    const selectedSticker = STICKERS[randomInteger(STICKERS.length)];
    const selectedWinningHatId =
      roundHats[randomInteger(roundHats.length)].id;

    setHats(roundHats);
    setCurrentSticker(selectedSticker);
    setWinningHatId(selectedWinningHatId);
    setSelectedHatId(null);
    setIsCorrect(false);
    setPhase(PHASE.PREVIEW);

    // 顯示貼紙位置 3 秒後，自動開始交換。
    await wait(3000);

    if (!mountedRef.current) return;

    setPhase(PHASE.SHUFFLING);

    for (let index = 0; index < roundConfig.swaps; index += 1) {
      const [firstSlot, secondSlot] = randomDifferentPair(
        roundConfig.hatCount
      );

      swapHatSlots(firstSlot, secondSlot);

      await wait(roundConfig.duration);

      if (!mountedRef.current) return;
    }

    await wait(250);

    if (!mountedRef.current) return;

    setPhase(PHASE.CHOOSE);
    runningRef.current = false;
  }, [
    clearTimers,
    roundConfig.duration,
    roundConfig.hatCount,
    roundConfig.swaps,
    swapHatSlots,
    wait,
  ]);

  const handleHatClick = useCallback(
    (hatId) => {
      if (phase !== PHASE.CHOOSE || runningRef.current) return;

      runningRef.current = true;

      const guessedCorrectly = hatId === winningHatId;

      setSelectedHatId(hatId);
      setIsCorrect(guessedCorrectly);
      setPhase(PHASE.RESULT);

      if (guessedCorrectly) {
        const wasAwarded = awardSticker(currentSticker, round);

        if (wasAwarded) {
          setAwardedCount((count) => count + 1);
        }
      }

      runningRef.current = false;
    },
    [
      awardSticker,
      currentSticker,
      phase,
      round,
      winningHatId,
    ]
  );

  const handleNextRound = useCallback(() => {
    if (!isCorrect || round >= MAX_ROUNDS) return;

    const nextRound = round + 1;
    const nextConfig = ROUND_CONFIG[nextRound - 1];

    clearTimers();
    runningRef.current = false;
    setRound(nextRound);
    setHats(createHats(nextConfig.hatCount));
    setWinningHatId(null);
    setSelectedHatId(null);
    setCurrentSticker(null);
    setIsCorrect(false);
    setPhase(PHASE.READY);
  }, [clearTimers, isCorrect, round]);

  const handleReturnToMap = useCallback(() => {
    sessionStorage.removeItem(`activeHatSession_${childId}`);

    navigate(MAP_ROUTE, {
      replace: true,
      state: {
        fromHatStickerGame: true,
        rewardSessionId,
        awardedStickerCount: awardedCount,
      },
    });
  }, [
    awardedCount,
    childId,
    navigate,
    rewardSessionId,
  ]);

  const resultTitle = isCorrect
    ? "找到貼紙了！"
    : "這次藏在別頂帽子裡";

  const resultMessage = isCorrect
    ? `你獲得了「${currentSticker?.name || "森林貼紙"}」！`
    : "沒關係，仔細看看貼紙藏在哪裡。";

  return (
    <main className="hat-game-page">
      <div className="hat-game-overlay" />

      <section
        className="hat-game-content"
        aria-label="猜帽子貼紙遊戲"
      >
        <button
          type="button"
          className="hat-close-button"
          onClick={handleReturnToMap}
          aria-label="退出帽子遊戲"
          title="退出遊戲"
        >
          ×
        </button>
        <header className="hat-game-header">
          <h1>貼紙藏在哪頂帽子下面？</h1>

          <p className="hat-game-instruction" aria-live="polite">
            {phase === PHASE.READY && "準備好後，看看貼紙藏在哪裡。"}
            {phase === PHASE.PREVIEW && "記住貼紙下面的帽子！"}
            {phase === PHASE.SHUFFLING && "帽子正在交換位置……"}
            {phase === PHASE.CHOOSE && "請選一頂帽子。"}
            {phase === PHASE.RESULT && resultMessage}
          </p>
        </header>

        <div
            className={`hat-stage hat-stage--${phase}`}
            aria-busy={phase === PHASE.SHUFFLING}
          >
            <div
              className="hat-track"
              style={{ "--hat-count": roundConfig.hatCount }}
            >
              {hats.map((hat) => {
                const isWinningHat = hat.id === winningHatId;
                const isSelected = hat.id === selectedHatId;
                const shouldRevealSticker =
                  isWinningHat &&
                  (phase === PHASE.PREVIEW ||
                    phase === PHASE.RESULT);

                return (
                  <button
                    key={hat.id}
                    type="button"
                    className={[
                      "hat-item",
                      phase === PHASE.CHOOSE
                        ? "hat-item--selectable"
                        : "",
                      isSelected ? "hat-item--selected" : "",
                      phase === PHASE.RESULT && isWinningHat
                        ? "hat-item--answer"
                        : "",
                      phase === PHASE.RESULT &&
                      isSelected &&
                      !isWinningHat
                        ? "hat-item--wrong"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      "--hat-slot": hat.slot,
                      "--swap-duration": `${roundConfig.duration}ms`,
                    }}
                    disabled={phase !== PHASE.CHOOSE}
                    onClick={() => handleHatClick(hat.id)}
                    aria-label={`選擇第 ${hat.slot + 1} 頂帽子`}
                  >
                    <div className="hat-object">
                      {shouldRevealSticker && currentSticker && (
                        <img
                          className="hidden-sticker"
                          src={currentSticker.image}
                          alt={currentSticker.name}
                          draggable="false"
                        />
                      )}

                      <img
                        className={`cap-image ${
                          shouldRevealSticker
                            ? "cap-image--raised"
                            : ""
                        }`}
                        src={capImage}
                        alt=""
                        draggable="false"
                      />

                      {phase === PHASE.CHOOSE && (
                        <span className="hat-question">？</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {phase === PHASE.SHUFFLING && (
              <div className="shuffle-lock">
                <span className="shuffle-spinner" />
                <span>交換中，先不要點帽子喔</span>
              </div>
            )}
          </div>

        <div className="hat-game-actions">
          {phase === PHASE.READY && (
            <button
              type="button"
              className="hat-start-button"
              onClick={beginRound}
              aria-label="開始遊戲"
            >
              <img
                src={startButtonImage}
                alt="開始遊戲"
                draggable="false"
              />
            </button>
          )}

          {phase === PHASE.RESULT && (
            <div className="result-panel">
              {isCorrect && currentSticker ? (
                <div className="reward-card reward-card--won">
                  <img
                    src={currentSticker.image}
                    alt={currentSticker.name}
                    draggable="false"
                  />

                  <div>
                    <strong>{resultTitle}</strong>
                    <span>{resultMessage}</span>
                  </div>
                </div>
              ) : (
                <div className="wrong-result-message">
                  <strong>{resultTitle}</strong>
                  <span>這次沒有獲得貼紙。</span>
                </div>
              )}

              <div className="result-buttons">
                {isCorrect && round < MAX_ROUNDS && (
                  <button
                    type="button"
                    className="hat-image-button"
                    onClick={handleNextRound}
                    aria-label="再玩一次"
                  >
                    <img
                      src={againButtonImage}
                      alt="再玩一次"
                      draggable="false"
                    />
                  </button>
                )}

                <button
                  type="button"
                  className="hat-image-button"
                  onClick={handleReturnToMap}
                  aria-label="回到森林"
                >
                  <img
                    src={backHomeButtonImage}
                    alt="回到森林"
                    draggable="false"
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <style>{`
        .hat-game-page {
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 28px 20px;
          box-sizing: border-box;
          isolation: isolate;
          color: #fff8df;
          font-family: inherit;
          background:
            radial-gradient(
              circle at 50% 38%,
              rgba(117, 86, 47, 0.18),
              rgba(0, 0, 0, 0.88) 72%
            );
        }

        .hat-game-overlay {
          position: absolute;
          inset: 0;
          z-index: -2;
          background: rgba(0, 0, 0, 0.76);
        }

        .hat-game-overlay::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(
              circle at 20% 25%,
              rgba(255, 220, 111, 0.09) 0 2px,
              transparent 3px
            ),
            radial-gradient(
              circle at 75% 35%,
              rgba(255, 255, 255, 0.07) 0 2px,
              transparent 3px
            ),
            radial-gradient(
              circle at 55% 75%,
              rgba(255, 204, 92, 0.08) 0 2px,
              transparent 3px
            );
          background-size: 140px 140px, 180px 180px, 210px 210px;
          animation: hatStarsMove 12s linear infinite;
        }

        .hat-game-content {
          width: min(1120px, 100%);
          min-height: min(760px, calc(100vh - 56px));
          padding: clamp(22px, 4vw, 48px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: none;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }


        .hat-close-button {
          position: absolute;
          top: 18px;
          right: 20px;
          z-index: 30;
          width: 54px;
          height: 54px;
          border: 3px solid rgba(255, 255, 255, 0.72);
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.48);
          color: #fff8df;
          font-size: 40px;
          font-weight: 800;
          line-height: 44px;
          cursor: pointer;
          transition: transform 160ms ease, background 160ms ease;
        }

        .hat-close-button:hover {
          transform: scale(1.08);
          background: rgba(120, 45, 35, 0.78);
        }

        .hat-close-button:active {
          transform: scale(0.94);
        }

        .hat-image-button {
          width: clamp(165px, 21vw, 255px);
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          cursor: pointer;
          transition: transform 180ms ease, filter 180ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        .hat-image-button img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.42));
        }

        .hat-image-button:hover {
          transform: translateY(-5px) scale(1.04);
          filter: brightness(1.08);
        }

        .hat-image-button:active {
          transform: translateY(1px) scale(0.97);
        }

        .wrong-result-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 18px 28px;
          border-radius: 22px;
          background: rgba(80, 30, 30, 0.62);
          text-align: center;
        }

        .wrong-result-message strong {
          font-size: clamp(24px, 3vw, 38px);
        }

        .wrong-result-message span {
          font-size: clamp(17px, 2vw, 24px);
        }

        .hat-game-header {
          width: 100%;
          text-align: center;
        }

        .hat-game-header h1 {
          margin: 0 0 10px;
          font-size: clamp(30px, 5vw, 54px);
          line-height: 1.15;
          letter-spacing: 0.04em;
          text-shadow:
            0 4px 0 rgba(86, 48, 15, 0.8),
            0 8px 22px rgba(0, 0, 0, 0.45);
        }

        .hat-game-instruction {
          min-height: 34px;
          margin: 0;
          color: #ffe9b8;
          font-size: clamp(18px, 2.5vw, 25px);
          font-weight: 800;
        }

        .hat-stage {
          position: relative;
          width: 100%;
          flex: 1;
          min-height: 390px;
          margin-top: 22px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .hat-track {
          position: relative;
          width: min(900px, 100%);
          height: 350px;
        }

        .hat-item {
          --hat-gap: calc(100% / var(--hat-count));
          position: absolute;
          left: calc(var(--hat-slot) * var(--hat-gap));
          bottom: 32px;
          width: var(--hat-gap);
          height: 290px;
          padding: 0;
          border: 0;
          display: flex;
          justify-content: center;
          align-items: flex-end;
          color: inherit;
          background: transparent;
          cursor: default;
          appearance: none;
          transition:
            left var(--swap-duration) cubic-bezier(0.42, 0, 0.2, 1),
            transform 180ms ease,
            filter 180ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        .hat-item:disabled {
          opacity: 1;
        }

        .hat-item--selectable {
          cursor: pointer;
        }

        .hat-item--selectable:hover {
          transform: translateY(-12px) scale(1.04);
          filter: drop-shadow(0 18px 12px rgba(0, 0, 0, 0.4));
        }

        .hat-item--selectable:focus-visible {
          outline: 5px solid #ffe583;
          outline-offset: -18px;
          border-radius: 50%;
        }

        .hat-item--selected .hat-object {
          animation: hatSelected 420ms ease;
        }

        .hat-item--answer .hat-object {
          filter:
            drop-shadow(0 0 10px #fff0a3)
            drop-shadow(0 0 26px rgba(255, 210, 76, 0.82));
        }

        .hat-item--wrong {
          animation: hatWrong 400ms ease;
        }

        .hat-object {
          position: relative;
          width: min(245px, 88%);
          height: 255px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .cap-image {
          position: relative;
          z-index: 3;
          width: 100%;
          max-height: 220px;
          object-fit: contain;
          user-select: none;
          pointer-events: none;
          filter: drop-shadow(0 18px 12px rgba(0, 0, 0, 0.48));
          transition: transform 420ms ease;
        }

        .cap-image--raised {
          transform: translateY(-74px) rotate(-5deg);
        }

        .hidden-sticker {
          position: absolute;
          z-index: 2;
          left: 50%;
          bottom: 5px;
          width: clamp(82px, 10vw, 118px);
          height: clamp(82px, 10vw, 118px);
          object-fit: contain;
          transform: translateX(-50%);
          pointer-events: none;
          user-select: none;
          animation: stickerReveal 460ms ease both;
          filter:
            drop-shadow(0 8px 7px rgba(0, 0, 0, 0.45))
            drop-shadow(0 0 12px rgba(255, 231, 143, 0.72));
        }

        .hat-question {
          position: absolute;
          z-index: 5;
          left: 50%;
          top: 40%;
          transform: translate(-50%, -50%);
          width: 54px;
          height: 54px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 50%;
          color: #704512;
          background: #fff0a9;
          border: 4px solid #fff8d9;
          box-shadow: 0 5px 0 #a76420;
          font-size: 34px;
          font-weight: 1000;
          animation: questionFloat 1s ease-in-out infinite;
        }

        .shuffle-lock {
          position: absolute;
          z-index: 20;
          left: 50%;
          bottom: 4px;
          transform: translateX(-50%);
          min-width: min(420px, 88%);
          min-height: 52px;
          padding: 8px 20px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          border-radius: 999px;
          color: #4b3112;
          background: rgba(255, 235, 170, 0.95);
          box-shadow: 0 7px 0 rgba(135, 82, 25, 0.85);
          font-size: 18px;
          font-weight: 900;
          pointer-events: all;
        }

        .shuffle-spinner {
          width: 22px;
          height: 22px;
          border: 4px solid rgba(104, 62, 14, 0.25);
          border-top-color: #6f4315;
          border-radius: 50%;
          animation: spinnerRotate 650ms linear infinite;
        }

        .hat-game-actions {
          width: 100%;
          min-height: 120px;
          display: flex;
          justify-content: center;
          align-items: center;
        }


        .hat-start-button {
          width: clamp(180px, 24vw, 290px);
          padding: 0;
          border: none;
          outline: none;
          background: transparent;
          cursor: pointer;
          transition:
            transform 180ms ease,
            filter 180ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        .hat-start-button img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.42));
        }

        .hat-start-button:hover {
          transform: translateY(-6px) scale(1.04);
          filter: brightness(1.08);
        }

        .hat-start-button:active {
          transform: translateY(2px) scale(0.97);
        }

        .hat-start-button:focus-visible {
          outline: 5px solid #ffe99b;
          outline-offset: 8px;
          border-radius: 24px;
        }

        .hat-button {
          min-width: 190px;
          min-height: 62px;
          padding: 12px 28px;
          border: 4px solid rgba(255, 255, 255, 0.45);
          border-radius: 20px;
          color: #fffdf1;
          font: inherit;
          font-size: 21px;
          font-weight: 1000;
          cursor: pointer;
          transition:
            transform 160ms ease,
            filter 160ms ease;
          box-shadow: 0 8px 0 rgba(55, 31, 13, 0.85);
          -webkit-tap-highlight-color: transparent;
        }

        .hat-button:hover {
          transform: translateY(-4px);
          filter: brightness(1.08);
        }

        .hat-button:active {
          transform: translateY(4px);
          box-shadow: 0 3px 0 rgba(55, 31, 13, 0.85);
        }

        .hat-button:focus-visible {
          outline: 5px solid #fff3a6;
          outline-offset: 4px;
        }

        .hat-button--primary {
          background:
            linear-gradient(180deg, #7fc85a, #3d923d);
        }

        .hat-button--secondary {
          background:
            linear-gradient(180deg, #b7824c, #7b4b25);
        }

        .result-panel,
        .finish-panel {
          width: min(780px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
        }

        .reward-card {
          width: min(570px, 100%);
          min-height: 120px;
          padding: 16px 24px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          border: 3px solid rgba(255, 230, 161, 0.35);
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
        }

        .reward-card--won {
          border-color: rgba(255, 229, 123, 0.85);
          background:
            linear-gradient(
              135deg,
              rgba(255, 230, 130, 0.22),
              rgba(255, 255, 255, 0.08)
            );
        }

        .reward-card img {
          width: 94px;
          height: 94px;
          object-fit: contain;
          flex: 0 0 auto;
          filter: drop-shadow(0 7px 5px rgba(0, 0, 0, 0.35));
        }

        .reward-card div {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          text-align: left;
        }

        .reward-card strong {
          color: #fff0ae;
          font-size: 26px;
        }

        .reward-card span {
          color: #fff8dc;
          font-size: 19px;
          font-weight: 700;
        }

        .result-buttons {
          display: flex;
          justify-content: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .finish-panel {
          padding: 26px;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.08);
        }

        .finish-icon {
          font-size: 64px;
          animation: finishBounce 1.2s ease-in-out infinite;
        }

        .finish-panel h2 {
          margin: 0;
          color: #fff0a9;
          font-size: 36px;
        }

        .finish-panel p {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }

        .finish-panel strong {
          color: #ffdd67;
          font-size: 30px;
        }

        @keyframes spinnerRotate {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes stickerReveal {
          from {
            opacity: 0;
            transform: translateX(-50%) scale(0.3) rotate(-16deg);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scale(1) rotate(0);
          }
        }

        @keyframes hatSelected {
          0%,
          100% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.12) translateY(-10px);
          }
        }

        @keyframes hatWrong {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        @keyframes questionFloat {
          0%,
          100% {
            transform: translate(-50%, -50%);
          }
          50% {
            transform: translate(-50%, calc(-50% - 8px));
          }
        }

        @keyframes finishBounce {
          0%,
          100% {
            transform: translateY(0) rotate(-4deg);
          }
          50% {
            transform: translateY(-10px) rotate(4deg);
          }
        }

        @keyframes hatStarsMove {
          from {
            background-position: 0 0, 0 0, 0 0;
          }
          to {
            background-position: 140px 140px, -180px 180px, 210px -210px;
          }
        }

        @media (max-width: 760px) {
          .hat-game-page {
            padding: 12px;
          }

          .hat-game-content {
            min-height: calc(100vh - 24px);
            padding: 22px 12px;
            border-radius: 0;
          }

          .hat-stage {
            min-height: 315px;
          }

          .hat-track {
            height: 290px;
          }

          .hat-item {
            height: 245px;
            bottom: 24px;
          }

          .hat-object {
            width: 96%;
            height: 220px;
          }

          .cap-image--raised {
            transform: translateY(-55px) rotate(-5deg);
          }

          .hidden-sticker {
            width: 74px;
            height: 74px;
          }

          .hat-question {
            width: 44px;
            height: 44px;
            border-width: 3px;
            font-size: 27px;
          }

          .reward-card {
            padding: 14px;
          }

          .reward-card img {
            width: 78px;
            height: 78px;
          }

          .reward-card strong {
            font-size: 22px;
          }

          .reward-card span {
            font-size: 17px;
          }

          .hat-button {
            min-width: 165px;
            min-height: 56px;
            padding: 10px 20px;
            font-size: 18px;
          }
        }

        @media (max-width: 500px) {
          .hat-game-header h1 {
            margin-top: 18px;
          }

          .hat-track {
            height: 255px;
          }

          .hat-stage {
            min-height: 280px;
          }

          .hat-item {
            height: 210px;
          }

          .hat-object {
            height: 185px;
          }

          .cap-image--raised {
            transform: translateY(-46px) rotate(-5deg);
          }

          .hidden-sticker {
            width: 61px;
            height: 61px;
          }

          .shuffle-lock {
            min-width: 94%;
            padding: 7px 12px;
            font-size: 15px;
          }

          .result-buttons {
            width: 100%;
            flex-direction: column;
          }

          .result-buttons .hat-button {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hat-item,
          .cap-image,
          .hidden-sticker,
          .hat-question,
          .finish-icon,
          .hat-game-overlay::after {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </main>
  );
}