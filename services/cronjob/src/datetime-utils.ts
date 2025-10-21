/**
 * Datetime utility functions for converting between timestamp and yyyyMMddHHmmss format
 */

/**
 * Convert yyyyMMddHHmmss string to milliseconds timestamp
 * @param dateTimeString - String in format "yyyyMMddHHmmss" (e.g., "20251021053321")
 * @returns Milliseconds timestamp
 * @throws Error if format is invalid
 */
export function parseDateTime(dateTimeString: string): number {
  // Validate format
  if (!/^\d{14}$/.test(dateTimeString)) {
    throw new Error(
      `Invalid datetime format. Expected "yyyyMMddHHmmss" (14 digits), received: "${dateTimeString}"`
    );
  }

  const year = parseInt(dateTimeString.substring(0, 4), 10);
  const month = parseInt(dateTimeString.substring(4, 6), 10);
  const day = parseInt(dateTimeString.substring(6, 8), 10);
  const hour = parseInt(dateTimeString.substring(8, 10), 10);
  const minute = parseInt(dateTimeString.substring(10, 12), 10);
  const second = parseInt(dateTimeString.substring(12, 14), 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 01 and 12`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}. Must be between 01 and 31`);
  }
  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be between 00 and 23`);
  }
  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be between 00 and 59`);
  }
  if (second < 0 || second > 59) {
    throw new Error(`Invalid second: ${second}. Must be between 00 and 59`);
  }

  // Create date object (month is 0-indexed in JavaScript Date)
  const date = new Date(year, month - 1, day, hour, minute, second);

  // Check if the date is valid (handles invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    throw new Error(
      `Invalid date: ${dateTimeString}. ` +
      `The date components do not represent a valid calendar date/time`
    );
  }

  return date.getTime();
}

/**
 * Convert milliseconds timestamp to yyyyMMddHHmmss string
 * @param timestamp - Milliseconds timestamp
 * @returns String in format "yyyyMMddHHmmss"
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);

  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * Check if a string is in yyyyMMddHHmmss format
 * @param value - Value to check
 * @returns true if valid format, false otherwise
 */
export function isDateTimeFormat(value: any): boolean {
  return typeof value === 'string' && /^\d{14}$/.test(value);
}
