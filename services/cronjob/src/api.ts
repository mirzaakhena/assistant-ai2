import { Router } from 'express';
import { CronScheduler } from './cron-scheduler.js';
import { createLogger } from '@aspri/logger';
import { ApiResponse, JobType, CronjobDefinition } from '@aspri/types';
import { parseDateTime, formatDateTime, isDateTimeFormat } from './datetime-utils.js';
import { parseDuration, isDurationFormat, getFutureTimestamp } from './duration-utils.js';

const logger = createLogger('cronjob-api');

/**
 * Convert job definition from internal format to API response format
 * Converts scheduledTime from milliseconds timestamp to yyyyMMddHHmmss string
 */
function toApiFormat(job: CronjobDefinition): any {
  const apiJob: any = { ...job };

  // Convert scheduledTime to yyyyMMddHHmmss format for one-time jobs
  if (job.type === 'one-time' && job.scheduledTime) {
    apiJob.scheduledTime = formatDateTime(job.scheduledTime);
  }

  // Convert executedAt to yyyyMMddHHmmss format if exists
  if (job.executedAt) {
    apiJob.executedAt = formatDateTime(job.executedAt);
  }

  return apiJob;
}

/**
 * Convert scheduledTime from API request format to internal format
 * Converts from yyyyMMddHHmmss string to milliseconds timestamp
 */
function parseScheduledTime(scheduledTime: any): number {
  if (typeof scheduledTime === 'number') {
    // Already in milliseconds format (backward compatibility)
    return scheduledTime;
  }

  if (isDateTimeFormat(scheduledTime)) {
    // Parse yyyyMMddHHmmss format
    return parseDateTime(scheduledTime);
  }

  throw new Error(
    `Invalid scheduledTime format. Expected "yyyyMMddHHmmss" format (e.g., "20251021053321"), ` +
    `received: "${scheduledTime}"`
  );
}

export function createApiRouter(cronScheduler: CronScheduler): Router {
  const router = Router();

  // Create new job (recurring, one-time, or one-time-relative)
  router.post('/jobs', (req, res) => {
    try {
      const { name, type, schedule, scheduledTime, delayTime, enabled = true, payload } = req.body;

      logger.info({
        name,
        type,
        schedule: schedule || null,
        scheduledTime: scheduledTime || null,
        delayTime: delayTime || null,
        enabled,
        hasPayload: !!payload
      }, 'Received create job request');

      // Validate required fields
      if (!name) {
        logger.warn({ requestBody: req.body }, 'Validation failed: name is required');
        return res.status(400).json({
          success: false,
          error: { message: 'name is required' },
        } as ApiResponse);
      }

      if (!type || (type !== 'recurring' && type !== 'one-time' && type !== 'one-time-relative')) {
        logger.warn({ requestBody: req.body, type }, 'Validation failed: invalid type');
        return res.status(400).json({
          success: false,
          error: { message: 'type must be either "recurring", "one-time", or "one-time-relative"' },
        } as ApiResponse);
      }

      // Validate type-specific fields
      if (type === 'recurring' && !schedule) {
        logger.warn({ requestBody: req.body }, 'Validation failed: schedule required for recurring job');
        return res.status(400).json({
          success: false,
          error: { message: 'schedule (cron expression) is required for recurring jobs' },
        } as ApiResponse);
      }

      if (type === 'one-time' && !scheduledTime) {
        logger.warn({ requestBody: req.body }, 'Validation failed: scheduledTime required for one-time job');
        return res.status(400).json({
          success: false,
          error: { message: 'scheduledTime (yyyyMMddHHmmss format) is required for one-time jobs' },
        } as ApiResponse);
      }

      if (type === 'one-time-relative' && !delayTime) {
        logger.warn({ requestBody: req.body }, 'Validation failed: delayTime required for one-time-relative job');
        return res.status(400).json({
          success: false,
          error: { message: 'delayTime (duration format like "2h3m4s") is required for one-time-relative jobs' },
        } as ApiResponse);
      }

      // Determine scheduledTime based on type
      let parsedScheduledTime = scheduledTime;
      let actualJobType: JobType = type as JobType;

      if (type === 'one-time' && scheduledTime) {
        // Parse absolute time format
        try {
          parsedScheduledTime = parseScheduledTime(scheduledTime);
        } catch (error: any) {
          logger.warn({ scheduledTime, error: error.message }, 'Invalid scheduledTime format');
          return res.status(400).json({
            success: false,
            error: { message: error.message },
          } as ApiResponse);
        }
      } else if (type === 'one-time-relative' && delayTime) {
        // Parse relative time format and calculate future timestamp
        try {
          parsedScheduledTime = getFutureTimestamp(delayTime);
          actualJobType = 'one-time'; // Store as one-time internally
          logger.info({ delayTime, calculatedTimestamp: parsedScheduledTime }, 'Converted relative time to absolute timestamp');
        } catch (error: any) {
          logger.warn({ delayTime, error: error.message }, 'Invalid delayTime format');
          return res.status(400).json({
            success: false,
            error: { message: error.message },
          } as ApiResponse);
        }
      }

      const job = cronScheduler.createJob({
        name,
        type: actualJobType,
        schedule,
        scheduledTime: parsedScheduledTime,
        enabled,
        payload,
      });

      logger.info({ jobId: job.id, name: job.name, type: job.type }, 'Job created successfully');

      res.status(201).json({
        success: true,
        data: toApiFormat(job),
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        requestBody: req.body,
      };
      logger.error(errorDetails, 'Error creating job');
      res.status(500).json({
        success: false,
        error: {
          message: error?.message || 'Failed to create job',
          code: error?.name || 'UNKNOWN_ERROR'
        },
      } as ApiResponse);
    }
  });

  // Get all jobs
  router.get('/jobs', (req, res) => {
    try {
      const jobs = cronScheduler.getAllJobs();

      res.json({
        success: true,
        data: jobs.map(job => toApiFormat(job)),
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
      };
      logger.error(errorDetails, 'Error getting jobs');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to get jobs' },
      } as ApiResponse);
    }
  });

  // Get job statistics
  router.get('/jobs/stats', (req, res) => {
    try {
      const stats = cronScheduler.getJobStats();

      res.json({
        success: true,
        data: stats,
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
      };
      logger.error(errorDetails, 'Error getting job stats');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to get job stats' },
      } as ApiResponse);
    }
  });

  // Get job by ID
  router.get('/jobs/:jobId', (req, res) => {
    try {
      const { jobId } = req.params;
      const job = cronScheduler.getJob(jobId);

      if (!job) {
        logger.warn({ jobId }, 'Job not found');
        return res.status(404).json({
          success: false,
          error: { message: 'Job not found' },
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: toApiFormat(job),
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        jobId: req.params.jobId,
      };
      logger.error(errorDetails, 'Error getting job');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to get job' },
      } as ApiResponse);
    }
  });

  // Update job
  router.patch('/jobs/:jobId', (req, res) => {
    try {
      const { jobId } = req.params;
      const updates = req.body;

      logger.debug({ jobId, updates }, 'Update job request received');

      // Don't allow updating 'type' field
      if (updates.type) {
        logger.warn({ jobId, updates }, 'Validation failed: cannot change job type');
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot change job type after creation' },
        } as ApiResponse);
      }

      // Parse scheduledTime if it's being updated
      const parsedUpdates = { ...updates };
      if (updates.scheduledTime) {
        try {
          parsedUpdates.scheduledTime = parseScheduledTime(updates.scheduledTime);
        } catch (error: any) {
          logger.warn({ scheduledTime: updates.scheduledTime, error: error.message }, 'Invalid scheduledTime format');
          return res.status(400).json({
            success: false,
            error: { message: error.message },
          } as ApiResponse);
        }
      }

      const job = cronScheduler.updateJob(jobId, parsedUpdates);

      logger.info({ jobId, updates }, 'Job updated successfully');

      res.json({
        success: true,
        data: toApiFormat(job),
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        jobId: req.params.jobId,
        updates: req.body,
      };
      logger.error(errorDetails, 'Error updating job');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to update job' },
      } as ApiResponse);
    }
  });

  // Delete job
  router.delete('/jobs/:jobId', (req, res) => {
    try {
      const { jobId } = req.params;
      logger.debug({ jobId }, 'Delete job request received');

      const deleted = cronScheduler.deleteJob(jobId);

      if (!deleted) {
        logger.warn({ jobId }, 'Job not found');
        return res.status(404).json({
          success: false,
          error: { message: 'Job not found' },
        } as ApiResponse);
      }

      logger.info({ jobId }, 'Job deleted successfully');

      res.json({
        success: true,
        data: { deleted: true },
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        jobId: req.params.jobId,
      };
      logger.error(errorDetails, 'Error deleting job');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to delete job' },
      } as ApiResponse);
    }
  });

  // Start job
  router.post('/jobs/:jobId/start', (req, res) => {
    try {
      const { jobId } = req.params;
      logger.debug({ jobId }, 'Start job request received');

      cronScheduler.startJob(jobId);

      logger.info({ jobId }, 'Job started successfully');

      res.json({
        success: true,
        data: { started: true },
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        jobId: req.params.jobId,
      };
      logger.error(errorDetails, 'Error starting job');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to start job' },
      } as ApiResponse);
    }
  });

  // Stop job
  router.post('/jobs/:jobId/stop', (req, res) => {
    try {
      const { jobId } = req.params;
      logger.debug({ jobId }, 'Stop job request received');

      cronScheduler.stopJob(jobId);

      logger.info({ jobId }, 'Job stopped successfully');

      res.json({
        success: true,
        data: { stopped: true },
      } as ApiResponse);
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        stack: error?.stack,
        jobId: req.params.jobId,
      };
      logger.error(errorDetails, 'Error stopping job');
      res.status(500).json({
        success: false,
        error: { message: error?.message || 'Failed to stop job' },
      } as ApiResponse);
    }
  });

  return router;
}
