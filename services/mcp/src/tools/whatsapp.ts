import axios from 'axios';
import { createLogger } from '@aspri/logger';

const logger = createLogger('mcp-whatsapp-tools');

const WHATSAPP_API_URL = `http://localhost:${process.env.WHATSAPP_PORT || 3001}/api`;

export const whatsappTools = [
  {
    name: 'whatsapp_send_message',
    description: 'Send a WhatsApp message to a contact or group',
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

export async function handleWhatsAppTool(name: string, args: any) {
  switch (name) {
    case 'whatsapp_send_message': {
      const { phoneNumber, message } = args;
      const response = await axios.post(`${WHATSAPP_API_URL}/send-message`, {
        phoneNumber,
        message,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Message sent successfully to ${phoneNumber}`,
          },
        ],
      };
    }

    case 'whatsapp_get_messages': {
      const { phoneNumber, limit = 10 } = args;
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
