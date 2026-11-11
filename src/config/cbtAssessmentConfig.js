import leaf from "../asset/CBT/test01/leaf.webp";
import leafShiny from "../asset/CBT/test01/leaf_light.webp";
import leafStep from "../asset/CBT/test01/step.webp";
import wood from "../asset/CBT/test02/wood.webp";
import woodShiny from "../asset/CBT/test02/wood_light.webp";
import woodStep from "../asset/CBT/test02/step.webp";
import leafIntro from "../asset/voice/CBT_副本/仔細看，記住荷葉亮起來的順序，再照順序點一次喔！.mp3";
import woodIntro from "../asset/voice/CBT_副本/仔細看，記住木塊亮起來的順序，再照順序點一次喔！.mp3";
import leafAnswer from "../asset/voice/CBT_副本/換你囉！照剛剛亮起來的順序，點一點荷葉！.mp3";
import woodAnswer from "../asset/voice/CBT_副本/換你囉！照剛剛亮起來的順序，點一點木塊！.mp3";
import correct from "../asset/voice/CBT_副本/太棒了！你記住順序了！.mp3";
import retry from "../asset/voice/CBT_副本/沒關係，我們再試一次！.mp3";
import passed from "../asset/voice/CBT_副本/太棒了！你學會怎麼玩了！.mp3";

// Preview copies reuse the existing board, sequence timings and scoring.
export const CBT_ASSESSMENT_VERSIONS = {
  "01": { testVersion: "01", stimulusSetId: "test01", stimulusName: "荷葉", unit: "片",
    image: leaf, shinyImage: leafShiny, stepImage: leafStep,
    audio: { intro: leafIntro, answer: leafAnswer, correct, retry, passed } },
  "02": { testVersion: "02", stimulusSetId: "test02", stimulusName: "木塊", unit: "塊",
    image: wood, shinyImage: woodShiny, stepImage: woodStep,
    audio: { intro: woodIntro, answer: woodAnswer, correct, retry, passed } },
};
