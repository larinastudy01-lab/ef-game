import { DCCS_ASSESSMENT_VERSIONS, getDccsAssessmentVersion } from "./dccsAssessmentVersions";
import { dccsClothingCards } from "./dccsClothingData";
import { buildDccsTrialSets } from "../pages/TestPage_DCCS";
import { buildDccsPracticeTrials, getDccsCorrectPosition, getDccsPreviousRulePosition } from "../utils/dccsAssessmentProtocol";

jest.mock("../asset/DCCS/test01/box_left.webp", () => "test01/box_left.webp");
jest.mock("../asset/DCCS/test01/box_right.webp", () => "test01/box_right.webp");
jest.mock("../asset/DCCS/test02/box_left.webp", () => "test02/box_left.webp");
jest.mock("../asset/DCCS/test02/box_right.webp", () => "test02/box_right.webp");

test.each([
  ["01", "pants", "socks"],
  ["02", "slippers", "scarf"],
])("copy %s uses its own normal/plastic stimuli and the identities printed on its boxes", (version, leftType, rightType) => {
  const assessment = getDccsAssessmentVersion(version);
  expect(assessment.cards).toHaveLength(4);
  expect(new Set(assessment.cards.map(({ color, type }) => `${color}_${type}`)))
    .toEqual(new Set([`blue_${leftType}`, `red_${leftType}`, `blue_${rightType}`, `red_${rightType}`]));
  expect(assessment.cards.every((card) => card.normalImg && card.bagImg && card.normalImg !== card.bagImg)).toBe(true);
  expect(assessment.boxReferences).toMatchObject({
    top: { id: `blue_${leftType}`, color: "blue", type: leftType },
    bottom: { id: `red_${rightType}`, color: "red", type: rightType },
  });
  expect(assessment.boxes).toEqual({ top: `test${version}/box_left.webp`, bottom: `test${version}/box_right.webp` });
  const bank = buildDccsTrialSets(assessment);
  expect([bank.colorTestTrials, bank.typeTestTrials, bank.bagColorTestTrials].map((trials) => trials.length)).toEqual([4, 4, 4]);
  for (const rule of ["category", "bag_color"]) {
    const trials = rule === "category" ? bank.typeTestTrials : bank.bagColorTestTrials;
    const practice = buildDccsPracticeTrials(trials, rule, assessment.boxReferences);
    expect(practice).toHaveLength(2);
    expect(new Set(practice.map(getDccsCorrectPosition))).toEqual(new Set(["top", "bottom"]));
    expect(practice.every((trial) => getDccsPreviousRulePosition(trial, rule, assessment.boxReferences) !== getDccsCorrectPosition(trial))).toBe(true);
  }
  expect(dccsClothingCards.every((card) => !assessment.cards.some((testCard) => testCard.normalImg === card.normalImg || testCard.bagImg === card.bagImg))).toBe(true);
});

test("test supports only 01/02; training keeps its own hat/shirt catalog", () => {
  expect(Object.keys(DCCS_ASSESSMENT_VERSIONS)).toEqual(["01", "02"]);
  expect(getDccsAssessmentVersion("training").testVersion).toBe("01");
  expect(getDccsAssessmentVersion("03").testVersion).toBe("01");
  expect(new Set(dccsClothingCards.map((card) => card.type))).toEqual(new Set(["hat", "shirt"]));
});
