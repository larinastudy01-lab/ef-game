export function averageFiniteRounded(numbers = []) {
  const validNumbers = numbers.filter(
    (number) => typeof number === "number" && Number.isFinite(number)
  );

  if (validNumbers.length === 0) return 0;

  return Math.round(
    validNumbers.reduce((sum, number) => sum + number, 0) / validNumbers.length
  );
}
