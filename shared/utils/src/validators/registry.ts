import { createLogger } from '@aspri/logger';
import { IToolValidator, ValidationContext, ValidationResult } from './base.js';

const logger = createLogger('validator-registry');

/**
 * Central registry for all tool validators
 */
export class ValidatorRegistry {
  private validators: Map<string, IToolValidator> = new Map();

  /**
   * Register a validator for a tool
   */
  register(validator: IToolValidator): void {
    if (this.validators.has(validator.toolName)) {
      logger.warn({ toolName: validator.toolName }, 'Validator already registered, overwriting');
    }

    this.validators.set(validator.toolName, validator);
    logger.info({
      toolName: validator.toolName,
      resourceType: validator.resourceType
    }, 'Validator registered');
  }

  /**
   * Get validator for a specific tool
   */
  getValidator(toolName: string): IToolValidator | undefined {
    return this.validators.get(toolName);
  }

  /**
   * Check if a tool has a validator
   */
  hasValidator(toolName: string): boolean {
    return this.validators.has(toolName);
  }

  /**
   * Validate a resource for a specific tool
   */
  async validate(
    toolName: string,
    resource: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const validator = this.validators.get(toolName);

    if (!validator) {
      logger.debug({ toolName }, 'No validator found for tool, allowing by default');
      // If no validator, allow by default (opt-in security)
      return { valid: true };
    }

    return await validator.validate(resource, context);
  }

  /**
   * Get all registered validators
   */
  getAllValidators(): IToolValidator[] {
    return Array.from(this.validators.values());
  }

  /**
   * Get whitelist for a tool and user
   */
  async getWhitelist(toolName: string, userId: string): Promise<string[]> {
    const validator = this.validators.get(toolName);
    if (!validator) {
      return [];
    }
    return await validator.getWhitelist(userId);
  }

  /**
   * Get statistics about registered validators
   */
  getStats(): { totalValidators: number; validators: Array<{ toolName: string; resourceType: string }> } {
    const validators = Array.from(this.validators.values()).map(v => ({
      toolName: v.toolName,
      resourceType: v.resourceType
    }));

    return {
      totalValidators: validators.length,
      validators
    };
  }
}

// Singleton instance
export const validatorRegistry = new ValidatorRegistry();
