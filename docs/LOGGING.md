# Logging Guide

## Overview

ASPRI AI v2 menggunakan structured logging dengan **Pino** untuk memudahkan debugging dan monitoring.

## Log Levels

- `debug`: Detailed information untuk debugging
- `info`: Informasi umum operasi
- `warn`: Warning yang tidak mengganggu operasi
- `error`: Error yang perlu perhatian

Set via environment variable:
```bash
LOG_LEVEL=debug  # debug | info | warn | error
```

---

## AI Engine Logging

### LLM Model Information

Saat AI Engine startup, akan tampil log detail model yang digunakan:

#### Ollama (Local/Offline)
```json
{
  "level": "info",
  "time": 1705315800000,
  "service": "agent",
  "provider": "ollama",
  "model": "qwen2.5:latest",
  "baseUrl": "http://localhost:11434",
  "temperature": 0.7,
  "msg": "LLM initialized (Ollama - Local/Offline)"
}
```

#### OpenAI
```json
{
  "level": "info",
  "time": 1705315800000,
  "service": "agent",
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7,
  "msg": "LLM initialized (OpenAI)"
}
```

#### Anthropic Claude
```json
{
  "level": "info",
  "time": 1705315800000,
  "service": "agent",
  "provider": "anthropic",
  "model": "claude-3-7-sonnet-20250219",
  "temperature": 0.7,
  "msg": "LLM initialized (Anthropic Claude)"
}
```

### Message Processing

Setiap message yang diproses akan di-log:

```json
{
  "level": "debug",
  "time": 1705315800000,
  "service": "agent",
  "messageLength": 45,
  "chatId": "628123456789@c.us",
  "llmProvider": "ollama",
  "msg": "Processing message with AI"
}
```

---

## Service-Specific Logs

### WhatsApp Service

**Client Ready:**
```json
{
  "level": "info",
  "service": "whatsapp-client",
  "msg": "WhatsApp client is ready!"
}
```

**Message Received:**
```json
{
  "level": "debug",
  "service": "whatsapp-client",
  "from": "628123456789@c.us",
  "body": "Hello AI!",
  "msg": "Received incoming message"
}
```

**Event Published:**
```json
{
  "level": "info",
  "service": "whatsapp-client",
  "from": "628123456789@c.us",
  "eventId": "uuid-123",
  "msg": "Message event published"
}
```

---

### Cronjob Service

**Job Created:**
```json
{
  "level": "info",
  "service": "cron-scheduler",
  "jobId": "uuid-456",
  "name": "Daily Reminder",
  "type": "recurring",
  "schedule": "0 9 * * *",
  "msg": "Job created"
}
```

**Job Executed:**
```json
{
  "level": "info",
  "service": "cron-scheduler",
  "jobId": "uuid-456",
  "name": "Daily Reminder",
  "type": "recurring",
  "msg": "Executing job"
}
```

**One-Time Job Completed:**
```json
{
  "level": "info",
  "service": "cron-scheduler",
  "jobId": "uuid-789",
  "msg": "One-time job executed and disabled"
}
```

---

### Redis/Event System

**Event Published:**
```json
{
  "level": "debug",
  "service": "event-publisher",
  "streamName": "whatsapp:messages",
  "eventId": "uuid-abc",
  "messageId": "1705315800000-0",
  "msg": "Event published"
}
```

**Event Consumed:**
```json
{
  "level": "debug",
  "service": "event-consumer",
  "eventId": "uuid-abc",
  "type": "whatsapp:message",
  "msg": "Processing event"
}
```

---

## Log Format

### Development (Pretty Print)

```
[22:30:00.123] INFO (agent): LLM initialized (Ollama - Local/Offline)
    provider: "ollama"
    model: "qwen2.5:latest"
    baseUrl: "http://localhost:11434"
    temperature: 0.7
```

### Production (JSON)

```json
{"level":30,"time":1705315800123,"service":"agent","provider":"ollama","model":"qwen2.5:latest","baseUrl":"http://localhost:11434","temperature":0.7,"msg":"LLM initialized (Ollama - Local/Offline)"}
```

---

## Filtering Logs

### By Service
```bash
# Development
npm run start:ai 2>&1 | grep "agent"

# Production
pm2 logs ai-engine | grep "agent"
```

### By Log Level
```bash
# Only errors
npm run start:ai 2>&1 | grep '"level":50'

# Info and above
npm run start:ai 2>&1 | grep -E '"level":(30|40|50)'
```

### By Event Type
```bash
# WhatsApp messages
npm run start:ai 2>&1 | grep "whatsapp:message"

# Cronjob triggers
npm run start:ai 2>&1 | grep "cronjob:trigger"
```

---

## Debugging Examples

### Check Which Model is Running

**Startup logs:**
```bash
npm run start:ai 2>&1 | grep "LLM initialized"
```

**Expected output:**
```
[22:30:00] INFO (agent): LLM initialized (Ollama - Local/Offline)
    model: "qwen2.5:latest"
```

### Monitor Message Processing

```bash
# Watch all message processing
npm run start:ai 2>&1 | grep "Processing message"

# With details
npm run start:ai 2>&1 | grep -A 3 "Processing message"
```

### Track Specific Chat

```bash
# Filter by chatId
npm run start:ai 2>&1 | grep "628123456789@c.us"
```

---

## Common Log Patterns

### Successful Message Flow

```
1. WhatsApp client receives message
   → "Received incoming message"

2. Event published to Redis
   → "Message event published"

3. AI Engine consumes event
   → "Processing incoming WhatsApp message"

4. Process with LLM
   → "Processing message with AI"

5. AI response generated
   → "AI response generated"

6. Reply sent via MCP
   → "Reply sent successfully"
```

### Cronjob Execution Flow

```
1. Job triggers
   → "Executing job"

2. Event published
   → "Job event published"

3. AI Engine processes
   → "Processing cronjob trigger"

4. Action completed
   → "Cronjob processed"
```

---

## Troubleshooting

### No Logs Appearing

**Check log level:**
```bash
LOG_LEVEL=debug npm run start:ai
```

**Check service is running:**
```bash
ps aux | grep ai-engine
```

### Too Many Logs

**Reduce verbosity:**
```bash
LOG_LEVEL=warn npm run start:ai
```

**Filter specific service:**
```bash
npm run start:ai 2>&1 | grep -v "debug"
```

### Model Not Loading

**Check initialization logs:**
```bash
npm run start:ai 2>&1 | grep -E "(Initializing LLM|LLM initialized|Failed)"
```

**Expected successful output:**
```
[INFO] Initializing LLM...
[INFO] LLM initialized (Ollama - Local/Offline)
    model: "qwen2.5:latest"
```

---

## Log Aggregation (Production)

### With PM2

```bash
# View logs
pm2 logs ai-engine

# Save to file
pm2 logs ai-engine > ai-engine.log

# Tail last 100 lines
pm2 logs ai-engine --lines 100

# Follow in real-time
pm2 logs ai-engine --lines 0
```

### With Docker

```bash
# View logs
docker logs aspri-ai-engine

# Follow
docker logs -f aspri-ai-engine

# Last 100 lines
docker logs --tail 100 aspri-ai-engine
```

---

## Custom Logging

### Add Your Own Logs

```typescript
import { createLogger } from '@aspri/logger';

const logger = createLogger('my-service');

// Info
logger.info({ key: 'value' }, 'Operation completed');

// Debug
logger.debug({ details: {...} }, 'Detailed info');

// Error
logger.error({ error }, 'Operation failed');

// Warn
logger.warn({ issue: 'something' }, 'Warning message');
```

### Log Format

```typescript
logger.info(
  {
    // Structured data
    userId: '123',
    action: 'login',
    duration: 150
  },
  'User logged in'  // Message
);
```

**Output:**
```json
{
  "level": 30,
  "time": 1705315800000,
  "service": "my-service",
  "userId": "123",
  "action": "login",
  "duration": 150,
  "msg": "User logged in"
}
```

---

## Best Practices

1. **Use appropriate log levels**
   - `debug`: Development/troubleshooting
   - `info`: Normal operations
   - `warn`: Potential issues
   - `error`: Actual errors

2. **Include context**
   - Always include relevant IDs (chatId, jobId, eventId)
   - Add timestamps for time-sensitive operations
   - Include error details

3. **Avoid sensitive data**
   - Don't log API keys
   - Mask phone numbers if needed
   - Redact personal information

4. **Keep messages concise**
   - Clear, actionable messages
   - Use structured data for details
   - Consistent format

5. **Log important events**
   - Service startup/shutdown
   - Model initialization
   - Event processing
   - Errors and failures

---

## Environment Variables

```env
# Logging Configuration
LOG_LEVEL=info           # debug | info | warn | error
NODE_ENV=development     # development | production
```

**Development mode:**
- Pretty printed logs
- Color coded
- Human readable

**Production mode:**
- JSON format
- Machine parseable
- Compact
