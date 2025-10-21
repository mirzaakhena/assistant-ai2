import axios from 'axios';
import { createLogger } from '@aspri/logger';

const logger = createLogger('mcp-cronjob-tools');

const CRONJOB_API_URL = `http://localhost:${process.env.CRONJOB_PORT || 3002}/api`;

export const cronjobTools = [
  {
    name: 'cronjob_create',
    description: 'Create a new job (recurring, one-time at specific datetime, OR one-time-relative for delay from now). For scheduled tasks, use payload with "prompt" field containing natural language instruction that will be executed by AI when job triggers.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the job',
        },
        type: {
          type: 'string',
          description: 'Job type: "recurring" (repeating schedule), "one-time" (execute at absolute datetime), or "one-time-relative" (execute after delay from now)',
          enum: ['recurring', 'one-time', 'one-time-relative'],
        },
        schedule: {
          type: 'string',
          description: 'Cron expression (required for recurring jobs). Examples: "0 9 * * *" = daily 9 AM, "*/5 * * * *" = every 5 min',
        },
        scheduledTime: {
          type: 'string',
          description: 'Datetime in yyyyMMddHHmmss format (required for one-time jobs). MUST be in the future. Format: year(4)month(2)day(2)hour(2)minute(2)second(2). Example: "20251221120000" = December 21, 2025, 12:00:00',
        },
        delayTime: {
          type: 'string',
          description: 'Duration delay from now (required for one-time-relative jobs). Format: [Xh][Ym][Zs] where X=hours, Y=minutes, Z=seconds. Examples: "2h" = 2 hours, "30m" = 30 minutes, "45s" = 45 seconds, "2h30m" = 2 hours 30 minutes, "1h15m30s" = 1 hour 15 minutes 30 seconds',
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the job is enabled (default: true)',
          default: true,
        },
        payload: {
          type: 'object',
          description: 'Payload data to pass when job triggers. IMPORTANT: For scheduled tasks, you MUST use format: {"prompt": "natural language instruction"}. The prompt will be processed by the AI when the job triggers. Example: {"prompt": "Kirim pesan \'Hello\' ke nomor WhatsApp 628xxx"}',
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'cronjob_list',
    description: 'Get list of all cron jobs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cronjob_get',
    description: 'Get details of a specific cron job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the cron job',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'cronjob_update',
    description: 'Update an existing cron job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the cron job',
        },
        name: {
          type: 'string',
          description: 'Updated name',
        },
        schedule: {
          type: 'string',
          description: 'Updated cron expression',
        },
        enabled: {
          type: 'boolean',
          description: 'Updated enabled status',
        },
        payload: {
          type: 'object',
          description: 'Updated payload data',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'cronjob_delete',
    description: 'Delete a cron job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the cron job to delete',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'cronjob_start',
    description: 'Start/enable a cron job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the cron job to start',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'cronjob_stop',
    description: 'Stop/disable a cron job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the cron job to stop',
        },
      },
      required: ['jobId'],
    },
  },
];

export async function handleCronjobTool(name: string, args: any, context?: { userId?: string }) {
  switch (name) {
    case 'cronjob_create': {
      const { name: jobName, type, schedule, scheduledTime, delayTime, enabled = true, payload } = args;
      logger.info({
        jobName,
        type,
        schedule,
        scheduledTime,
        delayTime,
        enabled,
        payload
      }, 'Executing cronjob_create tool');

      // Build request body based on type
      const requestBody: any = {
        name: jobName,
        type,
        enabled,
        payload,
      };

      // Add type-specific fields
      if (type === 'recurring') {
        requestBody.schedule = schedule;
      } else if (type === 'one-time') {
        requestBody.scheduledTime = scheduledTime;
      } else if (type === 'one-time-relative') {
        requestBody.delayTime = delayTime;
      }

      const response = await axios.post(`${CRONJOB_API_URL}/jobs`, requestBody);

      return {
        content: [
          {
            type: 'text',
            text: `Job created successfully (${type}):\n${JSON.stringify(response.data.data, null, 2)}`,
          },
        ],
      };
    }

    case 'cronjob_list': {
      logger.info({}, 'Executing cronjob_list tool');
      const response = await axios.get(`${CRONJOB_API_URL}/jobs`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.data, null, 2),
          },
        ],
      };
    }

    case 'cronjob_get': {
      const { jobId } = args;
      logger.info({ jobId }, 'Executing cronjob_get tool');
      const response = await axios.get(`${CRONJOB_API_URL}/jobs/${jobId}`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.data, null, 2),
          },
        ],
      };
    }

    case 'cronjob_update': {
      const { jobId, ...updates } = args;
      logger.info({ jobId, updates }, 'Executing cronjob_update tool');
      const response = await axios.patch(`${CRONJOB_API_URL}/jobs/${jobId}`, updates);

      return {
        content: [
          {
            type: 'text',
            text: `Cron job updated successfully:\n${JSON.stringify(response.data.data, null, 2)}`,
          },
        ],
      };
    }

    case 'cronjob_delete': {
      const { jobId } = args;
      logger.info({ jobId }, 'Executing cronjob_delete tool');
      await axios.delete(`${CRONJOB_API_URL}/jobs/${jobId}`);

      return {
        content: [
          {
            type: 'text',
            text: `Cron job ${jobId} deleted successfully`,
          },
        ],
      };
    }

    case 'cronjob_start': {
      const { jobId } = args;
      logger.info({ jobId }, 'Executing cronjob_start tool');
      await axios.post(`${CRONJOB_API_URL}/jobs/${jobId}/start`);

      return {
        content: [
          {
            type: 'text',
            text: `Cron job ${jobId} started successfully`,
          },
        ],
      };
    }

    case 'cronjob_stop': {
      const { jobId } = args;
      logger.info({ jobId }, 'Executing cronjob_stop tool');
      await axios.post(`${CRONJOB_API_URL}/jobs/${jobId}/stop`);

      return {
        content: [
          {
            type: 'text',
            text: `Cron job ${jobId} stopped successfully`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown Cronjob tool: ${name}`);
  }
}
