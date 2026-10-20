const images = require.context("../asset/sticker/achievement", true, /\.webp$/);

export function getAchievementAsset(id, level) {
  const folder = `level${String(Math.min(5, Math.max(1, level || 1))).padStart(2, "0")}`;
  try { return images(`./${folder}/${id}.webp`); } catch { return null; }
}
