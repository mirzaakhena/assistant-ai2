# Architecture Documentation

## System Architecture

ASPRI AI v2 follows an event-driven, microservices architecture with clear separation of concerns.

## Core Principles

1. **Event-Driven**: Services communicate via Redis Streams (pub/sub pattern)
2. **Decoupled**: Each service is independent and can be scaled separately
3. **API-First**: All services expose REST APIs for direct access
4. **MCP Bridge**: AI Engine accesses services via MCP protocol
5. **Persistent Events**: Messages stored in Redis for reliability

## Component Details

### 1. WhatsApp Service

**Responsibilities:**
- Manage WhatsApp Web.js client
- Handle WhatsApp authentication (QR code)
- Send/receive WhatsApp messages
- Provide REST API for WhatsApp operations
- Publish incoming messages to Redis Stream

**Technology:**
- Express.js (REST API)
- whatsapp-web.js (WhatsApp client)
- Redis Streams (event publishing)

**API Endpoints:**
```
POST   /api/send-message
GET    /api/messages/:phoneNumber
GET    /api/chats
GET    /api/contacts/search
GET    /health
```

**Published Events:**
```typescript
{
  eventId: string,
  type: 'whatsapp:message',
  source: 'whatsapp',
  timestamp: number,
  data: WhatsAppMessage
}
```

**Port:** 3001 (configurable via `WHATSAPP_PORT`)

---

### 2. Cronjob Service

**Responsibilities:**
- Schedule and manage cron jobs
- Execute scheduled tasks on time
- Provide REST API for job management
- Publish job trigger events to Redis Stream

**Technology:**
- Express.js (REST API)
- node-cron (job scheduler)
- Redis Streams (event publishing)

**API Endpoints:**
```
POST   /api/jobs              # Create job
GET    /api/jobs              # List jobs
GET    /api/jobs/:jobId       # Get job
PATCH  /api/jobs/:jobId       # Update job
DELETE /api/jobs/:jobId       # Delete job
POST   /api/jobs/:jobId/start # Start job
POST   /api/jobs/:jobId/stop  # Stop job
GET    /health
```

**Published Events:**
```typescript
{
  eventId: string,
  type: 'cronjob:trigger',
  source: 'cronjob',
  timestamp: number,
  data: {
    jobId: string,
    jobName: string,
    scheduledTime: number,
    payload?: Record<string, any>
  }
}
```

**Port:** 3002 (configurable via `CRONJOB_PORT`)

---

### 3. MCP Server

**Responsibilities:**
- Provide MCP protocol interface
- Bridge between AI Engine and services
- Proxy API calls to WhatsApp and Cronjob services
- Convert REST responses to MCP format

**Technology:**
- MCP SDK (@modelcontextprotocol/sdk)
- Axios (HTTP client)
- stdio transport (for MCP communication)

**MCP Tools Provided:**

**WhatsApp Tools:**
- `whatsapp_send_message`
- `whatsapp_get_messages`
- `whatsapp_get_chats`
- `whatsapp_search_contacts`

**Cronjob Tools:**
- `cronjob_create`
- `cronjob_list`
- `cronjob_get`
- `cronjob_update`
- `cronjob_delete`
- `cronjob_start`
- `cronjob_stop`

**Communication:** stdio (spawned by AI Engine)

---

### 4. AI Engine

**Responsibilities:**
- Consume events from Redis Streams
- Process messages with LLM (via LangChain)
- Maintain conversation sessions
- Use MCP tools to interact with services
- Generate and send responses

**Technology:**
- LangChain + LangGraph (AI framework)
- MCP Client (@langchain/mcp-adapters)
- Redis Streams (event consumption)
- Ollama / OpenAI / Anthropic (LLM providers)

**Event Consumers:**

1. **WhatsApp Messages Consumer**
   - Stream: `whatsapp:messages`
   - Group: `ai-engine`
   - Consumer: `ai-worker-1`

2. **Cronjob Events Consumer**
   - Stream: `cronjob:events`
   - Group: `ai-engine`
   - Consumer: `ai-worker-1`

**Session Management:**
- In-memory session storage
- Conversation history per chat ID
- Configurable history limit (default: 50 messages)
- Session timeout (default: 60 minutes)

**LLM Support:**
- Ollama (default, offline)
- OpenAI (GPT-4, requires API key)
- Anthropic Claude (requires API key)

---

### 5. Shared Libraries

**@aspri/logger**
- Pino-based logging
- Pretty printing in development
- JSON logging in production

**@aspri/types**
- Shared TypeScript interfaces
- Event types
- API response types
- Domain models

**@aspri/utils**
- Redis client wrapper
- Event publisher
- Event consumer
- Consumer group management

---

## Data Flow Diagrams

### WhatsApp Message Processing

```
┌──────────┐
│ WhatsApp │ Incoming Message
│  Client  │────────┐
└──────────┘        │
                    ▼
         ┌─────────────────────┐
         │  WhatsApp Service   │
         │  - Event Handler    │
         └─────────────────────┘
                    │
                    │ Publish Event
                    ▼
         ┌─────────────────────┐
         │   Redis Stream      │
         │ 'whatsapp:messages' │
         └─────────────────────┘
                    │
                    │ Subscribe (XREADGROUP)
                    ▼
         ┌─────────────────────┐
         │    AI Engine        │
         │  - Event Consumer   │
         │  - Session Manager  │
         └─────────────────────┘
                    │
                    │ Invoke Agent
                    ▼
         ┌─────────────────────┐
         │  LangGraph Agent    │
         │  - LLM (Ollama)     │
         │  - MCP Tools        │
         └─────────────────────┘
                    │
                    │ Use Tool
                    ▼
         ┌─────────────────────┐
         │    MCP Server       │
         │  - whatsapp_send_*  │
         └─────────────────────┘
                    │
                    │ HTTP POST
                    ▼
         ┌─────────────────────┐
         │  WhatsApp Service   │
         │  - API Handler      │
         │  - WA Client        │
         └─────────────────────┘
                    │
                    │ Send Message
                    ▼
         ┌─────────────────────┐
         │   WhatsApp Web      │
         └─────────────────────┘
```

### Cronjob Trigger Processing

```
         ┌─────────────────────┐
         │  node-cron Timer    │
         │  (cron expression)  │
         └─────────────────────┘
                    │
                    │ Trigger at scheduled time
                    ▼
         ┌─────────────────────┐
         │  Cronjob Service    │
         │  - Cron Scheduler   │
         └─────────────────────┘
                    │
                    │ Publish Event
                    ▼
         ┌─────────────────────┐
         │   Redis Stream      │
         │  'cronjob:events'   │
         └─────────────────────┘
                    │
                    │ Subscribe (XREADGROUP)
                    ▼
         ┌─────────────────────┐
         │    AI Engine        │
         │  - Event Consumer   │
         │  - Cronjob Handler  │
         └─────────────────────┘
                    │
                    │ Execute action
                    ▼
         ┌─────────────────────┐
         │  (Optional)         │
         │  Send notification  │
         │  via WhatsApp       │
         └─────────────────────┘
```

---

## Redis Streams Architecture

### Stream Structure

**whatsapp:messages**
```
Stream ID: auto-generated (1234567890123-0)
Fields:
  - eventId: UUID
  - type: 'whatsapp:message'
  - source: 'whatsapp'
  - timestamp: Unix timestamp (ms)
  - data: JSON string (WhatsAppMessage)
```

**cronjob:events**
```
Stream ID: auto-generated
Fields:
  - eventId: UUID
  - type: 'cronjob:trigger'
  - source: 'cronjob'
  - timestamp: Unix timestamp (ms)
  - data: JSON string (cronjob trigger data)
```

### Consumer Groups

**ai-engine** (group name)
- Consumers: ai-worker-1, ai-worker-2, ... (scalable)
- Read mode: XREADGROUP with '>' (only new messages)
- Acknowledgment: XACK after processing
- Pending list: Messages not yet acknowledged

**Advantages:**
- At-least-once delivery
- Horizontal scaling (multiple workers)
- Automatic load balancing
- Failure recovery (pending messages retry)

---

## Scaling Strategies

### Vertical Scaling
- Increase resources for AI Engine (CPU for LLM inference)
- Increase Redis memory for larger streams

### Horizontal Scaling

**AI Engine:**
- Run multiple instances with different consumer names
- Redis consumer groups automatically distribute load
```bash
# Worker 1
CONSUMER_NAME=ai-worker-1 npm start

# Worker 2
CONSUMER_NAME=ai-worker-2 npm start
```

**Services:**
- WhatsApp Service: Single instance (WhatsApp Web.js limitation)
- Cronjob Service: Single instance (scheduler)
- MCP Server: Spawned per AI Engine instance (no shared state)

---

## Security Considerations

1. **API Authentication:** Currently none - add JWT/API keys for production
2. **WhatsApp Session:** Stored locally, encrypted by WhatsApp Web.js
3. **Environment Variables:** Store secrets in `.env` (not committed to git)
4. **Redis Access:** Local only - use password in production
5. **MCP Communication:** stdio (local process, secure)

---

## Performance Metrics

**Expected Latency:**
- WhatsApp message → AI Engine: < 100ms (Redis Streams)
- AI processing: 1-5s (depends on LLM)
- Total response time: 1-6s (vs 3-9s in polling approach)

**Throughput:**
- Redis Streams: 100k+ messages/sec
- AI Engine: Limited by LLM inference speed
- WhatsApp Service: ~10 messages/sec (WhatsApp rate limits)

---

## Monitoring & Observability

**Logs:**
- Structured JSON logs (pino)
- Service name in every log entry
- Correlation via eventId

**Metrics to Track:**
- Message processing latency
- Redis stream length (backlog)
- Pending messages count
- Session count and memory usage
- LLM inference time

**Tools:**
- Redis Commander (UI for Redis)
- pino-pretty (development log formatting)
- Future: Prometheus + Grafana

---

## Failure Modes & Recovery

**WhatsApp Service Down:**
- Messages queued in WhatsApp Web
- Service restart recovers messages
- No message loss

**AI Engine Down:**
- Events accumulate in Redis Streams
- On restart, processes pending messages
- Guaranteed delivery via consumer groups

**Redis Down:**
- Events lost if not persisted
- Use Redis AOF/RDB persistence
- Services queue locally (future enhancement)

**MCP Server Failure:**
- Spawned by AI Engine
- Automatic restart on crash
- Tools unavailable during restart

---

## Future Enhancements

1. **Add Authentication:**
   - API keys for services
   - OAuth for MCP tools

2. **Persistent Sessions:**
   - Store sessions in Redis
   - Survive AI Engine restarts

3. **Metrics & Monitoring:**
   - Prometheus exporters
   - Grafana dashboards
   - Alert system

4. **Multi-tenancy:**
   - Multiple WhatsApp accounts
   - Isolated AI agents per tenant

5. **Additional Services:**
   - Email service
   - SMS service
   - Telegram bot

6. **Advanced AI Features:**
   - RAG (Retrieval-Augmented Generation)
   - Function calling
   - Multi-modal (images, voice)

---

## Comparison with v1

| Aspect | v1 (Polling) | v2 (Event-Driven) |
|--------|--------------|-------------------|
| Architecture | Monolithic | Microservices |
| Communication | MCP get_pending_messages | Redis Streams |
| Latency | 3+ seconds | < 1 second |
| Scalability | Single instance | Horizontally scalable |
| Reliability | Message loss on crash | Persistent queue |
| Complexity | Low | Medium |
| Modularity | Low | High |
| Production-ready | Testing only | Yes |
