// Practice is deliberately separate from the two scored LB_TEST_STAGES.
export const LB_MODES = {
  practiceMode1: "practiceMode1",
  practiceMode2: "practiceMode2",
  formalMode: "formalMode",
};

const yellow = (number) => ({ key: `yellow-${number}`, color: "yellow", number });
const blue = (number) => ({ key: `blue-${number}`, color: "blue", number });

export const LB_PRACTICE_STAGES = {
  practiceMode1: {
    id: "practiceMode1",
    title: "試玩一",
    instruction: "請按照數字順序選擇。",
    items: [1, 2, 3, 4, 5].map(yellow),
    sequence: [1, 2, 3, 4, 5].map((number) => `yellow-${number}`),
    demoKeys: ["yellow-1"],
  },
  practiceMode2: {
    id: "practiceMode2",
    title: "試玩二",
    instruction: "請按照數字順序，並輪流選擇不同顏色。",
    items: [yellow(1), blue(2), yellow(3), blue(4), yellow(5), blue(6),
      blue(1), yellow(2), blue(3), yellow(4)],
    sequence: ["yellow-1", "blue-2", "yellow-3", "blue-4", "yellow-5", "blue-6"],
    demoKeys: ["yellow-1", "blue-2"],
  },
};

// Shuffle cards among separated slots rather than retrying random coordinates.
// Leave the lower right corner free for grandma's house.
export function buildLBPracticeItems(stage) {
  const slots = stage.id === LB_MODES.practiceMode1
    ? [[16, 26], [49, 18], [80, 30], [30, 68], [59, 64]]
    : [[12, 19], [36, 15], [59, 22], [83, 16], [16, 46],
      [40, 44], [64, 48], [87, 43], [13, 75], [38, 73]];
  const shuffled = [...stage.items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.map((item, index) => ({
    ...item,
    position: { left: `${slots[index][0]}%`, top: `${slots[index][1]}%` },
  }));
}
