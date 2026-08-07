export function normalizeDccsToken(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

export function getDccsImageSource(raw = {}) {
  return raw.normalImg || raw.normalImage || raw.img || raw.image || raw.src || raw.url || raw.asset || null;
}

export function getDccsBagImageSource(raw = {}) {
  return raw.bagImg || raw.bagImage || raw.packagedImg || raw.packagedImage || raw.bag || null;
}

export function isDccsBagRecord(raw = {}) {
  if (raw.isBagged === true || raw.bagged === true || raw.variant === "bag") return true;

  const sourceText = [raw.id, raw.key, raw.name, raw.filename, raw.path, raw.src, raw.url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(^|[\\/_-])bag([\\/_-]|$)|packaged|plastic/.test(sourceText);
}

export function arrangeDccsTargets(correctTarget, wrongTarget, correctOnTop) {
  return correctOnTop
    ? { topTarget: correctTarget, bottomTarget: wrongTarget }
    : { topTarget: wrongTarget, bottomTarget: correctTarget };
}

export function getDccsTargetSide(targets, field, key) {
  if (!key) return null;
  if (targets.topTarget?.[field] === key) return "top";
  if (targets.bottomTarget?.[field] === key) return "bottom";
  return null;
}

export function pickDiverseDccsCards(cards, count) {
  const selected = [];
  const usedIds = new Set();
  const usedPairs = new Set();

  for (const card of cards) {
    const pair = `${card.color}:${card.type}`;
    if (!usedIds.has(card.id) && !usedPairs.has(pair)) {
      selected.push(card);
      usedIds.add(card.id);
      usedPairs.add(pair);
    }
    if (selected.length >= count) return selected;
  }

  for (const card of cards) {
    if (!usedIds.has(card.id)) {
      selected.push(card);
      usedIds.add(card.id);
    }
    if (selected.length >= count) break;
  }

  return selected;
}
