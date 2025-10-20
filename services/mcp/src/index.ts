#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '@aspri/logger';
import { initializeValidators } from '@aspri/utils';
import { whatsappTools, handleWhatsAppTool } from './tools/whatsapp.js';
import { cronjobTools, handleCronjobTool } from './tools/cronjob.js';

const logger = createLogger('mcp-server');

// Initialize MCP server
const server = new Server(
  {
    name: 'aspri-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...whatsappTools, ...cronjobTools],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Extract userId from args for validation context
    const userId = typeof args?.userId === 'string' ? args.userId : undefined;
    const context = userId ? { userId } : undefined;

    logger.info({
      tool: name,
      arguments: args,
      userId: userId
    }, 'Tool invoked by AI');

    let result;

    // WhatsApp tools
    if (name.startsWith('whatsapp_')) {
      result = await handleWhatsAppTool(name, args, context);
    }
    // Cronjob tools
    else if (name.startsWith('cronjob_')) {
      result = await handleCronjobTool(name, args, context);
    }
    else {
      throw new Error(`Unknown tool: ${name}`);
    }

    logger.info({
      tool: name,
      success: !(result as any).isError
    }, 'Tool execution completed');

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, tool: name }, 'Tool execution failed');
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  logger.info('Starting MCP Server...');

  // Initialize validators
  initializeValidators();
  logger.info('Validators initialized');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP Server started successfully');
}

main().catch((error) => {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  logger.error(errorInfo, 'Fatal error starting MCP server');
  console.error('Full error details:', error);
  process.exit(1);
});
