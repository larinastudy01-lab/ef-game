// Seconds within the existing recordings, following the spoken number/color.
// Read the media clock so buffering, pauses and replay do not advance the glow.
const SPOKEN_DOORPLATES = {
  rule1: [[1.7, 4, 0]],
  turn1: [[0.4, 2.8, 0]],
  rule2: [[3.5, 5.1, 0], [5.1, 6.5, 1]],
  guide2: [[0.2, 2.9, 0], [2.9, 5.3, 1]],
  retry1: [[1.3, 3.4, 0]],
  retry2: [[2.3, 4.1, 0], [4.1, 5.7, 1]],
};

export function getLBVoiceHighlightKey(playback, stage) {
  if (!playback || !stage) return null;
  const segment = SPOKEN_DOORPLATES[playback.event]?.find(
    ([start, end]) => playback.currentTime >= start && playback.currentTime < end
  );
  return segment ? stage.sequence[segment[2]] || null : null;
}
