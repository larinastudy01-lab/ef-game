export const analyzeFatigue = ({
  firstHalfRT,
  secondHalfRT,
  missIncrease,
}) => {
  let fatigueLevel = "low";

  if (
    secondHalfRT > firstHalfRT * 1.3 ||
    missIncrease >= 3
  ) {
    fatigueLevel = "high";
  } else if (
    secondHalfRT > firstHalfRT * 1.15
  ) {
    fatigueLevel = "medium";
  }

  return fatigueLevel;
};