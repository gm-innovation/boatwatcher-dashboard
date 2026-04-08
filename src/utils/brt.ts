/**
 * BRT (Brasília Time, UTC-3) utilities.
 *
 * All timestamps in the database are stored in UTC.
 * This module provides helpers that explicitly convert to BRT
 * so the UI and exports are consistent regardless of the
 * system timezone of the browser or Electron renderer.
 */

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3

/**
 * Returns a Date shifted by -3h so that its *UTC* methods give BRT values.
 * This is a "fake UTC" date that makes it easy to use getUTCHours(), etc.
 */
export function toBrtDate(input: string | Date): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(d.getTime() + BRT_OFFSET_MS);
}

/** Get the BRT hour (0-23) from a UTC timestamp. */
export function getBrtHour(timestamp: string | Date): number {
  const utcHour = new Date(typeof timestamp === 'string' ? timestamp : timestamp.getTime()).getUTCHours();
  return (utcHour - 3 + 24) % 24;
}

/** Format a UTC timestamp as "HH:mm" in BRT. */
export function formatBrtTime(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const hh = String(brt.getUTCHours()).padStart(2, '0');
  const mm = String(brt.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Format a UTC timestamp as "HH:mm:ss" in BRT. */
export function formatBrtTimeFull(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const hh = String(brt.getUTCHours()).padStart(2, '0');
  const mm = String(brt.getUTCMinutes()).padStart(2, '0');
  const ss = String(brt.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Format a UTC timestamp as "dd/MM HH:mm" in BRT. */
export function formatBrtShort(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const dd = String(brt.getUTCDate()).padStart(2, '0');
  const MM = String(brt.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${MM} ${formatBrtTime(timestamp)}`;
}

/** Format a UTC timestamp as "dd/MM/yyyy HH:mm" in BRT. */
export function formatBrtDateTime(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const dd = String(brt.getUTCDate()).padStart(2, '0');
  const MM = String(brt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = brt.getUTCFullYear();
  return `${dd}/${MM}/${yyyy} ${formatBrtTime(timestamp)}`;
}

/** Format a UTC timestamp as "dd/MM/yyyy HH:mm:ss" in BRT. */
export function formatBrtDateTimeFull(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const dd = String(brt.getUTCDate()).padStart(2, '0');
  const MM = String(brt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = brt.getUTCFullYear();
  return `${dd}/${MM}/${yyyy} ${formatBrtTimeFull(timestamp)}`;
}

/** Get "yyyy-MM-dd" day key in BRT for grouping events by day. */
export function getBrtDayKey(timestamp: string | Date): string {
  const brt = toBrtDate(timestamp);
  const yyyy = brt.getUTCFullYear();
  const MM = String(brt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(brt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
}

/** Check if a timestamp falls in the daytime shift (05:00–18:59 BRT). */
export function isDaytimeBrt(timestamp: string | Date): boolean {
  const h = getBrtHour(timestamp);
  return h >= 5 && h <= 18;
}

/** Classify shift as day or night based on BRT hour. */
export function classifyShiftBrt(timestamp: string | Date): 'day' | 'night' {
  return isDaytimeBrt(timestamp) ? 'day' : 'night';
}

/**
 * Compute the UTC boundaries of a BRT calendar day.
 * - Midnight BRT = 03:00 UTC
 * - End of day BRT (23:59:59.999) = next day 02:59:59.999 UTC
 */
export function getBrtDayBoundsUtc(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
  const endUtc = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999));
  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  };
}

/** Format "now" in BRT as "dd/MM/yyyy 'às' HH:mm". */
export function formatBrtNow(): string {
  return `${formatBrtDateTime(new Date())}`;
}
