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
  const [selectedMode, setSelectedMode] = useState("");
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

  const filteredResults = useMemo(
    () => results.filter((result) => result.mode === selectedMode),
    [results, selectedMode]
  );

  const summary = useMemo(() => {
    if (!filteredResults.length) return { averageAccuracy: 0, averageStars: 0, count: 0 };
    return {
      averageAccuracy: Math.round(
        filteredResults.reduce((total, item) => total + item.accuracy, 0) / filteredResults.length
      ),
      averageStars: filteredResults.reduce((total, item) => total + item.stars, 0) / filteredResults.length,
      count: filteredResults.length,
    };
  }, [filteredResults]);

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
        </div>
      </header>

      {children.length > 0 && (
        <section className="parent-results-controls" aria-label="成績篩選">
          <label className="parent-results-child-select">
            <span>孩子</span>
            <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.nickname || child.full_name || "未命名孩子"}</option>
              ))}
            </select>
          </label>
          <div className="parent-results-mode-select" role="group" aria-label="選擇紀錄類型">
            <span>查看</span>
            <button type="button" className={selectedMode === "test" ? "is-active" : ""} onClick={() => setSelectedMode("test")}>測驗</button>
            <button type="button" className={selectedMode === "training" ? "is-active" : ""} onClick={() => setSelectedMode("training")}>訓練</button>
          </div>
        </section>
      )}

      {error && <p className="parent-results-notice">{error}</p>}

      {!isLoading && children.length === 0 ? (
        <section className="parent-results-empty">
          <h2>還沒有孩子資料</h2>
          <p>請先新增孩子，完成遊戲後就能在這裡查看成績。</p>
          <button type="button" onClick={() => navigate("/child-select")}>新增孩子</button>
        </section>
      ) : !selectedMode ? (
        <section className="parent-results-empty parent-results-mode-prompt">
          <h2>想看哪一種紀錄？</h2>
          <p>請先選擇「測驗」或「訓練」。</p>
        </section>
      ) : (
        <>
          <section className="parent-results-summary" aria-label={`${selectedChild?.nickname || "孩子"}的成績摘要`}>
            <article><strong>{summary.count}</strong><span>完成次數</span></article>
            <article><strong>{summary.averageAccuracy}%</strong><span>平均正確率</span></article>
            <article><strong>{filteredResults.length ? `${summary.averageStars.toFixed(1)} ★` : "—"}</strong><span>平均星星</span></article>
          </section>

          <section className="parent-results-list-section">
            <h2>{selectedMode === "training" ? "訓練紀錄" : "測驗紀錄"}</h2>
            {isLoading ? (
              <p className="parent-results-loading">正在讀取成績…</p>
            ) : filteredResults.length === 0 ? (
              <div className="parent-results-empty"><h3>目前還沒有{selectedMode === "training" ? "訓練" : "測驗"}成績</h3><p>完成後，紀錄會顯示在這裡。</p></div>
            ) : (
              <div className="parent-results-list">
                {filteredResults.map((result) => (
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
