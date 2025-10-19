import { Router } from 'express';
import { CronScheduler } from './cron-scheduler.js';
import { createLogger } from '@aspri/logger';
import { ApiResponse, JobType } from '@aspri/types';

const logger = createLogger('cronjob-api');

export function createApiRouter(cronScheduler: CronScheduler): Router {
  const router = Router();

  // Create new job (recurring or one-time)
  router.post('/jobs', (req, res) => {
    try {
      const { name, type, schedule, scheduledTime, enabled = true, payload } = req.body;

      logger.info({
        name,
        type,
        schedule: schedule || null,
        scheduledTime: scheduledTime || null,
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

      if (!type || (type !== 'recurring' && type !== 'one-time')) {
        logger.warn({ requestBody: req.body, type }, 'Validation failed: invalid type');
        return res.status(400).json({
          success: false,
          error: { message: 'type must be either "recurring" or "one-time"' },
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
          error: { message: 'scheduledTime (Unix timestamp) is required for one-time jobs' },
        } as ApiResponse);
      }

      const job = cronScheduler.createJob({
        name,
        type: type as JobType,
        schedule,
        scheduledTime,
        enabled,
        payload,
      });

      logger.info({ jobId: job.id, name: job.name, type: job.type }, 'Job created successfully');

      res.status(201).json({
        success: true,
        data: job,
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
        data: jobs,
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
        data: job,
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

      const job = cronScheduler.updateJob(jobId, updates);

      logger.info({ jobId, updates }, 'Job updated successfully');

      res.json({
        success: true,
        data: job,
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
