#!/usr/bin/env node

import 'dotenv/config';
import { createLogger } from '@aspri/logger';
import { EventConsumer } from '@aspri/utils';
import { WhatsAppMessageEvent, CronjobEvent } from '@aspri/types';
import { AgentOrchestrator } from './agent.js';

const logger = createLogger('ai-engine');

async function main() {
  try {
    logger.info('Starting AI Engine...');

    // Initialize Agent Orchestrator
    const agent = new AgentOrchestrator();
    await agent.initialize();

    logger.info('Starting event consumption...');

    // Consume WhatsApp events
    const whatsappConsumer = new EventConsumer();
    await whatsappConsumer.initialize();
    whatsappConsumer.on('whatsapp:message', async (event) => {
      const whatsappEvent = event as WhatsAppMessageEvent;
      try {
        await agent.handleWhatsAppMessage(whatsappEvent.data);
      } catch (error) {
        logger.error({ error }, 'Error handling WhatsApp message');
      }
    });

    // Consume Cronjob events
    const cronjobConsumer = new EventConsumer();
    await cronjobConsumer.initialize();
    cronjobConsumer.on('cronjob:trigger', async (event) => {
      const cronjobEvent = event as CronjobEvent;
      try {
        await agent.handleCronjobTrigger(cronjobEvent.data);
      } catch (error) {
        logger.error({ error }, 'Error handling cronjob trigger');
      }
    });

    // Start consuming in parallel
    Promise.all([
      whatsappConsumer.start({
        streamName: process.env.WHATSAPP_STREAM_NAME || 'whatsapp:messages',
        groupName: 'ai-engine',
        consumerName: 'ai-worker-1',
      }),
      cronjobConsumer.start({
        streamName: process.env.CRONJOB_STREAM_NAME || 'cronjob:events',
        groupName: 'ai-engine',
        consumerName: 'ai-worker-1',
      }),
    ]).catch((error) => {
      logger.error({ error }, 'Error in event consumption');
    });

    logger.info('AI Engine running and consuming events');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Received shutdown signal, cleaning up...');

      try {
        // Stop event consumers
        whatsappConsumer.stop();
        cronjobConsumer.stop();
        logger.info('Event consumers stopped');

        // Shutdown agent with timeout
        const shutdownPromise = agent.shutdown();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Agent shutdown timeout')), 5000)
        );

        await Promise.race([shutdownPromise, timeoutPromise]);
        logger.info('AI Engine cleaned up successfully');

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
    logger.error({ error }, 'Failed to start AI Engine');
    process.exit(1);
  }
}

main();
