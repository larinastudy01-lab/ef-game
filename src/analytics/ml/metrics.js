const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

export function classificationMetrics(actual = [], predicted = [], probabilities = []) {
  const tp = actual.filter((value, i) => value === 1 && predicted[i] === 1).length;
  const tn = actual.filter((value, i) => value === 0 && predicted[i] === 0).length;
  const fp = actual.filter((value, i) => value === 0 && predicted[i] === 1).length;
  const fn = actual.filter((value, i) => value === 1 && predicted[i] === 0).length;
  const precision = tp + fp ? tp / (tp + fp) : 0; const recall = tp + fn ? tp / (tp + fn) : 0;
  const specificity = tn + fp ? tn / (tn + fp) : 0;
  return { accuracy: actual.length ? (tp + tn) / actual.length : null, balanced_accuracy: (recall + specificity) / 2,
    precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0,
    roc_auc: auc(actual, probabilities), pr_auc: prAuc(actual, probabilities), confusion_matrix: { tn, fp, fn, tp } };
}

export function regressionMetrics(actual = [], predicted = []) {
  const errors = actual.map((value, index) => predicted[index] - value); const average = mean(actual);
  const ssResidual = errors.reduce((sum, error) => sum + error ** 2, 0);
  const ssTotal = actual.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return { mae: mean(errors.map(Math.abs)), rmse: Math.sqrt(mean(errors.map((value) => value ** 2))), r2: ssTotal ? 1 - ssResidual / ssTotal : null };
}

function auc(labels, scores) {
  if (scores.length !== labels.length || new Set(labels).size < 2) return null;
  const pairs = labels.map((label, i) => ({ label, score: scores[i] })).sort((a, b) => a.score - b.score);
  let rankSum = 0; pairs.forEach((pair, i) => { if (pair.label === 1) rankSum += i + 1; });
  const positives = labels.filter((v) => v === 1).length; const negatives = labels.length - positives;
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

function prAuc(labels, scores) {
  if (scores.length !== labels.length || !labels.includes(1)) return null;
  const sorted = labels.map((label, i) => ({ label, score: scores[i] })).sort((a, b) => b.score - a.score);
  let tp = 0; let fp = 0; let previousRecall = 0; let area = 0; const positives = labels.filter((v) => v === 1).length;
  sorted.forEach(({ label }) => { if (label) tp += 1; else fp += 1; const recall = tp / positives; area += (recall - previousRecall) * (tp / (tp + fp)); previousRecall = recall; });
  return area;
}

export function classDistribution(rows = []) {
  return rows.reduce((counts, row) => ({ ...counts, [row.target]: (counts[row.target] || 0) + 1 }), {});
}

