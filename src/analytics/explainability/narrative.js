const LABELS = {
  accuracy: "正確率", error_rate: "錯誤率", rt_mean: "平均反應時間", rt_variability_ms: "反應時間變異",
  late_accuracy: "後段正確率", early_accuracy: "前段正確率", accuracy_change: "前後段正確率變化",
  late_rt_mean: "後段平均反應時間", early_rt_mean: "前段平均反應時間", rt_change: "前後段反應時間變化",
};

export function humanizeFeature(feature = "") {
  const direct = LABELS[feature]; if (direct) return direct;
  return feature.replace(/^corsi_/, "Corsi ").replace(/^picture_memory_/, "Picture Memory ")
    .replace(/^srt_/, "SRT ").replace(/^ssg_/, "SSG ").replace(/^linking_balloons_/, "Linking Balloons ")
    .replace(/^dccs_/, "DCCS ").replaceAll("_", " ");
}

const direction = (item) => item.contribution > 0 ? "提高模型預測值" : "降低模型預測值";

export function buildBehavioralNarrative(explanation) {
  const strongest = explanation.contributors.slice(0, 3);
  if (!strongest.length) return "目前沒有足夠的有效特徵可產生個別模型解釋。";
  return `本次模型主要受到${strongest.map((item) => `${humanizeFeature(item.feature)}（${direction(item)}）`).join("、")}影響。這些是模型中的行為表現關聯，不代表診斷、病因或因果效果。`;
}

export const RESEARCH_LIMITATION_NOTICE = "模型目前僅供研究用途，其結果尚未完成臨床效度驗證。";

export function assertNonDiagnosticText(text = "") {
  const forbidden = [/注意力障礙/u, /ADHD/iu, /疾病診斷/u, /正常幼兒/u, /異常幼兒/u, /病患風險/u];
  if (forbidden.some((pattern) => pattern.test(text))) throw new Error("Diagnostic language is not permitted in behavioral model explanations.");
  return text;
}

