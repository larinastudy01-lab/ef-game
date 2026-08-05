import { seededRandom } from "./random";

const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);

export function trainLinearRegression(rows, parameters = {}) {
  const learningRate = parameters.learning_rate ?? 0.03;
  const iterations = parameters.iterations ?? 800;
  const l2 = parameters.l2 ?? 0;
  const weights = Array(rows[0]?.x.length || 0).fill(0); let intercept = 0;
  for (let step = 0; step < iterations; step += 1) {
    const gradient = Array(weights.length).fill(0); let interceptGradient = 0;
    for (const { x, y } of rows) {
      const error = intercept + dot(weights, x) - y; interceptGradient += error;
      for (let index = 0; index < x.length; index += 1) gradient[index] += error * x[index];
    }
    intercept -= learningRate * interceptGradient / rows.length;
    weights.forEach((weight, index) => { weights[index] -= learningRate * ((gradient[index] / rows.length) + l2 * weight); });
  }
  return { name: "Linear Regression", parameters: { learning_rate: learningRate, iterations, l2 },
    predict: (x) => intercept + dot(weights, x), weights, intercept };
}

export function trainLogisticRegression(rows, parameters = {}) {
  const learningRate = parameters.learning_rate ?? 0.05;
  const iterations = parameters.iterations ?? 700;
  const l2 = parameters.l2 ?? 0.001;
  const classWeight = parameters.class_weight || null;
  const weights = Array(rows[0]?.x.length || 0).fill(0); let intercept = 0;
  for (let step = 0; step < iterations; step += 1) {
    const gradient = Array(weights.length).fill(0); let interceptGradient = 0; let totalWeight = 0;
    for (const { x, y } of rows) {
      const sampleWeight = classWeight?.[y] ?? 1; const error = (sigmoid(intercept + dot(weights, x)) - y) * sampleWeight;
      totalWeight += sampleWeight; interceptGradient += error;
      for (let index = 0; index < x.length; index += 1) gradient[index] += error * x[index];
    }
    intercept -= learningRate * interceptGradient / totalWeight;
    weights.forEach((weight, index) => { weights[index] -= learningRate * ((gradient[index] / totalWeight) + l2 * weight); });
  }
  return { name: "Logistic Regression", parameters: { learning_rate: learningRate, iterations, l2, class_weight: classWeight },
    predictProbability: (x) => sigmoid(intercept + dot(weights, x)), predict: (x) => Number(sigmoid(intercept + dot(weights, x)) >= 0.5), weights, intercept };
}

const variance = (values) => { const average = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length; };
const gini = (values) => { const positive = values.filter(Boolean).length / values.length; return 2 * positive * (1 - positive); };

function buildTree(rows, type, depth, parameters, featureSubset) {
  const ys = rows.map((row) => row.y); const prediction = type === "classification"
    ? Number(ys.reduce((a, b) => a + b, 0) / ys.length >= 0.5) : ys.reduce((a, b) => a + b, 0) / ys.length;
  if (depth >= parameters.max_depth || rows.length < parameters.min_samples_split || new Set(ys).size === 1) return { prediction };
  const parentLoss = type === "classification" ? gini(ys) : variance(ys); let best = null;
  const featureCount = rows[0].x.length;
  const features = featureSubset ? featureSubset(featureCount, depth) : Array.from({ length: featureCount }, (_, i) => i);
  features.forEach((feature) => {
    const values = [...new Set(rows.map((row) => row.x[feature]))].sort((a, b) => a - b);
    values.slice(0, -1).forEach((value, index) => {
      const threshold = (value + values[index + 1]) / 2;
      const left = rows.filter((row) => row.x[feature] <= threshold); const right = rows.filter((row) => row.x[feature] > threshold);
      if (!left.length || !right.length) return;
      const loss = (left.length * (type === "classification" ? gini(left.map((r) => r.y)) : variance(left.map((r) => r.y)))
        + right.length * (type === "classification" ? gini(right.map((r) => r.y)) : variance(right.map((r) => r.y)))) / rows.length;
      const gain = parentLoss - loss; if (!best || gain > best.gain) best = { feature, threshold, left, right, gain };
    });
  });
  if (!best || best.gain <= 0) return { prediction };
  return { prediction, feature: best.feature, threshold: best.threshold,
    left: buildTree(best.left, type, depth + 1, parameters, featureSubset), right: buildTree(best.right, type, depth + 1, parameters, featureSubset) };
}

const treePredict = (node, x) => node.feature === undefined ? node.prediction : treePredict(x[node.feature] <= node.threshold ? node.left : node.right, x);

export function trainDecisionTree(rows, type, parameters = {}) {
  const config = { max_depth: parameters.max_depth ?? 4, min_samples_split: parameters.min_samples_split ?? 4 };
  const root = buildTree(rows, type, 0, config);
  return { name: type === "classification" ? "Decision Tree" : "Decision Tree Regressor", parameters: config,
    predict: (x) => treePredict(root, x), predictProbability: type === "classification" ? (x) => treePredict(root, x) : undefined, root };
}

/** Optional comparison model; bootstrap sampling occurs inside the training fold only. */
export function trainRandomForest(rows, type, parameters = {}, seed = 20260730) {
  const trees = parameters.n_estimators ?? 25; const random = seededRandom(seed);
  const config = { max_depth: parameters.max_depth ?? 5, min_samples_split: parameters.min_samples_split ?? 4 };
  const models = Array.from({ length: trees }, (_, treeIndex) => {
    const bootstrap = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    const subset = (count, depth) => { const size = Math.max(1, Math.floor(Math.sqrt(count))); const start = (treeIndex + depth) % count;
      return Array.from({ length: size }, (_, index) => (start + index) % count); };
    return buildTree(bootstrap, type, 0, config, subset);
  });
  const score = (x) => models.reduce((sum, model) => sum + treePredict(model, x), 0) / models.length;
  return { name: type === "classification" ? "Random Forest" : "Random Forest Regressor",
    parameters: { n_estimators: trees, ...config }, predictProbability: type === "classification" ? score : undefined,
    predict: type === "classification" ? (x) => Number(score(x) >= 0.5) : score };
}
