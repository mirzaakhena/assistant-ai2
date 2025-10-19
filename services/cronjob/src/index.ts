#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import { createLogger } from '@aspri/logger';
import { EventPublisher } from '@aspri/utils';
import { CronScheduler } from './cron-scheduler.js';
import { createApiRouter } from './api.js';

const logger = createLogger('cronjob-service');
const PORT = parseInt(process.env.CRONJOB_PORT || '3002');

async function main() {
  try {
    logger.info('Starting Cronjob Service...');

    // Initialize Event Publisher
    const eventPublisher = new EventPublisher();
    await eventPublisher.initialize();

    // Initialize Cron Scheduler
    const cronScheduler = new CronScheduler(eventPublisher);

    // Setup Express API Server
    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        service: 'cronjob',
        status: 'ready',
        timestamp: new Date().toISOString(),
        activeJobs: cronScheduler.getActiveJobCount(),
      });
    });

    // API Routes
    app.use('/api', createApiRouter(cronScheduler));

    // Start server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Cronjob Service API running');
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Received shutdown signal, cleaning up...');

      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Stop all cron jobs
      cronScheduler.stopAll();
      logger.info('All cron jobs stopped');

      // Exit cleanly
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error({ error }, 'Failed to start Cronjob Service');
    process.exit(1);
  }
}

main();
