import { createClient, RedisClientType } from 'redis';
import { createLogger } from '@aspri/logger';

const logger = createLogger('redis-client');

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

  logger.info({ redisUrl }, 'Connecting to Redis...');

  redisClient = createClient({
    url: redisUrl,
    password: process.env.REDIS_PASSWORD,
  });

  redisClient.on('error', (err) => {
    logger.error({ error: err }, 'Redis Client Error');
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  await redisClient.connect();

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis client closed');
  }
}
