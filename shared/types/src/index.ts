/**
 * Shared TypeScript types across all services
 */

// WhatsApp Message Types
export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
  };
}

export interface WhatsAppContact {
  id: string;
  name: string;
  number: string;
  isMyContact: boolean;
}

// Event Types
export interface BaseEvent {
  eventId: string;
  timestamp: number;
  source: string;
}

export interface WhatsAppMessageEvent extends BaseEvent {
  type: 'whatsapp:message';
  source: 'whatsapp';
  data: WhatsAppMessage;
}

export interface CronjobEvent extends BaseEvent {
  type: 'cronjob:trigger';
  source: 'cronjob';
  data: {
    jobId: string;
    jobName: string;
    scheduledTime: number;
    payload?: Record<string, any>;
  };
}

export type AppEvent = WhatsAppMessageEvent | CronjobEvent;

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Cronjob Types
export type JobType = 'recurring' | 'one-time';

export interface CronjobDefinition {
  id: string;
  name: string;
  type: JobType; // 'recurring' or 'one-time'
  schedule?: string; // Cron expression (required for recurring)
  scheduledTime?: number; // Unix timestamp (required for one-time)
  enabled: boolean;
  executed?: boolean; // For one-time jobs: has it been executed?
  executedAt?: number; // For one-time jobs: when was it executed?
  payload?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
