# ASPRI AI v2.0 - Modular AI Assistant Platform

Modern, event-driven AI assistant platform with WhatsApp integration and scheduled task automation.

## Architecture Overview

```
┌─────────────────┐     Events      ┌──────────────────┐
│  WhatsApp Svc   │────────────────▶│                  │
│  - API Server   │                 │  Redis Streams   │
│  - Event Pub    │                 │  Message Broker  │
└─────────────────┘                 └──────────────────┘
                                             │
┌─────────────────┐     Events               │ Subscribe
│  Cronjob Svc    │────────────────▶         │
│  - Scheduler    │                          ▼
│  - Event Pub    │                  ┌──────────────────┐
└─────────────────┘                  │   AI Engine      │
        ▲                            │   - LangGraph    │
        │                            │   - Session Mgr  │
        │ API Calls                  └──────────────────┘
        │                                     │
┌─────────────────┐                           │ MCP Protocol
│   MCP Server    │◀──────────────────────────┘
│  - Bridge/Proxy │
│  - WA Tools     │─────API Call────▶ Services
│  - Cron Tools   │
└─────────────────┘
```

## Key Features

### Event-Driven Architecture
- **Real-time processing**: Messages processed immediately via Redis Streams
- **Decoupled services**: Each service is independent and scalable
- **Message persistence**: Events stored in Redis for reliability

### Modular Services
1. **WhatsApp Service** (`services/whatsapp`)
   - WhatsApp Web.js integration
   - REST API for WhatsApp operations
   - Event publisher for incoming messages

2. **Cronjob Service** (`services/cronjob`)
   - Cron job scheduler (node-cron)
   - REST API for job management
   - Event publisher for job triggers

3. **MCP Server** (`services/mcp`)
   - MCP protocol bridge
   - Proxy to WhatsApp and Cronjob APIs
   - Tools for AI agent

4. **AI Engine** (`services/ai-engine`)
   - LangChain + LangGraph agent
   - Event consumer (WhatsApp + Cronjob)
   - Session management
   - Multi-LLM support (Ollama, OpenAI, Anthropic)

### Shared Libraries
- **@aspri/logger**: Pino-based logging
- **@aspri/types**: Shared TypeScript types
- **@aspri/utils**: Redis client, event publisher/consumer

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- pnpm or npm

### Installation

```bash
# Clone the repository
cd /Users/mirza/Workspace/aspri-ai2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Running the Services

```bash
# 1. Start Redis
npm run docker:up

# 2. Build all services
npm run build

# 3. Start services in separate terminals

# Terminal 1: WhatsApp Service
npm run start:whatsapp

# Terminal 2: Cronjob Service
npm run start:cronjob

# Terminal 3: AI Engine (will spawn MCP server internally)
npm run start:ai
```

### Development Mode

```bash
# Start Redis
npm run docker:up

# Run services in dev mode (separate terminals)
npm run dev:whatsapp
npm run dev:cronjob
npm run dev:ai
```

## Environment Configuration

See `.env.example` for all configuration options:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Services
WHATSAPP_PORT=3001
CRONJOB_PORT=3002

# AI Engine
LLM_PROVIDER=ollama  # ollama | openai | anthropic
OLLAMA_MODEL=qwen3:14b
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

## Usage Examples

### WhatsApp Service API

```bash
# Send a message
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "628123456789", "message": "Hello!"}'

# Get chats
curl http://localhost:3001/api/chats?limit=10

# Get messages
curl http://localhost:3001/api/messages/628123456789?limit=20
```

### Cronjob Service API

```bash
# Create a cron job
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Reminder",
    "schedule": "0 9 * * *",
    "enabled": true,
    "payload": {"message": "Good morning!"}
  }'

# List all jobs
curl http://localhost:3002/api/jobs

# Start/stop a job
curl -X POST http://localhost:3002/api/jobs/{jobId}/start
curl -X POST http://localhost:3002/api/jobs/{jobId}/stop
```

## Architecture Deep Dive

### Event Flow

#### WhatsApp Message Flow
```
1. WhatsApp receives message
2. WhatsApp Service publishes to Redis Stream 'whatsapp:messages'
3. AI Engine consumes event from stream
4. AI Engine processes with LangChain agent
5. Agent uses MCP tools to send reply
6. MCP Server calls WhatsApp API
7. WhatsApp Service sends message
```

#### Cronjob Trigger Flow
```
1. Cronjob timer triggers
2. Cronjob Service publishes to Redis Stream 'cronjob:events'
3. AI Engine consumes event from stream
4. AI Engine executes scheduled action
5. (Optional) Send notifications via WhatsApp
```

### Why Redis Streams?

- **Lightweight**: Single Redis container
- **Persistent**: Messages survive restarts
- **Consumer Groups**: Multiple workers, at-least-once delivery
- **Simple**: Easy to understand and debug
- **Scalable**: Production-ready for high volume

### Advantages Over Polling

| Aspect | Polling (v1) | Event-Driven (v2) |
|--------|--------------|-------------------|
| Latency | 3+ seconds | Milliseconds |
| CPU Usage | Constant | On-demand |
| Scalability | Limited | Horizontal |
| Reliability | Message loss risk | Persistent queue |

## Project Structure

```
aspri-ai2/
├── services/
│   ├── whatsapp/          # WhatsApp Service
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── whatsapp-client.ts
│   │   │   └── api.ts
│   │   └── package.json
│   ├── cronjob/           # Cronjob Service
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── cron-scheduler.ts
│   │   │   └── api.ts
│   │   └── package.json
│   ├── mcp/               # MCP Server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── tools/
│   │   │       ├── whatsapp.ts
│   │   │       └── cronjob.ts
│   │   └── package.json
│   └── ai-engine/         # AI Engine
│       ├── src/
│       │   ├── index.ts
│       │   ├── agent.ts
│       │   ├── session-manager.ts
│       │   └── prompts.ts
│       └── package.json
├── shared/
│   ├── logger/            # Logging utilities
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Redis client, event pub/sub
├── docker-compose.yml     # Redis + Redis Commander
├── package.json           # Root package (workspaces)
└── README.md
```

## Monitoring

### Redis Commander Web UI

Access Redis data via web interface:
```
http://localhost:8081
```

View streams, consumer groups, and pending messages.

### Health Checks

```bash
# WhatsApp Service
curl http://localhost:3001/health

# Cronjob Service
curl http://localhost:3002/health
```

## Troubleshooting

### WhatsApp QR Code Not Showing
```bash
# Check WhatsApp service logs
# QR code appears in stderr
npm run start:whatsapp

# If session corrupted, clean:
rm -rf services/whatsapp/.wwebjs_auth
```

### Redis Connection Failed
```bash
# Check Redis is running
docker ps | grep redis

# Restart Redis
npm run docker:down
npm run docker:up
```

### AI Engine Not Processing Messages
```bash
# Check consumer groups in Redis
redis-cli XINFO GROUPS whatsapp:messages
redis-cli XINFO GROUPS cronjob:events

# Check pending messages
redis-cli XPENDING whatsapp:messages ai-engine
```

## Development

### Adding a New Service

1. Create service directory in `services/`
2. Add to root `package.json` workspaces
3. Implement event publishing (if needed)
4. Add MCP tools (if needed for AI)
5. Update documentation

### Adding New MCP Tools

Edit `services/mcp/src/tools/` and add your tool definitions.

### Testing Event Flow

```bash
# Publish test event to Redis
redis-cli XADD whatsapp:messages * \
  eventId test-123 \
  type whatsapp:message \
  source whatsapp \
  timestamp $(date +%s)000 \
  data '{"from":"628123456789","body":"Test"}'
```

## Production Deployment

### Docker Compose (All Services)

TODO: Create production docker-compose with all services

### Environment Variables

Ensure all required environment variables are set:
- API keys (OpenAI/Anthropic if using)
- Redis host/port
- Service ports
- Log levels

### Scaling

- Run multiple AI Engine workers
- Use Redis consumer groups for load balancing
- Deploy services independently

## Migration from v1

If you have existing ASPRI AI v1:

1. Export WhatsApp session data
2. Migrate to v2 architecture
3. Session history is not preserved (fresh start)
4. Update any integrations to use new APIs

## Contributing

1. Follow TypeScript best practices
2. Add logs for debugging
3. Update documentation
4. Test event flows end-to-end

## License

MIT

## Support

For issues, check:
- Docker logs: `npm run docker:logs`
- Service logs: Check terminal output
- Redis data: http://localhost:8081
