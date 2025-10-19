import axios from 'axios';
import { createLogger } from '@aspri/logger';

const logger = createLogger('mcp-cronjob-tools');

const CRONJOB_API_URL = `http://localhost:${process.env.CRONJOB_PORT || 3002}/api`;

export const cronjobTools = [
  {
    name: 'cronjob_create',
    description: 'Create a new job (recurring with cron schedule OR one-time at specific time). For scheduled tasks, use payload with "prompt" field containing natural language instruction that will be executed by AI when job triggers.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the job',
        },
        type: {
          type: 'string',
          description: 'Job type: "recurring" (repeating schedule) or "one-time" (single execution)',
          enum: ['recurring', 'one-time'],
        },
        schedule: {
          type: 'string',
          description: 'Cron expression (required for recurring jobs). Examples: "0 9 * * *" = daily 9 AM, "*/5 * * * *" = every 5 min',
        },
        scheduledTime: {
          type: 'number',
          description: 'Unix timestamp in milliseconds (required for one-time jobs). MUST be in the future. Calculate as: current_timestamp_ms + offset_ms. Example: For 2 minutes from now, use current_time + (2 * 60 * 1000)',
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

export async function handleCronjobTool(name: string, args: any) {
  switch (name) {
    case 'cronjob_create': {
      const { name: jobName, type, schedule, scheduledTime, enabled = true, payload } = args;
      const response = await axios.post(`${CRONJOB_API_URL}/jobs`, {
        name: jobName,
        type,
        schedule,
        scheduledTime,
        enabled,
        payload,
      });

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
