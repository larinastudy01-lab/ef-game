const selection = (version, stimulusSetId, stimulusName, categoryKeys) => Object.freeze({
  version, testVersion: version, stimulusSetId, stimulusName, categoryKeys: Object.freeze(categoryKeys),
});

export const PM_ASSESSMENT_VERSIONS = Object.freeze({
  "01": selection("01", "test01", "交通工具／穿戴配件", ["car", "clothes"]),
  "02": selection("02", "test02", "交通工具／家具", ["car", "furniture"]),
});

export const PM_TRAINING_VERSIONS = Object.freeze({
  "01": selection("01", "training-food", "食物", ["food"]),
  "02": selection("02", "training-ball", "球具", ["ball"]),
});

export const getPMStimulusVersions = (mode) => {
  if (mode === "test") return PM_ASSESSMENT_VERSIONS;
  if (mode === "training") return PM_TRAINING_VERSIONS;
  throw new Error(`Unknown PM stimulus mode: ${mode}`);
};

export const getPMStimulusMetadata = (stimulus, mode) => ({
  ...(mode === "test" ? { testVersion: stimulus.version } : { trainingStimulusVersion: stimulus.version }),
  stimulusSetId: stimulus.stimulusSetId,
  stimulusName: stimulus.stimulusName,
  stimulusCategories: [...stimulus.categoryKeys],
});
