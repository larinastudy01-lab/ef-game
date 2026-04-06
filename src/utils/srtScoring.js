export function calculateSRTStar({
  hitRate,
  avgRT,
  stdRT,
  firstHalfAvg,
  secondHalfAvg,
}) {
  const attentionDrop = secondHalfAvg - firstHalfAvg;

  let star = 1;
  let level = "需再練習";
  let feedback = "再多練習一下，會越來越厲害！";

  // ===== 三星 =====
  if (
    hitRate >= 85 &&
    avgRT <= 650 &&
    stdRT <= 180 &&
    attentionDrop <= 120
  ) {
    star = 3;
    level = "表現很好";
    feedback = "反應又快又穩定，專注力表現很好！";
  }

  // ===== 二星 =====
  else if (
    hitRate >= 65 &&
    avgRT <= 850 &&
    stdRT <= 260
  ) {
    star = 2;
    level = "表現不錯";
    feedback = "有掌握到節奏，再多練習會更棒！";
  }

  // ===== 一星 =====
  else {
    star = 1;
    level = "需再練習";
    feedback = "慢慢來沒關係，多玩幾次會更熟悉！";
  }

  return {
    star,
    level,
    feedback,
    attentionDrop,
  };
}