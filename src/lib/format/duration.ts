function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** "04:52" (or "1:04:52" past an hour); pass milliseconds:true for the editor timeline ("00:12.533"). */
export function formatDuration(totalSeconds: number, opts?: { milliseconds?: boolean }): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const totalMs = Math.round(totalSeconds * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const base = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return opts?.milliseconds ? `${base}.${pad(millis, 3)}` : base;
}
