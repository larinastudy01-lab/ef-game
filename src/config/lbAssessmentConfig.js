import { LB_PRACTICE_STAGES } from "../utils/lbPracticeProtocol";
import intro from "../asset/voice/LB_副本/一起來幫綿羊奶奶找到回家的路吧！.mp3";
import rockRule1 from "../asset/voice/LB_副本/看看石頭上的數字，從一開始，照順序點下去.mp3";
import rockFormal1 from "../asset/voice/LB_副本/從一開始，看看石頭上的數字，照順序點下去喔！.mp3";
import rockRule2 from "../asset/voice/LB_副本/現在要換一種玩法囉！這次要照數字順序，淺灰色、深灰色，輪流點喔！.mp3";
import rockGuide2 from "../asset/voice/LB_副本/先點淺灰色的石頭一，再點深灰色的石頭二，接著點淺灰色的石頭三，照這樣繼續往下點！.mp3";
import rockTurn2 from "../asset/voice/LB_副本/從淺灰色的石頭一開始，再點深灰色的石頭二，按照數字順序點，石頭顏色也要記得換，換一個數字就換顏色喔！.mp3";
import rockColorError from "../asset/voice/LB_副本/再看看喔！淺灰色、深灰色，要輪流點！.mp3";
import mailboxRule1 from "../asset/voice/LB_副本/看看信箱上的數字，從一開始，照順序點下去喔！.mp3";
import mailboxFormal1 from "../asset/voice/LB_副本/從一開始，按照信箱上的數字，照順序點下去喔！.mp3";
import mailboxRule2 from "../asset/voice/LB_副本/現在要換一種玩法囉！這次要照數字順序，紅色信箱、紫色信箱，要輪流點！.mp3";
import mailboxGuide2 from "../asset/voice/LB_副本/先點紅色的信箱一，再點紫色的信箱二，接著點紅色的信箱三，照這樣繼續往下點！.mp3";
import mailboxTurn2 from "../asset/voice/LB_副本/從紅色的信箱一開始，再點紫色的信箱二.mp3";
import mailboxFormal2 from "../asset/voice/LB_副本/按照數字順序點，信箱顏色也要記得換，換一個數字就換顏色喔！.mp3";
import mailboxColorError from "../asset/voice/LB_副本/再看看喔！紅色、紫色，要輪流點！.mp3";
import turn1 from "../asset/voice/LB_副本/從數字一開始，換你試試看！.mp3";
import transition from "../asset/voice/LB_副本/準備好了嗎？看仔細，開始囉！ - 複製.mp3";
import numberError from "../asset/voice/LB_副本/再看看喔！數字要照順序！.mp3";
import retry from "../asset/voice/LB_副本/沒關係，我們重新開始試試看！.mp3";
import idle from "../asset/voice/LB_副本/換你囉！.mp3";
import practiceComplete from "../asset/voice/LB_副本/太棒了！你學會怎麼玩了！.mp3";
import complete from "../asset/voice/LB_副本/完成囉！謝謝你幫綿羊奶奶找到回家的路！.mp3";

export const LB_ASSESSMENT_COLOR_LABELS = {
  lightgray: "淺灰色", gray: "深灰色", red: "紅色", purple: "紫色",
};

function makeVersion({ testVersion, stimulusName, colors, rule1, rule2, guide2, turn2, colorError, formal1, formal2 }) {
  // Preserve the canonical keys and stage IDs for scoring and historical data.
  // The actual stimulus colors are stored on each item and recorded in trials.
  const mapItem = (item) => ({ ...item, color: item.color === "blue" ? colors[1] : colors[0] });
  return {
    testVersion,
    stimulusSetId: `test${testVersion}`,
    stimulusName,
    colors,
    practiceStages: Object.fromEntries(Object.entries(LB_PRACTICE_STAGES).map(([id, stage]) => [id, {
      ...stage,
      instruction: id === "practiceMode1"
        ? `看看${stimulusName}上的數字，從一開始照順序點。`
        : `按照數字順序，${colors.map((color) => LB_ASSESSMENT_COLOR_LABELS[color]).join("、")}輪流點。`,
      items: stage.items.map(mapItem),
    }])),
    practiceAudio: {
      intro, rule1, turn1, transition, rule2, guide2, turn2, colorError,
      numberError1: numberError, numberError2: numberError,
      retry1: retry, retry2: retry, idle, complete: practiceComplete,
    },
    formalAudio: { rule1: formal1, rule2: formal2, complete },
  };
}

export const LB_ASSESSMENT_VERSIONS = {
  "01": makeVersion({ testVersion: "01", stimulusName: "石頭", colors: ["lightgray", "gray"],
    rule1: rockRule1, rule2: rockRule2, guide2: rockGuide2, turn2: rockTurn2,
    colorError: rockColorError, formal1: rockFormal1, formal2: rockTurn2 }),
  "02": makeVersion({ testVersion: "02", stimulusName: "信箱", colors: ["red", "purple"],
    rule1: mailboxRule1, rule2: mailboxRule2, guide2: mailboxGuide2, turn2: mailboxTurn2,
    colorError: mailboxColorError, formal1: mailboxFormal1, formal2: mailboxFormal2 }),
};

export const getLBAssessmentVersion = (version) =>
  LB_ASSESSMENT_VERSIONS[version] || LB_ASSESSMENT_VERSIONS["01"];

export function buildLBAssessmentStages(stages, assessment) {
  const [first, second] = assessment.colors;
  const colorLabels = assessment.colors.map((color) => LB_ASSESSMENT_COLOR_LABELS[color]);
  return stages.map((stage, index) => ({
    ...stage,
    subtitle: index === 0 ? `請按照${assessment.stimulusName}上的數字，從 1 點到 10`
      : `請依數字順序，${colorLabels.join("、")}輪流點`,
    ruleText: index === 0 ? stage.ruleText : `${colorLabels[0]} 1 → ${colorLabels[1]} 2 → ${colorLabels[0]} 3 → … → ${colorLabels[1]} 10`,
    items: stage.items.map((item) => ({
      ...item,
      color: item.color === "blue" ? second : first,
      ariaLabel: index === 0 ? String(item.number) : undefined,
    })),
  }));
}
