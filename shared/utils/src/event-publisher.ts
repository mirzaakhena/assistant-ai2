import { RedisClientType } from 'redis';
import { createLogger } from '@aspri/logger';
import { AppEvent } from '@aspri/types';
import { getRedisClient } from './redis-client.js';

const logger = createLogger('event-publisher');

export class EventPublisher {
  private redis: RedisClientType | null = null;

  async initialize(): Promise<void> {
    this.redis = await getRedisClient();
    logger.info('EventPublisher initialized');
  }

  async publish(streamName: string, event: AppEvent): Promise<string> {
    if (!this.redis) {
      throw new Error('EventPublisher not initialized');
    }

    try {
      // Flatten event object for Redis Streams
      const eventData: Record<string, string> = {
        eventId: event.eventId,
        type: event.type,
        source: event.source,
        timestamp: event.timestamp.toString(),
        data: JSON.stringify(event.data),
      };

      // Publish to Redis Stream using XADD
      const messageId = await this.redis.xAdd(streamName, '*', eventData);

      logger.info(
        { streamName, eventId: event.eventId, eventType: event.type, messageId },
        'Event published to Redis Stream'
      );

      return messageId;
    } catch (error) {
      logger.error({ error, streamName, event }, 'Failed to publish event');
      throw error;
    }
  }
}
