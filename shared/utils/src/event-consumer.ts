import { RedisClientType } from 'redis';
import { createLogger } from '@aspri/logger';
import { AppEvent } from '@aspri/types';
import { getRedisClient } from './redis-client.js';

const logger = createLogger('event-consumer');

export type EventHandler = (event: AppEvent) => Promise<void>;

export interface ConsumerConfig {
  streamName: string;
  groupName: string;
  consumerName: string;
  blockMs?: number;
  count?: number;
}

export class EventConsumer {
  private redis: RedisClientType | null = null;
  private running: boolean = false;
  private handlers: Map<string, EventHandler> = new Map();

  async initialize(): Promise<void> {
    this.redis = await getRedisClient();
    logger.info('EventConsumer initialized');
  }

  /**
   * Register event handler for specific event type
   */
  on(eventType: string, handler: EventHandler): void {
    this.handlers.set(eventType, handler);
    logger.debug({ eventType }, 'Event handler registered');
  }

  /**
   * Start consuming events from Redis Stream
   */
  async start(config: ConsumerConfig): Promise<void> {
    if (!this.redis) {
      throw new Error('EventConsumer not initialized');
    }

    const { streamName, groupName, consumerName, blockMs = 5000, count = 10 } = config;

    // Create consumer group if it doesn't exist
    try {
      await this.redis.xGroupCreate(streamName, groupName, '0', {
        MKSTREAM: true,
      });
      logger.info({ streamName, groupName }, 'Consumer group created');
    } catch (error: any) {
      if (error.message.includes('BUSYGROUP')) {
        logger.debug({ streamName, groupName }, 'Consumer group already exists');
      } else {
        throw error;
      }
    }

    this.running = true;
    logger.info({ streamName, groupName, consumerName }, 'Starting event consumer');

    // Main consumption loop
    while (this.running) {
      try {
        // Read new messages from the stream
        const messages = await this.redis.xReadGroup(
          groupName,
          consumerName,
          [{ key: streamName, id: '>' }],
          {
            COUNT: count,
            BLOCK: blockMs,
          }
        );

        if (!messages || messages.length === 0) {
          continue;
        }

        // Process messages
        for (const stream of messages) {
          for (const message of stream.messages) {
            await this.processMessage(streamName, groupName, message);
          }
        }
      } catch (error) {
        logger.error({ error, streamName }, 'Error consuming events');
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('Event consumer stopped');
  }

  /**
   * Process a single message
   */
  private async processMessage(
    streamName: string,
    groupName: string,
    message: any
  ): Promise<void> {
    const { id: messageId, message: messageData } = message;

    try {
      // Parse event from Redis Stream message
      const event: AppEvent = {
        eventId: messageData.eventId,
        type: messageData.type as any,
        source: messageData.source,
        timestamp: parseInt(messageData.timestamp),
        data: JSON.parse(messageData.data),
      };

      logger.debug({ eventId: event.eventId, type: event.type }, 'Processing event');

      // Find and execute handler
      const handler = this.handlers.get(event.type);
      if (handler) {
        await handler(event);
        logger.debug({ eventId: event.eventId }, 'Event processed successfully');
      } else {
        logger.warn({ type: event.type }, 'No handler registered for event type');
      }

      // Acknowledge message (remove from pending list)
      await this.redis!.xAck(streamName, groupName, messageId);
    } catch (error) {
      logger.error({ error, messageId }, 'Error processing message');
      // Message will remain in pending list and can be retried
    }
  }

  /**
   * Stop consuming events
   */
  stop(): void {
    this.running = false;
    logger.info('Stopping event consumer...');
  }
}
