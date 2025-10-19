# Deployment Guide

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- Docker Desktop (for Redis)
- pnpm or npm
- Git

### Initial Setup

```bash
# Navigate to project directory
cd /Users/mirza/Workspace/aspri-ai2

# Install dependencies
npm install

# Build shared libraries first
npm run build

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

### Environment Configuration

Edit `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp Service
WHATSAPP_PORT=3001
WHATSAPP_STREAM_NAME=whatsapp:messages

# Cronjob Service
CRONJOB_PORT=3002
CRONJOB_STREAM_NAME=cronjob:events

# AI Engine - Choose LLM Provider
LLM_PROVIDER=ollama  # ollama | openai | anthropic

# Ollama (Local AI - Free)
OLLAMA_MODEL=qwen3:14b
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI (Cloud AI - Requires API Key)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Anthropic Claude (Cloud AI - Requires API Key)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219

# LLM Temperature
LLM_TEMPERATURE=0.7

# Session Management
SESSION_HISTORY_LIMIT=50
SESSION_TIMEOUT_MINUTES=60

# Logging
LOG_LEVEL=info  # debug | info | warn | error
NODE_ENV=development  # development | production
```

### Start Redis

```bash
# Start Redis and Redis Commander
npm run docker:up

# Verify Redis is running
docker ps | grep redis

# View logs
npm run docker:logs
```

Access Redis Commander: http://localhost:8081

### Run Services

**Option 1: Development Mode (Recommended)**

Open 3 separate terminals:

```bash
# Terminal 1: WhatsApp Service
npm run dev:whatsapp

# Terminal 2: Cronjob Service
npm run dev:cronjob

# Terminal 3: AI Engine
npm run dev:ai
```

**Option 2: Production Build**

```bash
# Build all services
npm run build

# Run in separate terminals
npm run start:whatsapp
npm run start:cronjob
npm run start:ai
```

### First-Time WhatsApp Setup

1. Run WhatsApp Service
2. QR code will appear in terminal
3. Scan with your WhatsApp mobile app
4. Session saved to `services/whatsapp/.wwebjs_auth`

---

## Production Deployment

### Option 1: PM2 (Process Manager)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'whatsapp-service',
      script: 'services/whatsapp/dist/index.js',
      env: {
        NODE_ENV: 'production',
        WHATSAPP_PORT: 3001
      }
    },
    {
      name: 'cronjob-service',
      script: 'services/cronjob/dist/index.js',
      env: {
        NODE_ENV: 'production',
        CRONJOB_PORT: 3002
      }
    },
    {
      name: 'ai-engine',
      script: 'services/ai-engine/dist/index.js',
      env: {
        NODE_ENV: 'production',
        LLM_PROVIDER: 'ollama'
      }
    }
  ]
};
```

Start services:
```bash
# Build first
npm run build

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit

# Stop all
pm2 stop all

# Restart all
pm2 restart all

# Auto-start on system reboot
pm2 startup
pm2 save
```

---

### Option 2: Docker Compose (All-in-One)

Create `Dockerfile` for each service:

**services/whatsapp/Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared libraries
COPY shared/ ./shared/

# Copy WhatsApp service
COPY services/whatsapp/ ./services/whatsapp/

# Install dependencies
RUN npm install

# Build
RUN npm run build

# Install Chromium for whatsapp-web.js
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app/services/whatsapp

CMD ["node", "dist/index.js"]
```

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: aspri-redis
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - aspri-network
    restart: unless-stopped

  whatsapp:
    build:
      context: .
      dockerfile: services/whatsapp/Dockerfile
    container_name: aspri-whatsapp
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - WHATSAPP_PORT=3001
      - NODE_ENV=production
    ports:
      - "3001:3001"
    volumes:
      - whatsapp-auth:/app/services/whatsapp/.wwebjs_auth
    depends_on:
      - redis
    networks:
      - aspri-network
    restart: unless-stopped

  cronjob:
    build:
      context: .
      dockerfile: services/cronjob/Dockerfile
    container_name: aspri-cronjob
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - CRONJOB_PORT=3002
      - NODE_ENV=production
    ports:
      - "3002:3002"
    depends_on:
      - redis
    networks:
      - aspri-network
    restart: unless-stopped

  ai-engine:
    build:
      context: .
      dockerfile: services/ai-engine/Dockerfile
    container_name: aspri-ai-engine
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - LLM_PROVIDER=ollama
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - NODE_ENV=production
    depends_on:
      - redis
      - whatsapp
      - cronjob
    networks:
      - aspri-network
    restart: unless-stopped

volumes:
  redis-data:
  whatsapp-auth:

networks:
  aspri-network:
    driver: bridge
```

Deploy:
```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

---

### Option 3: Kubernetes (Advanced)

Create Kubernetes manifests in `k8s/` directory:

- `redis-deployment.yaml`
- `whatsapp-deployment.yaml`
- `cronjob-deployment.yaml`
- `ai-engine-deployment.yaml`
- `services.yaml`
- `configmap.yaml`

Deploy:
```bash
kubectl apply -f k8s/
```

---

## Scaling Strategies

### Horizontal Scaling: AI Engine

Run multiple AI Engine workers:

```bash
# Worker 1
CONSUMER_NAME=ai-worker-1 npm run start:ai

# Worker 2
CONSUMER_NAME=ai-worker-2 npm run start:ai

# Worker 3
CONSUMER_NAME=ai-worker-3 npm run start:ai
```

Redis consumer groups will automatically distribute messages across workers.

**With PM2:**
```javascript
{
  name: 'ai-engine',
  script: 'services/ai-engine/dist/index.js',
  instances: 3,  // Run 3 instances
  exec_mode: 'cluster',
  env: {
    CONSUMER_NAME: 'ai-worker'
  }
}
```

---

## Monitoring

### Health Checks

```bash
# WhatsApp Service
curl http://localhost:3001/health

# Cronjob Service
curl http://localhost:3002/health
```

### Redis Monitoring

**Redis Commander UI:** http://localhost:8081

**CLI Commands:**
```bash
# Connect to Redis
docker exec -it aspri-redis redis-cli

# Check stream length
XLEN whatsapp:messages
XLEN cronjob:events

# Check consumer groups
XINFO GROUPS whatsapp:messages

# Check pending messages
XPENDING whatsapp:messages ai-engine

# View stream contents
XRANGE whatsapp:messages - + COUNT 10
```

### Application Logs

**Development:**
```bash
# Logs printed to console with pino-pretty
```

**Production (PM2):**
```bash
pm2 logs whatsapp-service
pm2 logs cronjob-service
pm2 logs ai-engine

# Save logs to file
pm2 logs --lines 1000 > logs.txt
```

**Production (Docker):**
```bash
docker logs aspri-whatsapp
docker logs aspri-cronjob
docker logs aspri-ai-engine

# Follow logs
docker logs -f aspri-ai-engine
```

---

## Backup & Recovery

### WhatsApp Session Backup

```bash
# Backup WhatsApp auth data
tar -czf whatsapp-session-backup-$(date +%Y%m%d).tar.gz \
  services/whatsapp/.wwebjs_auth

# Restore
tar -xzf whatsapp-session-backup-20250115.tar.gz
```

### Redis Data Backup

```bash
# Manual backup (creates dump.rdb)
docker exec aspri-redis redis-cli SAVE

# Copy backup file
docker cp aspri-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb

# Restore (stop Redis first)
docker cp redis-backup-20250115.rdb aspri-redis:/data/dump.rdb
docker restart aspri-redis
```

### Automated Backups

Create cron job for daily backups:
```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/backup-script.sh
```

**backup-script.sh:**
```bash
#!/bin/bash
BACKUP_DIR="/backups/aspri-ai"
DATE=$(date +%Y%m%d)

# WhatsApp session
tar -czf $BACKUP_DIR/whatsapp-$DATE.tar.gz \
  /app/services/whatsapp/.wwebjs_auth

# Redis data
docker exec aspri-redis redis-cli SAVE
docker cp aspri-redis:/data/dump.rdb $BACKUP_DIR/redis-$DATE.rdb

# Delete backups older than 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

---

## Security Best Practices

### 1. Environment Variables

**Never commit `.env` to git:**
```bash
# Already in .gitignore
.env
.env.local
```

**Use secrets management in production:**
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets

### 2. API Authentication

Add API keys to services:

```javascript
// Middleware example
app.use((req, res, next) => {
  const apiKey = req.header('X-API-Key');
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 3. Redis Security

**Production Redis configuration:**
```env
REDIS_PASSWORD=strong-password-here
```

**docker-compose.yml:**
```yaml
redis:
  command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
```

### 4. HTTPS/TLS

Use reverse proxy (nginx) for HTTPS:

```nginx
server {
  listen 443 ssl;
  server_name api.yourdomain.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location /whatsapp/ {
    proxy_pass http://localhost:3001/;
  }

  location /cronjob/ {
    proxy_pass http://localhost:3002/;
  }
}
```

---

## Troubleshooting

### WhatsApp QR Code Not Showing

```bash
# Clear session and restart
rm -rf services/whatsapp/.wwebjs_auth
npm run start:whatsapp
```

### Redis Connection Refused

```bash
# Check Redis status
docker ps | grep redis

# Check Redis logs
docker logs aspri-redis

# Restart Redis
npm run docker:down
npm run docker:up
```

### AI Engine Not Processing Messages

```bash
# Check consumer groups
redis-cli XINFO GROUPS whatsapp:messages

# Check pending messages
redis-cli XPENDING whatsapp:messages ai-engine

# Reset consumer group (WARNING: loses pending)
redis-cli XGROUP DESTROY whatsapp:messages ai-engine
redis-cli XGROUP CREATE whatsapp:messages ai-engine 0 MKSTREAM
```

### High Memory Usage

```bash
# Check Redis memory
redis-cli INFO memory

# Trim old messages
redis-cli XTRIM whatsapp:messages MAXLEN ~ 1000

# Check AI Engine sessions
# Sessions cleared on timeout (default 60 min)
```

### Service Won't Start

```bash
# Check port conflicts
lsof -i :3001
lsof -i :3002

# Kill conflicting processes
kill -9 <PID>

# Check logs for errors
npm run start:whatsapp 2>&1 | tee whatsapp.log
```

---

## Performance Tuning

### Redis Configuration

**redis.conf:**
```conf
# Increase max memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (choose one)
# Option 1: AOF (safer, slower)
appendonly yes
appendfsync everysec

# Option 2: RDB (faster, less safe)
save 900 1
save 300 10
```

### AI Engine

**Increase worker count:**
```bash
# PM2 cluster mode
instances: max  # Use all CPU cores
```

**Reduce LLM latency:**
```env
# Use faster model
OLLAMA_MODEL=qwen2.5:3b  # Smaller, faster
```

### WhatsApp Service

**Reduce memory usage:**
```javascript
// In whatsapp-client.ts
puppeteer: {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // Use /tmp instead of /dev/shm
    '--disable-accelerated-2d-canvas',
    '--disable-gpu'
  ]
}
```

---

## Maintenance

### Daily Tasks

- Check service health endpoints
- Monitor Redis stream lengths
- Review error logs

### Weekly Tasks

- Backup WhatsApp session
- Backup Redis data
- Review and trim old Redis streams
- Check disk space

### Monthly Tasks

- Update dependencies (`npm update`)
- Review security advisories (`npm audit`)
- Rotate logs
- Delete old backups

---

## Updating

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all
npm update

# Update specific package
npm update @langchain/core

# Rebuild
npm run build
```

### Update Services

```bash
# Pull latest code
git pull

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart services (PM2)
pm2 restart all

# Or restart services (Docker)
docker-compose restart
```

---

## Support & Help

### Logs Location

- **Development**: Console output
- **PM2**: `~/.pm2/logs/`
- **Docker**: `docker logs <container>`

### Debug Mode

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Common Issues

1. **WhatsApp disconnected**: Scan QR code again
2. **Redis out of memory**: Increase maxmemory or trim streams
3. **AI response slow**: Use faster LLM model
4. **Messages not processing**: Check consumer groups

### Getting Help

- Check logs for error messages
- Review architecture documentation
- Test with curl commands (see API.md)
- Monitor Redis with Redis Commander
