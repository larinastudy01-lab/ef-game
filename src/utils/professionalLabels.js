import { PROFESSIONAL_TASKS } from "../config/professionalIndicators";
import { humanizeFeature as legacyFeatureLabel } from "../analytics/explainability";

// UI aliases only. Codes, feature keys, stored names and model inputs are intact.
export const RESEARCH_TASK_NAMES = Object.freeze(Object.fromEntries(Object.entries(PROFESSIONAL_TASKS).map(([code, task]) => [code, task.name])));
export const researchTaskLabel = (code) => RESEARCH_TASK_NAMES[code] ? `${RESEARCH_TASK_NAMES[code]}（${code}）` : "未提供現行任務";
export const humanizeFeature = (key) => ({
  ari_cat_sound_accuracy: "聲音角色 A 正確率（實際動物依刺激版本）",
  ari_dog_sound_accuracy: "聲音角色 B 正確率（實際動物依刺激版本）",
}[key] || legacyFeatureLabel(key));
