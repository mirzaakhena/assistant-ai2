import { createLogger } from '@aspri/logger';

const logger = createLogger('validator-base');

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Validation context - passed to all validators
 */
export interface ValidationContext {
  userId: string;           // Who is performing the action
  dryRun?: boolean;         // Is this a simulation?
  additionalContext?: any;  // Tool-specific context
}

/**
 * Base interface that ALL tool validators MUST implement
 */
export interface IToolValidator {
  /**
   * Tool name this validator is for
   */
  readonly toolName: string;

  /**
   * Resource type this validator checks (e.g., 'phone_number', 'email', 'ip_address')
   */
  readonly resourceType: string;

  /**
   * Get whitelist for a specific user
   * Each tool maintains its own whitelist
   */
  getWhitelist(userId: string): Promise<string[]>;

  /**
   * Check if a resource is in user's whitelist
   */
  isAllowed(resource: string, userId: string): Promise<boolean>;

  /**
   * Validate a resource with full context
   * This is the main validation method
   */
  validate(resource: string, context: ValidationContext): Promise<ValidationResult>;

  /**
   * Optional: Normalize resource format (e.g., format phone number)
   */
  normalize?(resource: string): string;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseToolValidator implements IToolValidator {
  abstract readonly toolName: string;
  abstract readonly resourceType: string;

  protected logger = createLogger(`validator:${this.constructor.name}`);

  abstract getWhitelist(userId: string): Promise<string[]>;

  async isAllowed(resource: string, userId: string): Promise<boolean> {
    const whitelist = await this.getWhitelist(userId);
    const normalizedResource = this.normalize ? this.normalize(resource) : resource;
    return whitelist.includes(normalizedResource);
  }

  async validate(
    resource: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // Normalize resource if method exists
      const normalizedResource = this.normalize ? this.normalize(resource) : resource;

      this.logger.debug({
        resource: normalizedResource,
        userId: context.userId,
        dryRun: context.dryRun,
        toolName: this.toolName
      }, 'Validating resource');

      // Check whitelist
      const allowed = await this.isAllowed(normalizedResource, context.userId);

      if (!allowed) {
        const error = `${this.resourceType} "${normalizedResource}" is not in whitelist for user ${context.userId}`;
        this.logger.warn({
          resource: normalizedResource,
          userId: context.userId,
          toolName: this.toolName
        }, 'Validation failed: not in whitelist');

        return {
          valid: false,
          error,
          details: {
            resource: normalizedResource,
            userId: context.userId,
            resourceType: this.resourceType
          }
        };
      }

      // Success
      if (context.dryRun) {
        this.logger.info({
          resource: normalizedResource,
          userId: context.userId,
          toolName: this.toolName
        }, 'Dry-run validation passed');
      }

      return { valid: true };

    } catch (error: any) {
      this.logger.error({ error, resource, context }, 'Validation error');
      return {
        valid: false,
        error: error.message || 'Validation failed',
        details: { originalError: error }
      };
    }
  }

  normalize?(resource: string): string;
}
