import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/RestPage.css";

/**
 * RestPage.jsx
 *
 * 功能：
 * 1. 每累積 20 分鐘訓練 / 測驗後進入休息頁
 * 2. 不顯示壓力式倒數與進度條
 * 3. 用森林動畫、提示語、柔和互動引導休息
 * 4. 休息完成後可回到原任務或森林地圖
 *
 * 建議路由：
 * <Route path="/rest" element={<RestPage />} />
 *
 * navigate 範例：
 * navigate("/rest", {
 *   state: {
 *     returnPath: "/training-map",
 *     childName: currentChild.name,
 *     reason: "20min",
 *     restMinutes: 2
 *   }
 * });
 */

const DEFAULT_REST_SECONDS = 120;

const safeParse = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getCurrentChild = () => {
  return (
    safeParse(localStorage.getItem("currentChild")) ||
    safeParse(sessionStorage.getItem("currentChild"))
  );
};

const REST_TIPS = [
  {
    title: "喝一口水",
    text: "皮皮提醒：小冒險家可以先喝一口水。",
    icon: "💧",
  },
  {
    title: "伸展一下",
    text: "跟波波一起伸伸手、動動肩膀。",
    icon: "🌿",
  },
  {
    title: "眼睛休息",
    text: "看一看遠方，讓眼睛放鬆一下。",
    icon: "🌼",
  },
  {
    title: "慢慢呼吸",
    text: "吸氣、吐氣，像森林的風一樣慢慢來。",
    icon: "🍃",
  },
];

const REST_REASON_TEXT = {
  "20min": "已經冒險一段時間了，皮皮邀請你到森林休息站休息一下。",
  fatigue: "皮皮發現小冒險家可能有點累了，我們先休息一下。",
  manual: "先到森林休息站坐一下，等等再繼續冒險。",
};

const RestPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state || {};
  const child = state.child || getCurrentChild();

  const restSeconds =
    Number(state.restSeconds) ||
    Number(state.restMinutes) * 60 ||
    DEFAULT_REST_SECONDS;

  const [secondsLeft, setSecondsLeft] = useState(restSeconds);
  const [isRestDone, setIsRestDone] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const reasonText =
    REST_REASON_TEXT[state.reason] ||
    REST_REASON_TEXT["20min"];

  const currentTip = useMemo(() => {
    return REST_TIPS[tipIndex % REST_TIPS.length];
  }, [tipIndex]);

  useEffect(() => {
    if (isRestDone) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRestDone(true);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRestDone]);

  useEffect(() => {
    const tipTimer = window.setInterval(() => {
      setTipIndex((prev) => prev + 1);
    }, 6000);

    return () => window.clearInterval(tipTimer);
  }, []);

  const finishRest = () => {
    const returnPath = state.returnPath || "/training-map";

    const restRecord = {
      childId: child?.childId || null,
      childName: child?.name || "",
      reason: state.reason || "20min",
      restSeconds,
      finishedAt: new Date().toISOString(),
    };

    const previousRecords =
      safeParse(localStorage.getItem("restRecords")) || [];

    localStorage.setItem(
      "restRecords",
      JSON.stringify([...previousRecords, restRecord])
    );

    navigate(returnPath, {
      state: {
        ...state.returnState,
        child,
        fromRest: true,
      },
    });
  };

  const goForest = () => {
    navigate("/training-map", {
      state: {
        child,
        fromRest: true,
      },
    });
  };

  const skipRestForParent = () => {
    const confirmed = window.confirm(
      "建議讓孩子完成休息。確定要由家長操作提前結束嗎？"
    );

    if (confirmed) {
      finishRest();
    }
  };

  return (
    <main className="rest-page">
      <section className="rest-card">
        <div className="rest-fireflies">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="rest-character-row">
          <div className="rest-character bear">波波</div>
          <div className="rest-character chick">皮皮</div>
        </div>

        <p className="rest-label">森林休息站</p>

        <h1>
          {child?.name ? `${child.name}，休息一下吧` : "休息一下吧"}
        </h1>

        <p className="rest-story">{reasonText}</p>

        <section className="rest-breathing-area">
          <div className="rest-breathing-circle">
            <span>{currentTip.icon}</span>
          </div>

          <div className="rest-tip-card">
            <h2>{currentTip.title}</h2>
            <p>{currentTip.text}</p>
          </div>
        </section>

        <section className="rest-soft-status">
          {!isRestDone ? (
            <>
              <div className="rest-leaf-row" aria-label="休息中">
                <span className={secondsLeft < restSeconds * 0.8 ? "active" : ""}>🍃</span>
                <span className={secondsLeft < restSeconds * 0.6 ? "active" : ""}>🍃</span>
                <span className={secondsLeft < restSeconds * 0.4 ? "active" : ""}>🍃</span>
                <span className={secondsLeft < restSeconds * 0.2 ? "active" : ""}>🍃</span>
              </div>

              <p>葉子慢慢飄下來，休息一下再出發。</p>
            </>
          ) : (
            <>
              <div className="rest-ready-stars">★ ★ ★</div>
              <p>皮皮覺得可以繼續冒險了！</p>
            </>
          )}
        </section>

        <div className="rest-actions">
          {isRestDone ? (
            <button
              type="button"
              className="rest-button primary"
              onClick={finishRest}
            >
              繼續冒險
            </button>
          ) : (
            <button
              type="button"
              className="rest-button parent"
              onClick={skipRestForParent}
            >
              家長提前結束
            </button>
          )}

          <button
            type="button"
            className="rest-button secondary"
            onClick={goForest}
          >
            回森林地圖
          </button>
        </div>

        <p className="rest-note">
          建議每累積約 20 分鐘訓練或測驗後，安排短暫休息，避免疲勞影響表現。
        </p>
      </section>
    </main>
  );
};

export default RestPage;
