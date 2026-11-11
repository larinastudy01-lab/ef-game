import { gameLocalStorage } from "../temporaryGameTesting/runtime";
import { getPMStimulusVersions } from "../config/pmStimulusConfig";
import { PM_ASSET_CATALOG_VERSION } from "../config/pmAssets";

const storageKey = (childId, mode) => `pmStimulusUsage_${mode}_${childId}`;

export function getPMStimulusUsage(childId, mode, storage = gameLocalStorage) {
  getPMStimulusVersions(mode);
  let saved;
  try { saved = JSON.parse(storage.getItem(storageKey(childId, mode)) || "null"); } catch { saved = null; }
  const counts = Object.fromEntries(Object.entries(saved?.categoryCounts || {}).map(([key, value]) =>
    [key, Number.isFinite(value) && value >= 0 ? value : 0]));
  return { assetCatalogVersion: PM_ASSET_CATALOG_VERSION,
    lastVersion: ["01", "02"].includes(saved?.lastVersion) ? saved.lastVersion : null,
    categoryCounts: counts };
}

export function getNextPMStimulus(childId, mode, storage = gameLocalStorage) {
  const usage = getPMStimulusUsage(childId, mode, storage);
  const versions = Object.values(getPMStimulusVersions(mode));
  const score = (stimulus) => stimulus.categoryKeys.reduce((total, category) => total + (usage.categoryCounts[category] || 0), 0);
  const minimum = Math.min(...versions.map(score));
  const candidates = versions.filter((stimulus) => score(stimulus) === minimum);
  return candidates.find((stimulus) => stimulus.version !== usage.lastVersion) || candidates[0];
}

// Count only pictures actually presented during formal memory/answer scenes.
// A target shown again among the options is a second visual exposure.
export function recordPMStimulusExposure(childId, mode, stimulus, items, { startSession = false, storage = gameLocalStorage } = {}) {
  if (!childId) return;
  const configured = getPMStimulusVersions(mode)[stimulus.version];
  if (!configured || configured !== stimulus) throw new Error("Invalid PM stimulus selection");
  const usage = getPMStimulusUsage(childId, mode, storage);
  for (const item of items) {
    const category = item.assetCategoryKey;
    if (category !== "unclassified" && !configured.categoryKeys.includes(category)) throw new Error("PM stimulus outside selected pool");
    usage.categoryCounts[category] = (usage.categoryCounts[category] || 0) + 1;
  }
  if (startSession) usage.lastVersion = stimulus.version;
  storage.setItem(storageKey(childId, mode), JSON.stringify(usage));
}
