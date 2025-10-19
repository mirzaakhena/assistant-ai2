# Troubleshooting Guide

## Common Issues

### One-Time Job: "scheduledTime must be in the future"

**Error Message:**
```
scheduledTime must be in the future.
Received: 1689376540000 (2023-07-14T23:15:40.000Z),
Current: 1760805561752 (2025-10-18T16:39:21.752Z)
```

**Root Cause:**
AI calculated timestamp incorrectly, sending a timestamp from the past instead of the future.

**Solution:**
The system now includes real-time timestamp information in the AI's system prompt, updated on every message.

**How It Works:**
1. System prompt is regenerated on each AI invocation
2. Current timestamp is injected into the prompt
3. AI uses this timestamp as reference for calculations

**Example Prompt Section:**
```
IMPORTANT - CURRENT TIME INFORMATION:
- Current timestamp (milliseconds): 1760805561752
- Current date/time (ISO): 2025-10-18T16:39:21.752Z
- Current date/time (Jakarta): Jumat, 18 Oktober 2025 pukul 23.39.21 WIB

TIMESTAMP CALCULATION RULES:
1. ALWAYS use the current timestamp (1760805561752) as your base
2. Add the desired offset in milliseconds:
   - 1 second = 1000 ms
   - 1 minute = 60,000 ms
   - 1 hour = 3,600,000 ms
   - 1 day = 86,400,000 ms
```

**Testing:**
```bash
cd services/ai-engine
npm run build
node test-timestamp.js
```

---

### WhatsApp QR Code Not Showing

**Solution:**
```bash
# Check logs in stderr
npm run start:whatsapp 2>&1

# Clear session if corrupted
rm -rf services/whatsapp/.wwebjs_auth
```

---

### Redis Connection Failed

**Solution:**
```bash
# Start Redis
npm run docker:up

# Check Redis status
docker ps | grep redis

# Check Redis logs
docker logs aspri-redis
```

---

### AI Engine Not Processing Messages

**Check:**
1. Redis Stream has messages:
   ```bash
   redis-cli XLEN whatsapp:messages
   ```

2. Consumer group exists:
   ```bash
   redis-cli XINFO GROUPS whatsapp:messages
   ```

3. Check pending messages:
   ```bash
   redis-cli XPENDING whatsapp:messages ai-engine
   ```

**Reset Consumer Group:**
```bash
redis-cli XGROUP DESTROY whatsapp:messages ai-engine
redis-cli XGROUP CREATE whatsapp:messages ai-engine 0 MKSTREAM
```

---

### Cronjob Not Triggering

**Check:**
1. Job is enabled:
   ```bash
   curl http://localhost:3002/api/jobs/{jobId}
   ```

2. For recurring jobs, verify cron expression:
   ```bash
   # Use https://crontab.guru/ to verify
   ```

3. For one-time jobs:
   - Check if already executed
   - Verify scheduledTime is in the future
   - Check service logs

**Start/Stop Job:**
```bash
curl -X POST http://localhost:3002/api/jobs/{jobId}/start
curl -X POST http://localhost:3002/api/jobs/{jobId}/stop
```

---

## Logging

### Enable Debug Logs

```bash
# .env
LOG_LEVEL=debug
```

### Check Service Logs

**Development:**
```bash
# Logs appear in console
npm run dev:cronjob
```

**Production (PM2):**
```bash
pm2 logs cronjob-service --lines 100
```

**Production (Docker):**
```bash
docker logs aspri-cronjob -f
```

---

## Performance Issues

### High Memory Usage

**Check:**
1. Redis memory:
   ```bash
   redis-cli INFO memory
   ```

2. Trim old streams:
   ```bash
   redis-cli XTRIM whatsapp:messages MAXLEN ~ 1000
   ```

3. Check active sessions in AI Engine

### Slow AI Response

**Solutions:**
1. Use faster LLM model:
   ```env
   OLLAMA_MODEL=qwen2.5:3b
   ```

2. Increase AI Engine workers:
   ```bash
   # PM2
   instances: 3
   ```

---

## Data Recovery

### Backup WhatsApp Session

```bash
tar -czf whatsapp-backup.tar.gz services/whatsapp/.wwebjs_auth
```

### Restore WhatsApp Session

```bash
tar -xzf whatsapp-backup.tar.gz
```

### Export Redis Data

```bash
docker exec aspri-redis redis-cli SAVE
docker cp aspri-redis:/data/dump.rdb ./backup.rdb
```

---

## Getting Help

### Check Logs First

1. Service logs (console or PM2)
2. Redis Commander (http://localhost:8081)
3. Health endpoints:
   - http://localhost:3001/health
   - http://localhost:3002/health

### Common Commands

```bash
# Check running services
ps aux | grep node

# Check ports
lsof -i :3001
lsof -i :3002
lsof -i :6379

# Restart services
pm2 restart all

# Docker status
docker ps
docker-compose logs -f
```
