const assets = require.context("../asset/LB", false, /(?:blue|yellow)_\d{2}\.webp$/);

export function getLBDoorplateImage(color, number) {
  const imageColor = color === "blue" ? "blue" : "yellow";
  const imageNumber = String(Math.min(30, Math.max(1, Number(number) || 1))).padStart(2, "0");
  return assets(`./${imageColor}_${imageNumber}.webp`);
}
