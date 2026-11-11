import grapeGood from "../asset/SRT/test01/Grape_good.webp";
import grapeBad from "../asset/SRT/test01/Grape_bad.webp";
import appleGood from "../asset/SRT/test02/Apple_good.webp";
import appleBad from "../asset/SRT/test02/Apple_bad.webp";
import enterGrape from "../asset/voice/SRT_副本/一起來收集葡萄吧！.mp3";
import enterApple from "../asset/voice/SRT_副本/一起來收集蘋果吧！.mp3";
import grapeGo from "../asset/voice/SRT_副本/看到好的葡萄，要記得點一下喔！.mp3";
import appleGo from "../asset/voice/SRT_副本/看到好的蘋果，要記得點一下喔！.mp3";
import grapeRules from "../asset/voice/SRT_副本/看到好的葡萄，就快快點一下！看到壞掉的葡萄，不要點喔！.mp3";
import appleRules from "../asset/voice/SRT_副本/看到好的蘋果，就快快點一下！看到壞掉的蘋果，不要點喔！.mp3";
import grapeWrong from "../asset/voice/SRT_副本/壞掉的葡萄不能收集喔！再看仔細一點！.mp3";
import appleWrong from "../asset/voice/SRT_副本/壞掉的蘋果不能收集喔！再看仔細一點！.mp3";
import grapeComplete from "../asset/voice/SRT_副本/完成囉！謝謝你幫忙收集葡萄！.mp3";
import appleComplete from "../asset/voice/SRT_副本/太棒啦！謝謝你幫忙收集蘋果！.mp3";
import beforeTrial from "../asset/voice/SRT_副本/準備好了嗎？看仔細，開始囉！.mp3";
import correct from "../asset/voice/SRT_副本/太棒了！你做對了！.mp3";
import retry from "../asset/voice/SRT_副本/沒關係，我們再試一次！.mp3";
import practiceComplete from "../asset/voice/SRT_副本/太棒了！你學會怎麼玩了！.mp3";

const makeVersion = ({ testVersion, stimulusName, good, bad, goodSize, enterPractice, ruleGo, ruleNoGo, wrongNoGo, assessmentComplete }) => ({
  testVersion,
  stimulusSetId: `test${testVersion}`,
  stimulusName,
  stimuli: {
    normal: { img: good, label: `好${stimulusName}`, width: goodSize[0], height: goodSize[1] },
    rotten: { img: bad, label: `壞${stimulusName}`, width: 1306, height: 1205 },
  },
  prompts: {
    ruleGo: `看到好的${stimulusName}，要記得點一下喔！`,
    ruleNoGo: `看到好的${stimulusName}，就快快點一下！看到壞掉的${stimulusName}，不要點喔！`,
    beforeTrial: "準備好了嗎？看仔細，開始囉！",
  },
  audio: {
    enabled: true,
    maxWaitMs: 10000,
    events: { enterPractice, ruleGo, ruleNoGo, beforeTrial, correct, wrongNoGo,
      missedGo: ruleGo, retry, practiceComplete, assessmentComplete },
  },
});

// Assessment copies have their own images and recordings; training keeps acorns.
export const SRT_ASSESSMENT_VERSIONS = {
  "01": makeVersion({ testVersion: "01", stimulusName: "葡萄", good: grapeGood, bad: grapeBad,
    goodSize: [1306, 1205], enterPractice: enterGrape, ruleGo: grapeGo, ruleNoGo: grapeRules,
    wrongNoGo: grapeWrong, assessmentComplete: grapeComplete }),
  "02": makeVersion({ testVersion: "02", stimulusName: "蘋果", good: appleGood, bad: appleBad,
    goodSize: [1254, 1254], enterPractice: enterApple, ruleGo: appleGo, ruleNoGo: appleRules,
    wrongNoGo: appleWrong, assessmentComplete: appleComplete }),
};

export const getSrtAssessmentVersion = (version) =>
  SRT_ASSESSMENT_VERSIONS[version] || SRT_ASSESSMENT_VERSIONS["01"];
