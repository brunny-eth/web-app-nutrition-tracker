import { format, parse, isValid } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Date Resolution Logic
 * 
 * Priority order:
 * 1. Explicit date in text (from LLM parsing) wins
 * 2. Otherwise, use client-submitted timestamp converted to user timezone
 * 
 * IMPORTANT: No "9pm rollover" heuristics. The date is deterministic.
 */

const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * How far back an LLM-extracted date may reach. Bounded because `explicit_date`
 * was only format-checked, so a misread relative date ("a year ago Tuesday") could
 * file food in 1970 or in the future, where it silently never appears in trends.
 * Measured against the submission timestamp rather than the wall clock so the
 * function stays deterministic.
 */
const MAX_BACKDATE_DAYS = 365;
const DAY_MS = 86_400_000;

/**
 * Resolves the date for a food entry
 * @param explicitDate - Date extracted from text by LLM (YYYY-MM-DD format), or null
 * @param clientTimestamp - The timestamp when the entry was submitted (ISO string or Date)
 * @param userTimezone - User's timezone (defaults to America/New_York)
 * @returns Object with resolved_date (YYYY-MM-DD) and whether date was explicit
 */
export function resolveDate(
  explicitDate: string | null,
  clientTimestamp: string | Date,
  userTimezone: string = DEFAULT_TIMEZONE
): { resolved_date: string; explicit_date_in_text: boolean } {
  const timestamp = typeof clientTimestamp === 'string'
    ? new Date(clientTimestamp)
    : clientTimestamp;

  // Priority 1: Explicit date from text, if it's plausible
  if (explicitDate && isValidDateString(explicitDate)) {
    const explicitMs = new Date(explicitDate + 'T12:00:00Z').getTime();
    const submittedMs = timestamp.getTime();
    const withinRange =
      explicitMs <= submittedMs + DAY_MS &&
      explicitMs >= submittedMs - MAX_BACKDATE_DAYS * DAY_MS;

    if (withinRange) {
      return {
        resolved_date: explicitDate,
        explicit_date_in_text: true,
      };
    }
    // Out of range — fall through to the submission timestamp rather than trust it.
  }

  // Priority 2: Convert client timestamp to user timezone

  const zonedDate = toZonedTime(timestamp, userTimezone);
  const resolved_date = format(zonedDate, 'yyyy-MM-dd');

  return {
    resolved_date,
    explicit_date_in_text: false,
  };
}

/**
 * Validates a date string is in YYYY-MM-DD format and represents a valid date
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  return isValid(parsed);
}

/**
 * Gets today's date in the user's timezone
 */
export function getTodayInTimezone(userTimezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, userTimezone);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Gets yesterday's date in the user's timezone
 */
export function getYesterdayInTimezone(userTimezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, userTimezone);
  zonedDate.setDate(zonedDate.getDate() - 1);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Formats a date string for display
 */
export function formatDateForDisplay(dateStr: string): string {
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(parsed, 'EEEE, MMMM d, yyyy');
}

/**
 * Formats a date string as short display (e.g., "Jan 29")
 */
export function formatDateShort(dateStr: string): string {
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(parsed, 'MMM d');
}

/**
 * Checks if a date is today in the user's timezone
 */
export function isToday(dateStr: string, userTimezone: string = DEFAULT_TIMEZONE): boolean {
  return dateStr === getTodayInTimezone(userTimezone);
}

/**
 * Checks if a date is yesterday in the user's timezone
 */
export function isYesterday(dateStr: string, userTimezone: string = DEFAULT_TIMEZONE): boolean {
  return dateStr === getYesterdayInTimezone(userTimezone);
}

/**
 * Gets a human-readable relative date (Today, Yesterday, or the date)
 */
export function getRelativeDateLabel(dateStr: string, userTimezone: string = DEFAULT_TIMEZONE): string {
  if (isToday(dateStr, userTimezone)) return 'Today';
  if (isYesterday(dateStr, userTimezone)) return 'Yesterday';
  return formatDateShort(dateStr);
}
