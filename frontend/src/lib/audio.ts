/**
 * Plays one WAV clip sent by the server as base64. Autoplay can be blocked; failures are ignored.
 * `onStart` / `onEnd` fire when the clip actually starts and stops, so the UI can follow the voice.
 */
export function playWavBase64(wavBase64: string, onStart?: () => void, onEnd?: () => void): void {
  if (typeof Audio === 'undefined') return;
  const audio = new Audio(`data:audio/wav;base64,${wavBase64}`);
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    onEnd?.();
  };
  audio.addEventListener('playing', () => onStart?.());
  audio.addEventListener('ended', finish);
  audio.addEventListener('error', finish);
  audio.addEventListener('pause', finish);
  audio.play().catch(() => finish());
}
