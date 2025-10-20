import cron from 'node-cron';
import { createLogger } from '@aspri/logger';
import { EventPublisher } from '@aspri/utils';
import { CronjobDefinition, CronjobEvent, JobType } from '@aspri/types';
import { randomUUID } from 'crypto';

const logger = createLogger('cron-scheduler');

interface RecurringJob {
  type: 'recurring';
  definition: CronjobDefinition;
  task: cron.ScheduledTask;
}

interface OneTimeJob {
  type: 'one-time';
  definition: CronjobDefinition;
  timeout: NodeJS.Timeout | null;
}

type JobEntry = RecurringJob | OneTimeJob;

export class CronScheduler {
  private jobs: Map<string, JobEntry> = new Map();
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  /**
   * Create and start a new job (recurring or one-time)
   */
  createJob(jobData: Omit<CronjobDefinition, 'id' | 'createdAt' | 'updatedAt'>): CronjobDefinition {
    const definition: CronjobDefinition = {
      id: randomUUID(),
      ...jobData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate based on job type
    if (definition.type === 'recurring') {
      if (!definition.schedule) {
        throw new Error('Recurring jobs require a schedule (cron expression)');
      }
      if (!cron.validate(definition.schedule)) {
        throw new Error(`Invalid cron expression: ${definition.schedule}`);
      }
      this.createRecurringJob(definition);
    } else if (definition.type === 'one-time') {
      if (!definition.scheduledTime) {
        throw new Error('One-time jobs require a scheduledTime (Unix timestamp)');
      }
      const now = Date.now();
      if (definition.scheduledTime <= now) {
        const scheduledDate = new Date(definition.scheduledTime).toISOString();
        const currentDate = new Date(now).toISOString();
        throw new Error(
          `scheduledTime must be in the future. ` +
          `Received: ${definition.scheduledTime} (${scheduledDate}), ` +
          `Current: ${now} (${currentDate})`
        );
      }
      this.createOneTimeJob(definition);
    } else {
      throw new Error(`Invalid job type: ${definition.type}`);
    }

    logger.info(
      {
        jobId: definition.id,
        name: definition.name,
        type: definition.type,
        schedule: definition.schedule,
        scheduledTime: definition.scheduledTime,
        payload: definition.payload
      },
      'Job created'
    );

    return definition;
  }

  /**
   * Create a recurring job (cron-based)
   */
  private createRecurringJob(definition: CronjobDefinition): void {
    const task = cron.schedule(
      definition.schedule!,
      async () => {
        await this.executeJob(definition.id);
      },
      {
        scheduled: definition.enabled,
      }
    );

    this.jobs.set(definition.id, {
      type: 'recurring',
      definition,
      task,
    });
  }

  /**
   * Create a one-time scheduled job (setTimeout-based)
   */
  private createOneTimeJob(definition: CronjobDefinition): void {
    let timeout: NodeJS.Timeout | null = null;

    if (definition.enabled) {
      const now = Date.now();
      const delay = definition.scheduledTime! - now;

      logger.info({
        jobId: definition.id,
        name: definition.name,
        scheduledTime: definition.scheduledTime,
        scheduledTimeISO: new Date(definition.scheduledTime!).toISOString(),
        currentTime: now,
        currentTimeISO: new Date(now).toISOString(),
        delayMs: delay,
        delaySec: Math.round(delay / 1000),
        willFireAt: new Date(now + delay).toISOString()
      }, 'Creating setTimeout for one-time job');

      timeout = setTimeout(async () => {
        logger.info({ jobId: definition.id, name: definition.name }, 'setTimeout callback triggered - about to execute job');
        await this.executeJob(definition.id);
      }, delay);

      logger.info({ jobId: definition.id, hasTimeout: !!timeout }, 'setTimeout created successfully');
    }

    this.jobs.set(definition.id, {
      type: 'one-time',
      definition,
      timeout,
    });
  }

  /**
   * Execute a job and publish event
   */
  private async executeJob(jobId: string): Promise<void> {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      logger.warn({ jobId }, 'Job not found during execution');
      return;
    }

    const definition = jobEntry.definition;

    logger.info({
      jobId: definition.id,
      name: definition.name,
      type: definition.type,
      payload: definition.payload
    }, 'Firing job');

    try {
      const event: CronjobEvent = {
        eventId: randomUUID(),
        type: 'cronjob:trigger',
        source: 'cronjob',
        timestamp: Date.now(),
        data: {
          jobId: definition.id,
          jobName: definition.name,
          scheduledTime: definition.type === 'one-time' ? definition.scheduledTime! : Date.now(),
          payload: definition.payload,
        },
      };

      const streamName = process.env.CRONJOB_STREAM_NAME || 'cronjob:events';
      await this.eventPublisher.publish(streamName, event);

      logger.info({
        jobId: definition.id,
        eventId: event.eventId,
        streamName
      }, 'Event published to Redis Stream');

      // Mark one-time jobs as executed
      if (definition.type === 'one-time') {
        definition.executed = true;
        definition.executedAt = Date.now();
        definition.enabled = false;
        definition.updatedAt = new Date();

        // Clear timeout reference
        if (jobEntry.type === 'one-time') {
          jobEntry.timeout = null;
        }

        logger.info({ jobId: definition.id }, 'One-time job executed and disabled');
      }
    } catch (error) {
      logger.error({ error, jobId: definition.id }, 'Failed to publish job event');
    }
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): CronjobDefinition | null {
    const job = this.jobs.get(jobId);
    return job ? job.definition : null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): CronjobDefinition[] {
    return Array.from(this.jobs.values()).map((job) => job.definition);
  }

  /**
   * Update a job
   */
  updateJob(jobId: string, updates: Partial<Omit<CronjobDefinition, 'id' | 'createdAt' | 'type'>>): CronjobDefinition {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const definition = jobEntry.definition;

    // Don't allow updating executed one-time jobs
    if (definition.type === 'one-time' && definition.executed) {
      throw new Error('Cannot update already executed one-time job');
    }

    // Stop/clear existing task
    if (jobEntry.type === 'recurring') {
      jobEntry.task.stop();
    } else if (jobEntry.type === 'one-time' && jobEntry.timeout) {
      clearTimeout(jobEntry.timeout);
    }

    // Update definition
    const updatedDefinition: CronjobDefinition = {
      ...definition,
      ...updates,
      updatedAt: new Date(),
    };

    // Validate updates
    if (definition.type === 'recurring') {
      if (updates.schedule && !cron.validate(updates.schedule)) {
        throw new Error(`Invalid cron expression: ${updates.schedule}`);
      }
    } else if (definition.type === 'one-time') {
      if (updates.scheduledTime && updates.scheduledTime <= Date.now()) {
        throw new Error('scheduledTime must be in the future');
      }
    }

    // Delete old job entry
    this.jobs.delete(jobId);

    // Recreate job with updated definition
    if (updatedDefinition.type === 'recurring') {
      this.createRecurringJob(updatedDefinition);
    } else {
      this.createOneTimeJob(updatedDefinition);
    }

    logger.info({ jobId, updates }, 'Job updated');

    return updatedDefinition;
  }

  /**
   * Delete a job
   */
  deleteJob(jobId: string): boolean {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      return false;
    }

    // Stop/clear task
    if (jobEntry.type === 'recurring') {
      jobEntry.task.stop();
    } else if (jobEntry.type === 'one-time' && jobEntry.timeout) {
      clearTimeout(jobEntry.timeout);
    }

    this.jobs.delete(jobId);
    logger.info({ jobId }, 'Job deleted');

    return true;
  }

  /**
   * Start a job
   */
  startJob(jobId: string): void {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const definition = jobEntry.definition;

    // Don't allow starting executed one-time jobs
    if (definition.type === 'one-time' && definition.executed) {
      throw new Error('Cannot start already executed one-time job');
    }

    if (jobEntry.type === 'recurring') {
      jobEntry.task.start();
    } else if (jobEntry.type === 'one-time') {
      // Reschedule one-time job
      if (definition.scheduledTime! <= Date.now()) {
        throw new Error('Cannot start one-time job: scheduled time has passed');
      }

      const delay = definition.scheduledTime! - Date.now();
      const timeout = setTimeout(async () => {
        await this.executeJob(definition.id);
      }, delay);

      jobEntry.timeout = timeout;
    }

    definition.enabled = true;
    definition.updatedAt = new Date();
    logger.info({ jobId }, 'Job started');
  }

  /**
   * Stop a job
   */
  stopJob(jobId: string): void {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (jobEntry.type === 'recurring') {
      jobEntry.task.stop();
    } else if (jobEntry.type === 'one-time' && jobEntry.timeout) {
      clearTimeout(jobEntry.timeout);
      jobEntry.timeout = null;
    }

    jobEntry.definition.enabled = false;
    jobEntry.definition.updatedAt = new Date();
    logger.info({ jobId }, 'Job stopped');
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    for (const [jobId, jobEntry] of this.jobs.entries()) {
      if (jobEntry.type === 'recurring') {
        jobEntry.task.stop();
      } else if (jobEntry.type === 'one-time' && jobEntry.timeout) {
        clearTimeout(jobEntry.timeout);
      }
      logger.info({ jobId }, 'Job stopped');
    }
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return Array.from(this.jobs.values()).filter((job) => job.definition.enabled).length;
  }

  /**
   * Get count of jobs by type
   */
  getJobStats(): { total: number; recurring: number; oneTime: number; active: number; executed: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      recurring: jobs.filter((j) => j.definition.type === 'recurring').length,
      oneTime: jobs.filter((j) => j.definition.type === 'one-time').length,
      active: jobs.filter((j) => j.definition.enabled).length,
      executed: jobs.filter((j) => j.definition.type === 'one-time' && j.definition.executed).length,
    };
  }
}
