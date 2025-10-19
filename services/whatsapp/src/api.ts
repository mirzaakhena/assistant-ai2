import { Router } from 'express';
import { WhatsAppClient } from './whatsapp-client.js';
import { createLogger } from '@aspri/logger';
import { ApiResponse } from '@aspri/types';

const logger = createLogger('whatsapp-api');

export function createApiRouter(whatsappClient: WhatsAppClient): Router {
  const router = Router();

  // Send message
  router.post('/send-message', async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          error: { message: 'phoneNumber and message are required' },
        } as ApiResponse);
      }

      await whatsappClient.sendMessage(phoneNumber, message);

      res.json({
        success: true,
        data: { phoneNumber, sent: true },
      } as ApiResponse);
    } catch (error: any) {
      logger.error({ error }, 'Error sending message');
      res.status(500).json({
        success: false,
        error: { message: error.message },
      } as ApiResponse);
    }
  });

  // Get messages
  router.get('/messages/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await whatsappClient.getMessages(phoneNumber, limit);

      res.json({
        success: true,
        data: messages,
      } as ApiResponse);
    } catch (error: any) {
      logger.error({ error }, 'Error getting messages');
      res.status(500).json({
        success: false,
        error: { message: error.message },
      } as ApiResponse);
    }
  });

  // Get chats
  router.get('/chats', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const chats = await whatsappClient.getChats(limit);

      res.json({
        success: true,
        data: chats,
      } as ApiResponse);
    } catch (error: any) {
      logger.error({ error }, 'Error getting chats');
      res.status(500).json({
        success: false,
        error: { message: error.message },
      } as ApiResponse);
    }
  });

  // Search contacts
  router.get('/contacts/search', async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: { message: 'query parameter "q" is required' },
        } as ApiResponse);
      }

      const contacts = await whatsappClient.searchContacts(query);

      res.json({
        success: true,
        data: contacts,
      } as ApiResponse);
    } catch (error: any) {
      logger.error({ error }, 'Error searching contacts');
      res.status(500).json({
        success: false,
        error: { message: error.message },
      } as ApiResponse);
    }
  });

  return router;
}
