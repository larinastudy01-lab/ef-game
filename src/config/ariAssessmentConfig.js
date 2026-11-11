import pigImage from "../asset/ARI/test01/pig.webp";
import sheepImage from "../asset/ARI/test01/sheep.webp";
import pigSound from "../asset/ARI/test01/pig.mp3";
import sheepSound from "../asset/ARI/test01/sheep.mp3";
import cowImage from "../asset/ARI/test02/cow.webp";
import monkeyImage from "../asset/ARI/test02/monkey.webp";
import cowSound from "../asset/ARI/test02/cow.mp3";
import monkeySound from "../asset/ARI/test02/monkey.mp3";
import intro from "../asset/voice/ARI_副本/小耳朵準備好，開始囉！.mp3";
import pigSheepRule from "../asset/voice/ARI_副本/仔細聽喔！聽到小豬的叫聲，要點綿羊；聽到綿羊的叫聲，要點小豬！.mp3";
import cowMonkeyRule from "../asset/voice/ARI_副本/仔細聽喔！聽到乳牛的叫聲，要點猴子；聽到猴子的叫聲，要點乳牛！.mp3";
import assessmentStart from "../asset/voice/ARI_副本/記得喔！要點另一隻動物！.mp3";
import assessmentComplete from "../asset/voice/ARI_副本/完成囉！你好優秀！.mp3";
import { ARI_PRACTICE_AUDIO } from "../utils/ariPracticeAudio";

function makeVersion(testVersion, first, second, rule) {
  const ruleText = `仔細聽喔！聽到${first.label}的叫聲，要點${second.label}；聽到${second.label}的叫聲，要點${first.label}！`;
  return {
    testVersion,
    stimulusSetId: `test${testVersion}`,
    stimulusName: `${first.label}／${second.label}`,
    // cat/dog are legacy scoring roles. Actual animal identities are recorded
    // separately so historical scores and feature extraction stay comparable.
    animals: { cat: first, dog: second },
    stimulusAnimals: { cat: first.id, dog: second.id },
    stimulusAnimalLabels: { cat: first.label, dog: second.label },
    taskRule: `${first.id}SoundSelect${second.id}_${second.id}SoundSelect${first.id}`,
    ruleText,
    audio: {
      intro, rule, assessmentStart, assessmentComplete,
      cat: first.sound, dog: second.sound,
      question: ARI_PRACTICE_AUDIO.question,
      answer: ARI_PRACTICE_AUDIO.answer,
      correct: ARI_PRACTICE_AUDIO.correct,
      wrong: ARI_PRACTICE_AUDIO.wrong,
      retry: ARI_PRACTICE_AUDIO.retry,
      complete: ARI_PRACTICE_AUDIO.complete,
    },
  };
}

export const ARI_ASSESSMENT_VERSIONS = {
  "01": makeVersion("01",
    { id: "pig", label: "小豬", image: pigImage, sound: pigSound },
    { id: "sheep", label: "綿羊", image: sheepImage, sound: sheepSound }, pigSheepRule),
  "02": makeVersion("02",
    { id: "cow", label: "乳牛", image: cowImage, sound: cowSound },
    { id: "monkey", label: "猴子", image: monkeyImage, sound: monkeySound }, cowMonkeyRule),
};

export const getAriAssessmentVersion = (version) =>
  ARI_ASSESSMENT_VERSIONS[version] || ARI_ASSESSMENT_VERSIONS["01"];
