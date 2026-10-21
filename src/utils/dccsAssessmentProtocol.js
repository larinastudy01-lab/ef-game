import { DCCS_ASSESSMENT_CONFIG, DCCS_BOX_REFERENCES } from "../config/dccsAssessmentConfig";

export function getDccsCorrectPosition(trial) {
  if (!trial) return null;
  const key = trial.card?.[trial.matchBy || (trial.rule === "type" ? "type" : "color")];
  if (trial.topTarget?.key === key) return "top";
  if (trial.bottomTarget?.key === key) return "bottom";
  return null;
}

export function getDccsPreviousRulePosition(trial, rule) {
  if (!trial || rule === "color") return null;
  const field = rule === "category" ? "color" : "type";
  const canonicalType = (value) => value === "tshirt" ? "shirt" : value;
  const key = (card) => field === "color" ? card.color : canonicalType(card.type);
  return Object.keys(DCCS_BOX_REFERENCES).find((side) =>
    key(DCCS_BOX_REFERENCES[side]) === key(trial.card)) || null;
}

// A separate practice bank borrows the original stimulus/target metadata without
// mutating the formal bank. Prioritize conflicting cues and alternate sides.
export function buildDccsPracticeTrials(trials, rule) {
  const conflicts = trials.filter((trial) => {
    const side = getDccsCorrectPosition(trial);
    // Practice must defeat perseverating on the references the child actually
    // sees: blue shirt on the left and red hat on the right.
    const oldSide = getDccsPreviousRulePosition(trial, rule);
    return side && oldSide && side !== oldSide;
  });
  const hasBothSides = ["top", "bottom"].every((side) => conflicts.some((trial) => getDccsCorrectPosition(trial) === side));
  const pool = hasBothSides ? conflicts : [...conflicts, ...trials.filter((trial) => !conflicts.includes(trial))];
  const left = pool.filter((trial) => getDccsCorrectPosition(trial) === "top");
  const right = pool.filter((trial) => getDccsCorrectPosition(trial) === "bottom");
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) =>
    [left[index], right[index]].filter(Boolean)).flat().map((trial) => ({
      ...trial, id: `practice_${rule}_${trial.id}`, mode: "practice",
    }));
}

export function nextDccsPracticeProgress(progress, isCorrect) {
  const consecutiveCorrect = isCorrect ? progress.consecutiveCorrect + 1 : 0;
  return {
    ...progress,
    attempts: progress.attempts + 1,
    consecutiveCorrect,
    passed: consecutiveCorrect >= DCCS_ASSESSMENT_CONFIG.requiredConsecutiveCorrect,
  };
}
