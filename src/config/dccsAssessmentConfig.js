import { getCard } from "./dccsClothingData";

// UI timings only; formal stimulus selection, order and scoring stay in the existing page.
export const DCCS_ASSESSMENT_CONFIG = Object.freeze({
  requiredConsecutiveCorrect: 2,
  revealMs: 300,
  depositMs: 450,
  formalTransitionMs: 600, // retain the existing inter-response transition
  practiceFeedbackMs: 1000,
  passedMs: 1200,
  bagImageScale: 1.18, // retain the old Dcss-cloth-card-bagged image ratio
  maxPracticeAttempts: null, // requires researcher approval before introducing a cap
  formalVoiceReplayAllowed: false, // the old test exposes no replay control
});

export const DCCS_RULES = Object.freeze([
  { id: "color", title: "看看衣服的顏色！", intro: "我們來看看衣服的顏色，把它放進一樣顏色的箱子吧！", retry: "再看看喔！這一關要看衣服的顏色！", formalPhase: "color_test" },
  { id: "category", title: "新規則：看衣服種類！", intro: "現在規則不一樣囉！這次要看衣服的種類，不是看顏色喔！", retry: "再看看喔！這一關要看衣服的種類！", formalPhase: "type_test" },
  { id: "bag_color", title: "看看袋子裡衣服的顏色！", intro: "這次要仔細看看透明袋子裡面的衣服，是什麼顏色呢？", retry: "再看一次喔！要看袋子裡面的衣服顏色！", formalPhase: "bag_color_test" },
]);
// References already printed on box_left.webp / box_right.webp. Keep the visual
// reference identities explicit instead of inferring them from asset filenames.
export const DCCS_BOX_REFERENCES = Object.freeze({
  top: getCard("blue_shirt"),
  bottom: getCard("red_hat"),
});

