import { createLogger } from '@aspri/logger';

const logger = createLogger('validators');

// Export types and interfaces
export * from './base.js';
export * from './registry.js';
export * from './implementations/whatsapp-validator.js';

// Import implementations
import { validatorRegistry } from './registry.js';
import { WhatsAppValidator } from './implementations/whatsapp-validator.js';

/**
 * Initialize and register all validators
 * Call this once at application startup
 */
export function initializeValidators(): void {
  logger.info('Initializing validators...');

  // Register WhatsApp validator
  validatorRegistry.register(new WhatsAppValidator());

  // Future: Register other validators
  // validatorRegistry.register(new EmailValidator());
  // validatorRegistry.register(new NetworkValidator());

  const stats = validatorRegistry.getStats();
  logger.info({ stats }, 'Validators initialized successfully');
}

// Export singleton registry
export { validatorRegistry };
