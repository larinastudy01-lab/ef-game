export const ECONOMY_VERSION = 1;
export const COINS_CHANGED_EVENT = "ef-game-coins-changed";

// 基礎獎勵由星級決定，再乘上難度倍率。
export const STAR_COIN_REWARDS = { 1: 10, 2: 20, 3: 30 };
export const DIFFICULTY_MULTIPLIERS = { easy: 1, normal: 1.5, hard: 2 };

const parse = (value, fallback) => {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
};

export const getActiveChildId = () => {
  if (typeof window === "undefined") return "default";
  const child = parse(window.localStorage.getItem("currentChild"), {});
  return String(child?.childId || child?.id || window.localStorage.getItem("childId") || "default");
};

const economyKey = (childId) => `ef_economy_${childId || getActiveChildId()}`;

const normalizeEconomy = (raw) => ({
  version: ECONOMY_VERSION,
  coins: Math.max(0, Number(raw?.coins) || 0),
  ownedFurniture: Array.isArray(raw?.ownedFurniture) ? [...new Set(raw.ownedFurniture)] : [],
  rewardedResults: Array.isArray(raw?.rewardedResults) ? [...new Set(raw.rewardedResults)].slice(-500) : [],
});

export const getEconomy = (childId) => {
  if (typeof window === "undefined") return normalizeEconomy({});
  return normalizeEconomy(parse(window.localStorage.getItem(economyKey(childId)), {}));
};

const saveEconomy = (economy, childId) => {
  const next = normalizeEconomy(economy);
  window.localStorage.setItem(economyKey(childId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(COINS_CHANGED_EVENT, { detail: next }));
  return next;
};

export const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "normal").toLowerCase();
  if (/hard|advanced|expert|high|difficult|level[_ -]?[45]|困難|進階/.test(value)) return "hard";
  if (/easy|beginner|low|level[_ -]?1|簡單|初階/.test(value)) return "easy";
  return "normal";
};

export const calculateCoinReward = ({ stars, difficulty }) => {
  const safeStars = Math.min(3, Math.max(1, Math.round(Number(stars) || 1)));
  return Math.round(STAR_COIN_REWARDS[safeStars] * DIFFICULTY_MULTIPLIERS[normalizeDifficulty(difficulty)]);
};

export const awardTrainingCoins = ({ resultId, stars, difficulty, childId }) => {
  if (typeof window === "undefined" || !resultId) return { awarded: false, amount: 0, economy: getEconomy(childId) };
  const current = getEconomy(childId);
  if (current.rewardedResults.includes(resultId)) return { awarded: false, amount: 0, economy: current };
  const amount = calculateCoinReward({ stars, difficulty });
  const economy = saveEconomy({ ...current, coins: current.coins + amount, rewardedResults: [...current.rewardedResults, resultId] }, childId);
  return { awarded: true, amount, economy };
};

export const purchaseFurniture = ({ id, price, childId }) => {
  const current = getEconomy(childId);
  if (current.ownedFurniture.includes(id)) return { ok: false, reason: "owned", economy: current };
  const safePrice = Math.max(0, Number(price) || 0);
  if (current.coins < safePrice) return { ok: false, reason: "insufficient", economy: current };
  const economy = saveEconomy({ ...current, coins: current.coins - safePrice, ownedFurniture: [...current.ownedFurniture, id] }, childId);
  return { ok: true, economy };
};
