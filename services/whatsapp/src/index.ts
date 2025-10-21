#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import { createLogger } from '@aspri/logger';
import { WhatsAppClient } from './whatsapp-client.js';
import { EventPublisher } from '@aspri/utils';
import { createApiRouter } from './api.js';

const logger = createLogger('whatsapp-service');
const PORT = parseInt(process.env.WHATSAPP_PORT || '3001');

async function main() {
  try {
    logger.info('Starting WhatsApp Service...');

    // Initialize Event Publisher
    const eventPublisher = new EventPublisher();
    await eventPublisher.initialize();

    // Initialize WhatsApp Client
    const whatsappClient = new WhatsAppClient(eventPublisher);
    await whatsappClient.initialize();

    // Setup Express API Server
    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        service: 'whatsapp',
        status: whatsappClient.isReady() ? 'ready' : 'initializing',
        timestamp: new Date().toISOString(),
      });
    });

    // API Routes
    app.use('/api', createApiRouter(whatsappClient));

    // Start server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, 'WhatsApp Service API running');
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Received shutdown signal, cleaning up...');

      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      try {
        // Cleanup WhatsApp client with timeout
        const cleanupPromise = whatsappClient.destroy();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
        );

        await Promise.race([cleanupPromise, timeoutPromise]);
        logger.info('WhatsApp client cleaned up successfully');

        // Exit cleanly
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during cleanup, forcing exit');
        // Force exit even if cleanup failed
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error({
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    }, 'Failed to start WhatsApp Service');
    console.error('Full error details:', error);
    process.exit(1);
  }
}

main();
