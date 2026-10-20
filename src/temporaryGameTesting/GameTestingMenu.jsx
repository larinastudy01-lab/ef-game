import React from "react";
import { useNavigate } from "react-router-dom";
import { GAME_TESTING_CATALOG } from "./catalog";
import { gameTestingUrl, resetGameTestingMemory } from "./runtime";
import "./gameTesting.css";

export default function GameTestingMenu() {
  const navigate = useNavigate();
  const launch = (path) => {
    resetGameTestingMemory();
    navigate(gameTestingUrl(path));
  };
  return (
    <main className="game-testing-menu">
      <header className="game-testing-heading">
        <span className="game-testing-eyebrow">TEMPORARY PLAYGROUND</span>
        <h1>遊戲測試選單</h1>
        <p>自由選關，直接測試。遊戲結果、進度與獎勵只供本次預覽，關閉後即清除。</p>
        <div className="game-testing-summary">6 款測驗 · 各遊戲全部難度 · 5 關帽子遊戲</div>
      </header>
      <section className="game-testing-grid" aria-label="所有測驗與訓練難度">
        {GAME_TESTING_CATALOG.map((game) => (
          <article className="game-testing-card" key={game.id}>
            <span className="game-testing-code">{game.id}</span>
            <h2>{game.name}</h2>
            <p>{game.description}</p>
            <button className="game-testing-primary" onClick={() => launch(`/test-${game.slug}`)}>
              開啟測驗
            </button>
            <h3>訓練關卡與難度</h3>
            <div className="game-testing-levels">
              {game.levels.map(({ level, label, difficulty }) => (
                <button key={level} onClick={() => launch(`/training-${game.slug}?level=${level}${difficulty ? `&difficulty=${difficulty}` : ""}`)}>
                  <span>{String(level).padStart(2, "0")}</span> {label}
                </button>
              ))}
            </div>
          </article>
        ))}
        <article className="game-testing-card game-testing-hats">
          <span className="game-testing-code">HAT</span>
          <h2>帽子遊戲</h2>
          <p>直接選擇回合，檢查交換動畫、猜帽子與貼紙效果。</p>
          <div className="game-testing-levels">
            {[1, 2, 3, 4, 5].map((round) => (
              <button key={round} onClick={() => launch(`/hat-sticker-game?round=${round}`)}>
                第 {round} 關 · {round + 2} 頂帽子
              </button>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
