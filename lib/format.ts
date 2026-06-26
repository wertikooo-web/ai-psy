/**
 * Shared formatting utilities for the whole app.
 */

/** Russian pluralization: 0 встреч, 1 встреча, 2 встречи, 21 встреча */
export function pluralMeetings(n: number): string {
  const abs = Math.abs(n);
  const mod10  = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} встреч`;
  if (mod10 === 1)                   return `${n} встреча`;
  if (mod10 >= 2 && mod10 <= 4)     return `${n} встречи`;
  return `${n} встреч`;
}
