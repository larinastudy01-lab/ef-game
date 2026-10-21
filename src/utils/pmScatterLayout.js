// Positions use the measured board, including space for the selected scale and
// halo. A seeded generator keeps a question still across React renders.
function seededRandom(seed) {
  let value = 2166136261;
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPMScatterLayout({ count, width, height, seed = 0, maxSize = 176 }) {
  if (!count || width <= 0 || height <= 0) return [];
  const random = seededRandom(seed);
  const padding = Math.min(16, width * 0.025, height * 0.025);
  const gap = Math.min(16, width * 0.02, height * 0.02);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  let best = { size: 0, columns: 1, rows: count };
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const size = Math.min(usableWidth / columns, usableHeight / rows);
    if (size > best.size) best = { size, columns, rows };
  }
  // Reserve the full 1.05 selection scale, 7px halo and a gap on both axes.
  const size = Math.max(1, Math.min(maxSize, (best.size - gap - 14) / 1.05));
  const envelope = size * 1.05 + 14;
  const half = envelope / 2;
  const positions = [];
  for (let index = 0; index < count; index += 1) {
    let candidate;
    for (let attempt = 0; attempt < 350; attempt += 1) {
      const x = padding + half + random() * Math.max(0, usableWidth - envelope);
      const y = padding + half + random() * Math.max(0, usableHeight - envelope);
      if (positions.every((point) => Math.abs(point.x - x) >= envelope + gap || Math.abs(point.y - y) >= envelope + gap)) {
        candidate = { x, y };
        break;
      }
    }
    if (!candidate) break;
    positions.push(candidate);
  }
  if (positions.length !== count) {
    // Dense boards use safe cells with random offsets. Cell boundaries reserve
    // the same envelope, so even the fallback has a collision guarantee.
    positions.length = 0;
    const cellWidth = usableWidth / best.columns;
    const cellHeight = usableHeight / best.rows;
    const cells = Array.from({ length: best.columns * best.rows }, (_, index) => index);
    for (let index = cells.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [cells[index], cells[other]] = [cells[other], cells[index]];
    }
    cells.slice(0, count).forEach((cell) => positions.push({
      x: padding + (cell % best.columns) * cellWidth + cellWidth / 2 + (random() - 0.5) * Math.max(0, cellWidth - envelope - gap),
      y: padding + Math.floor(cell / best.columns) * cellHeight + cellHeight / 2 + (random() - 0.5) * Math.max(0, cellHeight - envelope - gap),
    }));
  }
  return positions.map(({ x, y }) => ({ left: x - size / 2, top: y - size / 2, size }));
}
