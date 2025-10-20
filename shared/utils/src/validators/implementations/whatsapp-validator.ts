import { BaseToolValidator } from '../base.js';

/**
 * WhatsApp-specific validator
 * Validates phone numbers against WhatsApp whitelist
 */
export class WhatsAppValidator extends BaseToolValidator {
  readonly toolName = 'whatsapp_send_message';
  readonly resourceType = 'phone_number';

  /**
   * Get WhatsApp whitelist for a user
   * TODO: Replace with database query
   */
  async getWhitelist(userId: string): Promise<string[]> {
    // Normalize userId to extract phone number (remove @c.us if present)
    const normalizedUserId = this.normalize(userId);

    // Default: user can only message themselves
    const whitelist = [normalizedUserId];

    // Hardcoded whitelist for testing
    // TODO: Replace with database query
    const hardcodedWhitelists: Record<string, string[]> = {
      '6281321127717': ['6281321127717', '628111222333', '628999888777', '628555666777'],
      '628123456789': ['628111111111', '628222222222'],
    };

    if (hardcodedWhitelists[normalizedUserId]) {
      whitelist.push(...hardcodedWhitelists[normalizedUserId]);
    }

    // Future: Fetch from database
    // const dbWhitelist = await db.query(
    //   'SELECT phone_number FROM whatsapp_whitelist WHERE user_id = ?',
    //   [normalizedUserId]
    // );
    // whitelist.push(...dbWhitelist.map(row => row.phone_number));

    this.logger.debug({
      userId,
      normalizedUserId,
      count: whitelist.length
    }, 'WhatsApp whitelist loaded');

    return [...new Set(whitelist)]; // Remove duplicates
  }

  /**
   * Normalize phone number format
   * Removes spaces, dashes, WhatsApp suffix (@c.us), and ensures consistent format
   */
  normalize(phoneNumber: string): string {
    // Remove WhatsApp suffix (@c.us, @s.whatsapp.net, etc.)
    let normalized = phoneNumber.replace(/@.*$/, '');

    // Remove spaces, dashes, parentheses
    normalized = normalized.replace(/[\s\-\(\)]/g, '');

    // Remove leading + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }

    // Remove leading 0 and add 62 for Indonesian numbers
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.substring(1);
    }

    return normalized;
  }
}
