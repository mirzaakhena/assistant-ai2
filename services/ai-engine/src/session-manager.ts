import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { createLogger } from '@aspri/logger';

const logger = createLogger('session-manager');

export interface ChatSession {
  chatId: string;
  messages: BaseMessage[];
  lastActivity: Date;
  metadata: {
    userName?: string;
    startTime: Date;
    messageCount: number;
  };
}

export interface SessionConfig {
  historyLimit: number;
  timeoutMinutes: number;
}

export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private config: SessionConfig;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      historyLimit: config?.historyLimit ?? parseInt(process.env.SESSION_HISTORY_LIMIT || '50'),
      timeoutMinutes: config?.timeoutMinutes ?? parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60'),
    };

    logger.info({ config: this.config }, 'SessionManager initialized');
  }

  getOrCreateSession(chatId: string, userName?: string): ChatSession {
    let session = this.sessions.get(chatId);

    if (!session) {
      logger.info({ chatId, userName }, 'Creating new session');
      session = {
        chatId,
        messages: [],
        lastActivity: new Date(),
        metadata: {
          userName,
          startTime: new Date(),
          messageCount: 0,
        },
      };
      this.sessions.set(chatId, session);
    } else {
      session.lastActivity = new Date();

      if (this.isSessionExpired(session)) {
        logger.info({ chatId }, 'Session expired, creating new session');
        session = {
          chatId,
          messages: [],
          lastActivity: new Date(),
          metadata: {
            userName,
            startTime: new Date(),
            messageCount: 0,
          },
        };
        this.sessions.set(chatId, session);
      }
    }

    return session;
  }

  addUserMessage(chatId: string, message: string): void {
    const session = this.getOrCreateSession(chatId);

    session.messages.push(new HumanMessage(message));
    session.metadata.messageCount++;
    session.lastActivity = new Date();

    this.trimSessionHistory(session);

    logger.debug({ chatId, messageCount: session.messages.length }, 'User message added');
  }

  addAIMessage(chatId: string, message: string): void {
    const session = this.sessions.get(chatId);
    if (!session) {
      logger.warn({ chatId }, 'Attempted to add AI message to non-existent session');
      return;
    }

    session.messages.push(new AIMessage(message));
    session.metadata.messageCount++;
    session.lastActivity = new Date();

    this.trimSessionHistory(session);

    logger.debug({ chatId, messageCount: session.messages.length }, 'AI message added');
  }

  getMessages(chatId: string): BaseMessage[] {
    const session = this.sessions.get(chatId);
    return session ? [...session.messages] : [];
  }

  clearSession(chatId: string): void {
    const deleted = this.sessions.delete(chatId);
    if (deleted) {
      logger.info({ chatId }, 'Session cleared');
    }
  }

  clearAllSessions(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    logger.info({ count }, 'All sessions cleared');
  }

  getSessionInfo(chatId: string): ChatSession | null {
    return this.sessions.get(chatId) || null;
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  cleanupInactiveSessions(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [chatId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session, now)) {
        this.sessions.delete(chatId);
        cleaned++;
        logger.info({ chatId, lastActivity: session.lastActivity }, 'Session expired and cleaned');
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, remaining: this.sessions.size }, 'Inactive sessions cleaned up');
    }

    return cleaned;
  }

  private isSessionExpired(session: ChatSession, now: Date = new Date()): boolean {
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
    const inactiveMs = now.getTime() - session.lastActivity.getTime();
    return inactiveMs > timeoutMs;
  }

  private trimSessionHistory(session: ChatSession): void {
    if (session.messages.length > this.config.historyLimit) {
      const toRemove = session.messages.length - this.config.historyLimit;
      session.messages.splice(0, toRemove);

      logger.debug(
        { chatId: session.chatId, removed: toRemove, remaining: session.messages.length },
        'Session history trimmed'
      );
    }
  }

  getStatistics() {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      oldestSession: sessions.reduce((oldest, s) =>
        !oldest || s.metadata.startTime < oldest.metadata.startTime ? s : oldest
      , null as ChatSession | null),
      config: this.config,
    };
  }
}
