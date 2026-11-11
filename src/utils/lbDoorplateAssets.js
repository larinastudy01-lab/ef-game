// Landmark art is reserved for training, including its recolored red signs.
const assets = require.context("../asset/LB", true, /^\.\/(?:blue|yellow)_landmark\/(?:blue|yellow)_\d{2}\.webp$/);
const assessmentAssets = require.context("../asset/LB", true, /^\.\/(?:lightgray_rock|gray_rock|red_mailbox|purple_mailbox)\/\d+\.webp$/);

const ASSESSMENT_FOLDERS = {
  "01": { lightgray: "lightgray_rock", gray: "gray_rock" },
  "02": { red: "red_mailbox", purple: "purple_mailbox" },
};

const normalizeNumber = (number) => Math.min(30, Math.max(1, Math.trunc(Number(number) || 1)));

export function getLBDoorplateImage(color, number) {
  const imageColor = color === "blue" ? "blue" : "yellow";
  const imageNumber = String(normalizeNumber(number)).padStart(2, "0");
  return assets(`./${imageColor}_landmark/${imageColor}_${imageNumber}.webp`);
}

export function getLBAssessmentImage(testVersion, color, number) {
  const folder = ASSESSMENT_FOLDERS[testVersion]?.[color];
  if (!folder) throw new Error(`Invalid LB assessment stimulus: ${testVersion}/${color}`);
  return assessmentAssets(`./${folder}/${normalizeNumber(number)}.webp`);
}
