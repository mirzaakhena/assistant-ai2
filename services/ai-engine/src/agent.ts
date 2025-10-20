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
  private currentUserId: string | null = null;

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
      logger.info({
        toolCount: this.tools.length,
        toolNames: this.tools.map((t: any) => t.name)
      }, 'MCP tools loaded');

      // Log each tool for debugging
      this.tools.forEach((tool: any) => {
        logger.debug({
          name: tool.name,
          description: tool.description?.substring(0, 100),
          hasInvoke: typeof tool.invoke === 'function',
        }, 'Tool registered');
      });
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

    logger.info({
      agentCreated: !!this.agent,
      toolsPassedToAgent: this.tools.length,
      llmModel: modelName,
    }, 'ReAct agent created');

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

      // Inject fresh system prompt with current timestamp and userId
      const systemPrompt = getSystemPrompt(this.currentUserId || undefined);
      const messagesWithSystem = [
        new SystemMessage(systemPrompt),
        ...sessionMessages
      ];

      const response = await this.agent.invoke({
        messages: messagesWithSystem,
      });

      // DEBUG: Log all messages to see if tools were called
      logger.info({
        totalMessages: response.messages.length,
        messageTypes: response.messages.map((m: any) => m._getType ? m._getType() : typeof m),
      }, 'Agent response received');

      // Log each message for debugging
      response.messages.forEach((msg: any, index: number) => {
        logger.debug({
          index,
          type: msg._getType ? msg._getType() : typeof msg,
          hasToolCalls: !!msg.tool_calls,
          toolCallsCount: msg.tool_calls ? msg.tool_calls.length : 0,
          contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 100) : 'non-string',
        }, 'Message in response');
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
        userMessage: message.body
      }, 'Processing incoming WhatsApp message');

      // Set current user ID for validation context
      this.currentUserId = message.from;

      // Process message with AI
      const chatId = message.from;
      const response = await this.processMessage(message.body, chatId);

      logger.info({
        from: message.from,
        aiResponse: response
      }, 'AI response generated');

      // Send reply via MCP tool (userId will be injected by AI based on system prompt)
      const sendMessageTool = this.tools.find((tool: any) => tool.name === 'whatsapp_send_message');
      if (!sendMessageTool) {
        throw new Error('whatsapp_send_message tool not found');
      }

      await sendMessageTool.invoke({
        phoneNumber: message.from,
        message: response,
        userId: this.currentUserId, // Explicit injection for reply
      });

      logger.info({
        from: message.from,
        responseLength: response.length
      }, 'Reply sent successfully via MCP tool');

    } catch (error) {
      logger.error({ error, from: message.from }, 'Error handling WhatsApp message');
    }
  }

  async handleCronjobTrigger(jobData: any): Promise<void> {
    try {
      logger.info({
        jobId: jobData.jobId,
        jobName: jobData.jobName,
        payload: jobData.payload
      }, 'Processing incoming cronjob trigger');

      const { payload } = jobData;

      // If payload has a prompt, process it like a user message
      if (payload?.prompt) {
        // Extract userId from context
        const requestedBy = payload.context?.requestedBy;
        if (!requestedBy) {
          logger.error({ jobData }, 'Missing requestedBy in cronjob context - aborting');
          return;
        }

        // Set current user ID for validation context
        this.currentUserId = requestedBy;

        logger.info({
          prompt: payload.prompt,
          jobId: jobData.jobId,
          requestedBy
        }, 'Processing scheduled prompt from cronjob');

        try {
          // Use session ID from context or create system session
          const sessionId = payload.context?.sessionId || `system:cronjob:${jobData.jobId}`;

          // Process the prompt through the AI agent
          const response = await this.processMessage(payload.prompt, sessionId);

          logger.info({
            jobId: jobData.jobId,
            jobName: jobData.jobName,
            requestedBy,
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
