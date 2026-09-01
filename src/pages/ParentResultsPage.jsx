import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyPatients, getResultsByPatientFromCloud } from "../lib/database";
import { getResultsByChild } from "../utils/resultManager";
import returnIcon from "../asset/return.webp";
import "../styles/ParentResultsPage.css";

const GAME_NAMES = {
  SRT: "松鼠反應遊戲",
  PM: "圖片記憶遊戲",
  CBT: "路徑記憶遊戲",
  SSG: "相反指令遊戲",
  LB: "連結氣球遊戲",
  DCCS: "規則切換遊戲",
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeResult = (row) => {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row;
  const gameId = row?.game_id || payload?.game?.gameId || "GAME";
  const finishedAt = row?.finished_at || payload?.session?.finishedAt || payload?.createdAt;
  return {
    id: row?.id || payload?.resultId || `${gameId}-${finishedAt}`,
    gameId,
    gameName: row?.game_name || payload?.game?.gameName || GAME_NAMES[gameId] || gameId,
    mode: row?.mode || payload?.session?.mode || "test",
    score: toNumber(row?.score ?? payload?.summary?.score),
    accuracy: toNumber(row?.accuracy ?? payload?.summary?.accuracy),
    stars: toNumber(row?.stars ?? payload?.summary?.stars),
    finishedAt,
  };
};

const formatDate = (value) => {
  if (!value) return "日期未記錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未記錄";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function ParentResultsPage() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getMyPatients()
      .then((patients) => {
        if (!active) return;
        setChildren(patients);
        setSelectedChildId(patients[0]?.id || "");
        if (patients.length === 0) setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("目前無法讀取孩子資料，請稍後再試。");
        setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    let active = true;
    setIsLoading(true);
    setError("");
    getResultsByPatientFromCloud(selectedChildId)
      .then((cloudResults) => {
        if (!active) return;
        const source = cloudResults.length ? cloudResults : getResultsByChild(selectedChildId);
        setResults(source.map(normalizeResult));
      })
      .catch(() => {
        if (!active) return;
        setResults(getResultsByChild(selectedChildId).map(normalizeResult));
        setError("雲端成績暫時無法同步，以下顯示此裝置上的紀錄。");
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [selectedChildId]);

  const summary = useMemo(() => {
    if (!results.length) return { average: 0, latest: null, count: 0 };
    return {
      average: Math.round(results.reduce((total, item) => total + item.accuracy, 0) / results.length),
      latest: results[0],
      count: results.length,
    };
  }, [results]);

  const selectedChild = children.find((child) => child.id === selectedChildId);

  return (
    <main className="parent-results-page">
      <header className="parent-results-header">
        <button type="button" className="parent-results-back" onClick={() => navigate(-1)} aria-label="回上一頁">
          <img src={returnIcon} alt="" />
        </button>
        <div>
          <p className="parent-results-eyebrow">家長專區</p>
          <h1>孩子的成績</h1>
          <p>快速查看最近的遊戲表現與完成紀錄</p>
        </div>
      </header>

      {children.length > 0 && (
        <label className="parent-results-child-select">
          <span>選擇孩子</span>
          <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.nickname || child.full_name || "未命名孩子"}</option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="parent-results-notice">{error}</p>}

      {!isLoading && children.length === 0 ? (
        <section className="parent-results-empty">
          <h2>還沒有孩子資料</h2>
          <p>請先新增孩子，完成遊戲後就能在這裡查看成績。</p>
          <button type="button" onClick={() => navigate("/child-select")}>新增孩子</button>
        </section>
      ) : (
        <>
          <section className="parent-results-summary" aria-label={`${selectedChild?.nickname || "孩子"}的成績摘要`}>
            <article><strong>{summary.count}</strong><span>完成次數</span></article>
            <article><strong>{summary.average}%</strong><span>平均正確率</span></article>
            <article><strong>{summary.latest ? `${summary.latest.stars} ★` : "—"}</strong><span>最近星星</span></article>
          </section>

          <section className="parent-results-list-section">
            <h2>最近紀錄</h2>
            {isLoading ? (
              <p className="parent-results-loading">正在讀取成績…</p>
            ) : results.length === 0 ? (
              <div className="parent-results-empty"><h3>目前還沒有成績</h3><p>孩子完成一次測驗或訓練後，紀錄會顯示在這裡。</p></div>
            ) : (
              <div className="parent-results-list">
                {results.map((result) => (
                  <article className="parent-result-card" key={result.id}>
                    <div className="parent-result-main">
                      <span className={`parent-result-mode is-${result.mode}`}>{result.mode === "training" ? "訓練" : "測驗"}</span>
                      <h3>{result.gameName}</h3>
                      <time>{formatDate(result.finishedAt)}</time>
                    </div>
                    <div className="parent-result-metrics">
                      <span><strong>{Math.round(result.accuracy)}%</strong>正確率</span>
                      <span><strong>{Math.round(result.score)}</strong>分數</span>
                      <span><strong>{result.stars} ★</strong>星星</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default ParentResultsPage;
