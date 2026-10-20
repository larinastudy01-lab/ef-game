import React, { useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ENABLE_TEMPORARY_GAME_TESTING } from "../config/featureFlags";
import {
  GAME_TESTING_ROUTE, GAME_TESTING_QUERY, createGameTestingShortcut,
  gameTestingUrl, isTemporaryGameTesting, startTemporaryGameTesting, subscribeToGameTesting,
} from "./runtime";
import "./gameTesting.css";

export function useTemporaryGameTesting() {
  return useSyncExternalStore(subscribeToGameTesting, isTemporaryGameTesting);
}

export default function GameTestingControls() {
  const active = useTemporaryGameTesting();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!ENABLE_TEMPORARY_GAME_TESTING) return undefined;
    const shortcut = createGameTestingShortcut(() => {
      if (!isTemporaryGameTesting()) startTemporaryGameTesting();
      navigate(gameTestingUrl(GAME_TESTING_ROUTE));
    });
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [navigate]);

  // Preserve isolation after a refresh, including navigation from result pages.
  useEffect(() => {
    if (active && new URLSearchParams(location.search).get(GAME_TESTING_QUERY) !== "1") {
      navigate(gameTestingUrl(`${location.pathname}${location.search}`), { replace: true, state: location.state });
    }
  }, [active, location, navigate]);

  if (!active) return null;
  return (
    <nav className="game-testing-toolbar" aria-label="臨時遊戲測試">
      <span><strong>臨時測試</strong><small>不儲存紀錄、不上傳資料</small></span>
      <div>
        {location.pathname !== GAME_TESTING_ROUTE && (
          <button onClick={() => navigate(gameTestingUrl(GAME_TESTING_ROUTE))}>回到測試選單</button>
        )}
        {/* A full navigation discards all in-memory caches and pending callbacks. */}
        <a href={`${process.env.PUBLIC_URL || ""}/`}>結束測試</a>
      </div>
    </nav>
  );
}
