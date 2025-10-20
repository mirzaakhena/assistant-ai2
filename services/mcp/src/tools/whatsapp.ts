import axios from 'axios';
import { createLogger } from '@aspri/logger';
import { validatorRegistry } from '@aspri/utils';

const logger = createLogger('mcp-whatsapp-tools');

const WHATSAPP_API_URL = `http://localhost:${process.env.WHATSAPP_PORT || 3001}/api`;

export const whatsappTools = [
  {
    name: 'whatsapp_send_message',
    description: 'Send a WhatsApp message to a contact or group. IMPORTANT: Always use dryRun=true to validate recipient before creating scheduled tasks (cronjobs).',
    inputSchema: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Phone number in international format (e.g., 628123456789) or chat ID',
        },
        message: {
          type: 'string',
          description: 'Message text to send',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only validate recipient without sending message. Use this before creating cronjobs to ensure recipient is in whitelist.',
          default: false,
        },
      },
      required: ['phoneNumber', 'message'],
    },
  },
  {
    name: 'whatsapp_get_messages',
    description: 'Get recent messages from a chat',
    inputSchema: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Phone number in international format or chat ID',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to retrieve (default: 10)',
          default: 10,
        },
      },
      required: ['phoneNumber'],
    },
  },
  {
    name: 'whatsapp_get_chats',
    description: 'Get list of recent chats',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of chats to retrieve (default: 20)',
          default: 20,
        },
      },
    },
  },
  {
    name: 'whatsapp_search_contacts',
    description: 'Search for contacts by name or phone number',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (name or phone number)',
        },
      },
      required: ['query'],
    },
  },
];

export async function handleWhatsAppTool(name: string, args: any, context?: { userId?: string }) {
  switch (name) {
    case 'whatsapp_send_message': {
      const { phoneNumber, message, dryRun = false } = args;
      const userId = context?.userId;

      logger.info({
        phoneNumber,
        message,
        dryRun,
        userId
      }, 'Executing whatsapp_send_message tool');

      // ✅ VALIDATION: Check whitelist if userId is provided
      if (userId) {
        const validationResult = await validatorRegistry.validate(
          'whatsapp_send_message',
          phoneNumber,
          { userId, dryRun }
        );

        if (!validationResult.valid) {
          logger.warn({ phoneNumber, userId, error: validationResult.error }, 'Validation failed');

          return {
            content: [{
              type: 'text',
              text: `❌ Validasi gagal: ${validationResult.error}\n\n` +
                    `Nomor ${phoneNumber} tidak ada dalam whitelist Anda.\n` +
                    `Silakan tambahkan nomor ini ke daftar kontak yang diizinkan terlebih dahulu.`,
            }],
            isError: true,
          };
        }

        // If dry-run, return success without sending
        if (dryRun) {
          logger.info({ phoneNumber, userId }, 'Dry-run validation passed');
          return {
            content: [{
              type: 'text',
              text: `✅ Validasi berhasil untuk nomor ${phoneNumber}\n` +
                    `Anda dapat melanjutkan untuk membuat jadwal pengiriman.`,
            }],
          };
        }
      }

      // ✅ ACTUAL SEND (if not dry-run)
      try {
        const response = await axios.post(`${WHATSAPP_API_URL}/send-message`, {
          phoneNumber,
          message,
        });

        logger.info({
          phoneNumber,
          message,
          success: response.data.success
        }, 'WhatsApp message sent via API');

        return {
          content: [{
            type: 'text',
            text: `✅ Pesan berhasil dikirim ke ${phoneNumber}`,
          }],
        };
      } catch (error: any) {
        logger.error({ error, phoneNumber }, 'Failed to send message');
        return {
          content: [{
            type: 'text',
            text: `❌ Gagal mengirim pesan: ${error.message}`,
          }],
          isError: true,
        };
      }
    }

    case 'whatsapp_get_messages': {
      const { phoneNumber, limit = 10 } = args;
      logger.info({ phoneNumber, limit }, 'Executing whatsapp_get_messages tool');
      const response = await axios.get(`${WHATSAPP_API_URL}/messages/${phoneNumber}`, {
        params: { limit },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.data, null, 2),
          },
        ],
      };
    }

    case 'whatsapp_get_chats': {
      const { limit = 20 } = args;
      logger.info({ limit }, 'Executing whatsapp_get_chats tool');
      const response = await axios.get(`${WHATSAPP_API_URL}/chats`, {
        params: { limit },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.data, null, 2),
          },
        ],
      };
    }

    case 'whatsapp_search_contacts': {
      const { query } = args;
      logger.info({ query }, 'Executing whatsapp_search_contacts tool');
      const response = await axios.get(`${WHATSAPP_API_URL}/contacts/search`, {
        params: { q: query },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.data, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown WhatsApp tool: ${name}`);
  }
}
