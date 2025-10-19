import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createLogger } from '@aspri/logger';
import { WhatsAppMessage } from '@aspri/types';
import { getSystemPrompt } from './prompts.js';
import { SessionManager } from './session-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger('agent');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LLMProvider = 'ollama' | 'openai' | 'anthropic';

export class AgentOrchestrator {
  private mcpClient: MultiServerMCPClient | null = null;
  private agent: any = null;
  private llm: BaseChatModel | null = null;
  private sessionManager: SessionManager | null = null;
  private tools: any[] = [];

  async initialize() {
    logger.info('Initializing AI Agent...');

    // Path to MCP server
    const mcpServerPath = path.resolve(__dirname, '../../mcp/dist/index.js');

    logger.info({ mcpServerPath }, 'MCP server path');

    // Initialize MCP Client
    this.mcpClient = new MultiServerMCPClient({
      mcpServers: {
        aspri: {
          command: 'node',
          args: [mcpServerPath],
          transport: 'stdio',
        },
      },
    });

    logger.info('Initializing LLM...');

    // Determine LLM provider
    const llmProvider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase() as LLMProvider;
    const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7');
    let modelName: string;

    if (llmProvider === 'ollama') {
      modelName = process.env.OLLAMA_MODEL || 'qwen2.5:latest';
      this.llm = new ChatOllama({
        model: modelName,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        temperature,
      });
      logger.info({
        provider: llmProvider,
        model: modelName,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        temperature
      }, 'LLM initialized (Ollama - Local/Offline)');
    } else if (llmProvider === 'openai') {
      modelName = process.env.OPENAI_MODEL || 'gpt-4o';
      this.llm = new ChatOpenAI({
        model: modelName,
        apiKey: process.env.OPENAI_API_KEY,
        temperature,
      });
      logger.info({
        provider: llmProvider,
        model: modelName,
        temperature
      }, 'LLM initialized (OpenAI)');
    } else if (llmProvider === 'anthropic') {
      modelName = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
      this.llm = new ChatAnthropic({
        model: modelName,
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature,
      });
      logger.info({
        provider: llmProvider,
        model: modelName,
        temperature
      }, 'LLM initialized (Anthropic Claude)');
    } else {
      throw new Error(`Unsupported LLM provider: ${llmProvider}`);
    }

    logger.info('Getting MCP tools...');

    // Get tools from MCP server
    try {
      this.tools = await this.mcpClient.getTools();
      logger.info({ toolCount: this.tools.length }, 'MCP tools loaded');
    } catch (error) {
      logger.error({ error }, 'Failed to get MCP tools');
      throw error;
    }

    logger.info('Creating ReAct agent...');

    // Create LangGraph ReAct agent
    // Note: System prompt will be injected dynamically in processMessage
    this.agent = createReactAgent({
      llm: this.llm,
      tools: this.tools,
    });

    // Initialize Session Manager
    logger.info('Initializing Session Manager...');
    this.sessionManager = new SessionManager();

    logger.info('Agent orchestrator initialized');
  }

  async processMessage(message: string, chatId: string): Promise<string> {
    if (!this.agent || !this.sessionManager) {
      throw new Error('Agent not initialized');
    }

    logger.debug({
      messageLength: message.length,
      chatId,
      llmProvider: process.env.LLM_PROVIDER || 'ollama'
    }, 'Processing message with AI');

    try {
      // Add user message to session
      this.sessionManager.addUserMessage(chatId, message);

      // Get conversation history
      const sessionMessages = this.sessionManager.getMessages(chatId);

      // Inject fresh system prompt with current timestamp
      const systemPrompt = getSystemPrompt();
      const messagesWithSystem = [
        new SystemMessage(systemPrompt),
        ...sessionMessages
      ];

      const response = await this.agent.invoke({
        messages: messagesWithSystem,
      });

      const lastMessage = response.messages[response.messages.length - 1];
      const responseText = lastMessage.content;

      // Save AI response to session
      this.sessionManager.addAIMessage(chatId, responseText);

      logger.debug({ responseLength: responseText.length, chatId }, 'AI response generated');
      return responseText;

    } catch (error) {
      logger.error({ error, chatId }, 'Error processing message');
      throw error;
    }
  }

  async handleWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
    try {
      logger.info({
        from: message.from,
        preview: message.body.substring(0, 50) + (message.body.length > 50 ? '...' : '')
      }, 'Processing incoming WhatsApp message');

      // Process message with AI
      const chatId = message.from;
      const response = await this.processMessage(message.body, chatId);

      // Send reply via MCP tool
      const sendMessageTool = this.tools.find((tool: any) => tool.name === 'whatsapp_send_message');
      if (!sendMessageTool) {
        throw new Error('whatsapp_send_message tool not found');
      }

      await sendMessageTool.invoke({
        phoneNumber: message.from,
        message: response,
      });

      logger.info({
        from: message.from,
        responseLength: response.length
      }, 'Reply sent successfully');

    } catch (error) {
      logger.error({ error, from: message.from }, 'Error handling WhatsApp message');
    }
  }

  async handleCronjobTrigger(jobData: any): Promise<void> {
    try {
      logger.info({
        jobId: jobData.jobId,
        jobName: jobData.jobName,
        hasPayload: !!jobData.payload,
        hasPrompt: !!jobData.payload?.prompt
      }, 'Handling cronjob trigger');

      const { payload } = jobData;

      // If payload has a prompt, process it like a user message
      if (payload?.prompt) {
        logger.info({
          prompt: payload.prompt,
          jobId: jobData.jobId
        }, 'Processing scheduled prompt from cronjob');

        try {
          // Use a special session ID for system/scheduled tasks
          // This keeps scheduled task executions separate from user conversations
          const systemSessionId = `system:cronjob:${jobData.jobId}`;

          // Process the prompt through the AI agent
          const response = await this.processMessage(payload.prompt, systemSessionId);

          logger.info({
            jobId: jobData.jobId,
            jobName: jobData.jobName,
            responsePreview: response.substring(0, 100) + (response.length > 100 ? '...' : ''),
            responseLength: response.length
          }, 'Scheduled task executed successfully');

        } catch (error) {
          logger.error({
            error,
            jobId: jobData.jobId,
            prompt: payload.prompt
          }, 'Error processing scheduled prompt');
        }
      } else {
        // No prompt in payload - just log the trigger
        logger.info({
          jobId: jobData.jobId,
          jobName: jobData.jobName,
          payload
        }, 'Cronjob triggered without prompt - no action taken');
      }

    } catch (error) {
      logger.error({ error, jobData }, 'Error handling cronjob trigger');
    }
  }

  async shutdown() {
    logger.info('Shutting down agent orchestrator...');

    if (this.sessionManager) {
      const stats = this.sessionManager.getStatistics();
      logger.info({ stats }, 'Session statistics at shutdown');
      this.sessionManager.clearAllSessions();
    }

    this.mcpClient = null;
    this.agent = null;
    this.llm = null;

    logger.info('Agent orchestrator shut down');
  }
}
