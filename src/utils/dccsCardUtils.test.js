import {
  arrangeDccsTargets,
  getDccsTargetSide,
  isDccsBagRecord,
  normalizeDccsToken,
  pickDiverseDccsCards,
} from "./dccsCardUtils";

test("normalizes DCCS asset identifiers", () => {
  expect(normalizeDccsToken("Folder\\Blue Hat.webp")).toBe("folder/blue_hat");
  expect(isDccsBagRecord({ src: "red_hat_plastic.webp" })).toBe(true);
});

test("arranges targets and resolves their side", () => {
  const targets = arrangeDccsTargets({ color: "red" }, { color: "blue" }, false);
  expect(getDccsTargetSide(targets, "color", "red")).toBe("bottom");
});

test("selects unique card identities and color-type pairs", () => {
  const cards = [
    { id: "a", color: "red", type: "hat" },
    { id: "b", color: "red", type: "hat" },
    { id: "c", color: "blue", type: "shirt" },
  ];
  expect(pickDiverseDccsCards(cards, 2).map((card) => card.id)).toEqual(["a", "c"]);
});
