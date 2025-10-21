/**
 * Duration utility functions for parsing relative time format (e.g., "2h3m4s")
 */

/**
 * Parse duration string to milliseconds
 * Supports format: [Xh][Ym][Zs] where X, Y, Z are numbers
 * Examples:
 * - "2h" = 2 hours
 * - "3m" = 3 minutes
 * - "4s" = 4 seconds
 * - "2h3m4s" = 2 hours, 3 minutes, 4 seconds
 * - "2h3m" = 2 hours, 3 minutes
 * - "2h4s" = 2 hours, 4 seconds
 * - "3m4s" = 3 minutes, 4 seconds
 *
 * @param durationString - Duration string in format [Xh][Ym][Zs]
 * @returns Milliseconds
 * @throws Error if format is invalid
 */
export function parseDuration(durationString: string): number {
  if (typeof durationString !== 'string' || !durationString.trim()) {
    throw new Error(`Invalid duration: expected non-empty string, received: "${durationString}"`);
  }

  const trimmed = durationString.trim();

  // Validate format using regex
  const durationRegex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = trimmed.match(durationRegex);

  if (!match) {
    throw new Error(
      `Invalid duration format: "${durationString}". ` +
      `Expected format: [Xh][Ym][Zs] where X, Y, Z are numbers. ` +
      `Examples: "2h", "3m", "4s", "2h3m4s", "2h3m", "2h4s", "3m4s"`
    );
  }

  const [, hoursStr, minutesStr, secondsStr] = match;

  // At least one unit must be specified
  if (!hoursStr && !minutesStr && !secondsStr) {
    throw new Error(
      `Invalid duration: "${durationString}". ` +
      `At least one time unit (h, m, or s) must be specified. ` +
      `Examples: "2h", "3m", "4s", "2h3m4s"`
    );
  }

  const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
  const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;
  const seconds = secondsStr ? parseInt(secondsStr, 10) : 0;

  // Validate ranges (reasonable limits)
  if (hours < 0 || hours > 8760) { // Max 1 year
    throw new Error(`Invalid hours: ${hours}. Must be between 0 and 8760 (1 year)`);
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minutes: ${minutes}. Must be between 0 and 59`);
  }
  if (seconds < 0 || seconds > 59) {
    throw new Error(`Invalid seconds: ${seconds}. Must be between 0 and 59`);
  }

  // Convert to milliseconds
  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

  if (totalMs === 0) {
    throw new Error(`Duration cannot be zero. Please specify a positive duration.`);
  }

  return totalMs;
}

/**
 * Format milliseconds to duration string
 * @param milliseconds - Duration in milliseconds
 * @returns Duration string in format [Xh][Ym][Zs]
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 0) {
    throw new Error(`Duration must be positive, received: ${milliseconds}ms`);
  }

  const totalSeconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = '';
  if (hours > 0) result += `${hours}h`;
  if (minutes > 0) result += `${minutes}m`;
  if (seconds > 0) result += `${seconds}s`;

  return result || '0s';
}

/**
 * Check if a string is in duration format
 * @param value - Value to check
 * @returns true if valid duration format, false otherwise
 */
export function isDurationFormat(value: any): boolean {
  if (typeof value !== 'string') return false;
  const durationRegex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = value.trim().match(durationRegex);
  if (!match) return false;
  const [, hours, minutes, seconds] = match;
  return !!(hours || minutes || seconds);
}

/**
 * Calculate future timestamp from duration
 * @param durationString - Duration string
 * @returns Future timestamp in milliseconds
 */
export function getFutureTimestamp(durationString: string): number {
  const durationMs = parseDuration(durationString);
  return Date.now() + durationMs;
}
