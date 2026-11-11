import { PM_ITEMS } from "./pmItems";
import { PM_ASSESSMENT_VERSIONS, PM_TRAINING_VERSIONS } from "../config/pmStimulusConfig";
import { getNextPMStimulus, getPMStimulusUsage, recordPMStimulusExposure } from "./pmStimulusUsage";
import { resetGameTestingMemory, startTemporaryGameTesting } from "../temporaryGameTesting/runtime";

let storage;
beforeEach(() => {
  const values = new Map();
  storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
});
const item = (category) => PM_ITEMS.find((entry) => entry.assetCategoryKey === category);
const save = (childId, mode, usage) => storage.setItem(`pmStimulusUsage_${mode}_${childId}`, JSON.stringify(usage));

test("read-only selection is stable; actual category exposures determine the next version", () => {
  expect(getNextPMStimulus("a", "test", storage)).toBe(PM_ASSESSMENT_VERSIONS["01"]);
  expect(storage.getItem("pmStimulusUsage_test_a")).toBeNull();
  recordPMStimulusExposure("a", "test", PM_ASSESSMENT_VERSIONS["01"], [item("car"), item("clothes"), item("unclassified")], { storage, startSession: true });
  expect(getPMStimulusUsage("a", "test", storage)).toMatchObject({ lastVersion: "01", categoryCounts: { car: 1, clothes: 1, unclassified: 1 } });
  expect(getNextPMStimulus("a", "test", storage)).toBe(PM_ASSESSMENT_VERSIONS["02"]);
  expect(getNextPMStimulus("b", "test", storage)).toBe(PM_ASSESSMENT_VERSIONS["01"]);
});

test("lower category exposure takes priority; equal totals alternate away from the last version", () => {
  save("a", "test", { lastVersion: "02", categoryCounts: { car: 1000, clothes: 100, furniture: 3 } });
  expect(getNextPMStimulus("a", "test", storage).version).toBe("02");
  for (const [lastVersion, expected] of [["01", "02"], ["02", "01"]]) {
    save("a", "test", { lastVersion, categoryCounts: { clothes: 4, furniture: 4 } });
    expect(getNextPMStimulus("a", "test", storage).version).toBe(expected);
  }
});

test("food/ball training usage is separate from assessment and rejects cross-mode stimuli", () => {
  recordPMStimulusExposure("a", "training", PM_TRAINING_VERSIONS["01"], [item("food"), item("unclassified")], { storage, startSession: true });
  expect(getNextPMStimulus("a", "training", storage)).toBe(PM_TRAINING_VERSIONS["02"]);
  expect(getNextPMStimulus("a", "test", storage)).toBe(PM_ASSESSMENT_VERSIONS["01"]);
  expect(() => recordPMStimulusExposure("a", "test", PM_ASSESSMENT_VERSIONS["01"], [item("food")], { storage })).toThrow(/outside selected pool/);
});

test("QA exposures stay in memory and never alter a real child's usage history", () => {
  const key = "pmStimulusUsage_test_a";
  const original = JSON.stringify({ lastVersion: "02", categoryCounts: { clothes: 99, furniture: 99 } });
  localStorage.setItem(key, original);
  startTemporaryGameTesting(); resetGameTestingMemory();
  recordPMStimulusExposure("a", "test", PM_ASSESSMENT_VERSIONS["01"], [item("clothes")], { startSession: true });
  expect(getNextPMStimulus("a", "test").version).toBe("02");
  expect(localStorage.getItem(key)).toBe(original);
  resetGameTestingMemory();
  expect(getPMStimulusUsage("a", "test").categoryCounts).toEqual({});
});
