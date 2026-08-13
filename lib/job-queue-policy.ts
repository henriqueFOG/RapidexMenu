export function retryDelayMs(attempt: number) {
  const safeAttempt = Math.max(1, Math.min(10, Math.floor(attempt)));
  const base = 30_000 * (2 ** (safeAttempt - 1));
  return Math.min(6 * 60 * 60_000, base);
}
