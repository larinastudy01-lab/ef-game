import { buildLBAssessmentStages, getLBAssessmentVersion, LB_ASSESSMENT_VERSIONS } from "./lbAssessmentConfig";
import { LB_TEST_STAGES } from "../pages/TestPage_LB";

jest.mock("../utils/lbDoorplateAssets", () => ({}));

test.each([
  ["01", "石頭", ["lightgray", "gray"]],
  ["02", "信箱", ["red", "purple"]],
])("test %s keeps practice and assessment in the same stimulus family", (version, stimulusName, colors) => {
  const assessment = getLBAssessmentVersion(version);
  expect(assessment).toMatchObject({ testVersion: version, stimulusName, colors, stimulusSetId: `test${version}` });
  const stages = buildLBAssessmentStages(LB_TEST_STAGES, assessment);
  expect(stages.map((stage) => stage.sequence)).toEqual(LB_TEST_STAGES.map((stage) => stage.sequence));
  expect(stages[0].items).toHaveLength(10);
  expect(stages[0].items.every((item) => item.color === colors[0])).toBe(true);
  expect(stages[1].items).toHaveLength(20);
  const itemsByKey = new Map(stages[1].items.map((item) => [item.key, item]));
  expect(stages[1].sequence.map((key) => itemsByKey.get(key).color)).toEqual(
    Array.from({ length: 10 }, (_, index) => colors[index % 2])
  );
  Object.values(assessment.practiceStages).forEach((stage) => {
    expect(stage.items.every((item) => colors.includes(item.color))).toBe(true);
    expect(stage.demoKeys.every((key) => stage.sequence.includes(key))).toBe(true);
  });
  Object.values(assessment.practiceAudio).forEach((src) => expect(src).toBeTruthy());
  Object.values(assessment.formalAudio).forEach((src) => expect(src).toBeTruthy());
  expect(assessment.practiceAudio.rule1).toContain(stimulusName);
  expect(assessment.practiceAudio.colorError).toContain(version === "01" ? "淺灰色、深灰色" : "紅色、紫色");
});

test("the assessment catalog excludes training and landmark", () => {
  expect(Object.keys(LB_ASSESSMENT_VERSIONS)).toEqual(["01", "02"]);
  expect(getLBAssessmentVersion("landmark").testVersion).toBe("01");
  expect(getLBAssessmentVersion("training").testVersion).toBe("01");
});
