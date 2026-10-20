import {
  CBT_TRAINING_STONE_SIZE,
  createFixedCBTBlocks,
  createVariableCBTBlocks,
} from "./cbtProtocol";

const visiblePositions = (blocks) => blocks.map(({ left, top }) => `${left},${top}`).sort();

test("expert trials change visible positions even with the same random values", () => {
  let previous = createFixedCBTBlocks();
  for (let trial = 0; trial < 4; trial += 1) {
    const next = createVariableCBTBlocks(9, previous, () => 0.5);
    expect(visiblePositions(next)).not.toEqual(visiblePositions(previous));
    expect(next.map(({ stoneId }) => stoneId)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    previous = next;
  }
});

test("variable training targets stay inside the board without overlapping at extreme offsets", () => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const width = CBT_TRAINING_STONE_SIZE;
  const height = Math.round(width * 203 / 360);
  for (const count of [7, 8, 9]) {
    for (const rng of [() => 0, () => 0.999999, random]) {
      let previous = [];
      for (let trial = 0; trial < 20; trial += 1) {
        const blocks = createVariableCBTBlocks(count, previous, rng);
        expect(blocks).toHaveLength(count);
        blocks.forEach((block, index) => {
          expect(block.left - width / 2).toBeGreaterThanOrEqual(0);
          expect(block.left + width / 2).toBeLessThanOrEqual(760);
          expect(block.top - height / 2).toBeGreaterThanOrEqual(0);
          expect(block.top + height / 2).toBeLessThanOrEqual(455);
          blocks.slice(index + 1).forEach((other) => {
            expect(Math.abs(block.left - other.left) >= width
              || Math.abs(block.top - other.top) >= height).toBe(true);
          });
        });
        previous = blocks;
      }
    }
  }
});
