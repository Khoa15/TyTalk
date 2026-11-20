/** Plays one WAV clip sent by the server as base64. Autoplay can be blocked; failures are ignored. */
export function playWavBase64(wavBase64: string): void {
  if (typeof Audio === 'undefined') return;
  const audio = new Audio(`data:audio/wav;base64,${wavBase64}`);
  void audio.play().catch(() => undefined);
}
