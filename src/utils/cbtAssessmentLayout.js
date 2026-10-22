import { createFixedCBTBlocks } from "./cbtProtocol";

// Presentation only: keep stable stone IDs and the assessment sequence rules.
// Larger targets have 20px horizontal and 31px vertical gaps at full scale.
export const CBT_ASSESSMENT_LAYOUT = { width: 960, height: 600, stoneSize: 300 };

export function createCBTAssessmentBlocks() {
  return createFixedCBTBlocks().map((block, index) => ({
    ...block,
    left: 160 + (index % 3) * 320,
    top: 100 + Math.floor(index / 3) * 200,
  }));
}
