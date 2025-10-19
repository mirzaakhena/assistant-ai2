import WhatsAppWebJS from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createLogger } from '@aspri/logger';
import { EventPublisher } from '@aspri/utils';
import { WhatsAppMessage, WhatsAppChat, WhatsAppContact, WhatsAppMessageEvent } from '@aspri/types';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const { Client, LocalAuth } = WhatsAppWebJS;

const logger = createLogger('whatsapp-client');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhatsAppClient {
  private client: any;
  private ready: boolean = false;
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;

    const authDataPath = path.resolve(__dirname, '../.wwebjs_auth');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: authDataPath,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    logger.info({ authDataPath }, 'WhatsApp auth data path');
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr: any) => {
      logger.info('QR Code received, scan with your WhatsApp:');
      qrcode.generate(qr, { small: true }, (qrCode) => {
        console.error(qrCode);
      });
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready!');
      this.ready = true;
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
    });

    this.client.on('auth_failure', (msg: any) => {
      logger.error({ msg }, 'WhatsApp authentication failed');
    });

    this.client.on('disconnected', (reason: any) => {
      logger.warn({ reason }, 'WhatsApp client disconnected');
      this.ready = false;
    });

    // Message handler - Publish to Redis Stream
    this.client.on('message', async (message: any) => {
      if (message.fromMe) {
        return;
      }

      logger.debug({ from: message.from, body: message.body }, 'Received incoming message');

      const whatsappMessage: WhatsAppMessage = {
        id: message.id.id,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
      };

      // Publish event to Redis Stream
      try {
        const event: WhatsAppMessageEvent = {
          eventId: randomUUID(),
          type: 'whatsapp:message',
          source: 'whatsapp',
          timestamp: Date.now(),
          data: whatsappMessage,
        };

        const streamName = process.env.WHATSAPP_STREAM_NAME || 'whatsapp:messages';
        await this.eventPublisher.publish(streamName, event);

        logger.info({ from: message.from, eventId: event.eventId }, 'Message event published');
      } catch (error) {
        logger.error({ error, from: message.from }, 'Failed to publish message event');
      }
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing WhatsApp client...');
    await this.client.initialize();

    // Wait for client to be ready
    const timeout = 90000;
    const startTime = Date.now();

    while (!this.ready) {
      if (Date.now() - startTime > timeout) {
        throw new Error('WhatsApp client initialization timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info('WhatsApp client initialized');
  }

  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phoneNumber.includes('@c.us')
      ? phoneNumber
      : `${phoneNumber.replace(/\D/g, '')}@c.us`;

    await this.client.sendMessage(chatId, message);
    logger.debug({ chatId, messageLength: message.length }, 'Message sent');
  }

  async getMessages(phoneNumber: string, limit: number = 10): Promise<WhatsAppMessage[]> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phoneNumber.includes('@c.us')
      ? phoneNumber
      : `${phoneNumber.replace(/\D/g, '')}@c.us`;

    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });

    return messages.map((msg: any) => ({
      id: msg.id.id,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
    }));
  }

  async getChats(limit: number = 20): Promise<WhatsAppChat[]> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.client.getChats();
    const limitedChats = chats.slice(0, limit);

    return Promise.all(
      limitedChats.map(async (chat: any) => {
        const lastMessage = await chat.fetchMessages({ limit: 1 });
        return {
          id: chat.id._serialized,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessage: lastMessage.length > 0
            ? {
                body: lastMessage[0].body,
                timestamp: lastMessage[0].timestamp,
              }
            : undefined,
        };
      })
    );
  }

  async searchContacts(query: string): Promise<WhatsAppContact[]> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    const contacts = await this.client.getContacts();
    const filteredContacts = contacts.filter(
      (contact: any) =>
        contact.name?.toLowerCase().includes(query.toLowerCase()) ||
        contact.number?.includes(query)
    );

    return filteredContacts.map((contact: any) => ({
      id: contact.id._serialized,
      name: contact.name || contact.pushname || 'Unknown',
      number: contact.number,
      isMyContact: contact.isMyContact,
    }));
  }

  isReady(): boolean {
    return this.ready;
  }

  async destroy(): Promise<void> {
    try {
      logger.info('Destroying WhatsApp client...');
      await this.client.destroy();
      this.ready = false;
      logger.info('WhatsApp client destroyed');
    } catch (error) {
      logger.error({ error }, 'Error destroying client');
    }
  }
}
