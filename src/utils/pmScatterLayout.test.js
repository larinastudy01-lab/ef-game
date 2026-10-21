import { createPMScatterLayout } from "./pmScatterLayout";

// Also cover the narrower pane beside the chicken and the shorter pane above
// it on a portrait tablet, including future dense thirteen-picture boards.
test.each([[1120, 470], [768, 690], [980, 460], [560, 380], [344, 350], [360, 470], [740, 350]])(
  "%i × %i boards keep up to thirteen selected cards and their halos separated and inside bounds", (width, height) => {
    for (const count of [1, 2, 4, 7, 13]) {
      for (let seed = 0; seed < 60; seed += 1) {
        const layout = createPMScatterLayout({ width, height, count, seed });
        expect(layout).toHaveLength(count);
        layout.forEach((card, index) => {
          const extra = card.size * 0.025 + 7;
          expect(card.left - extra).toBeGreaterThanOrEqual(0);
          expect(card.top - extra).toBeGreaterThanOrEqual(0);
          expect(card.left + card.size + extra).toBeLessThanOrEqual(width);
          expect(card.top + card.size + extra).toBeLessThanOrEqual(height);
          layout.slice(index + 1).forEach((other) => {
            const separation = card.size * 1.05 + 14;
            expect(Math.abs(card.left - other.left) >= separation || Math.abs(card.top - other.top) >= separation).toBe(true);
          });
        });
      }
    }
  }
);

test("the same question and container retain their positions, and new seeds rearrange them", () => {
  const input = { width: 960, height: 500, count: 4, seed: "round-1" };
  expect(createPMScatterLayout(input)).toEqual(createPMScatterLayout(input));
  expect(createPMScatterLayout(input)).not.toEqual(createPMScatterLayout({ ...input, seed: "round-2" }));
});
