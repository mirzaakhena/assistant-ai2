# Restart Instructions

## ✅ Build Completed Successfully!

Timestamp fix has been applied. AI will now receive fresh timestamps on every message.

## 🔄 Restart AI Engine

**IMPORTANT:** You must restart AI Engine to use the new code.

### Option 1: If running in terminal

1. **Stop** the current AI Engine process (Ctrl+C)
2. **Start** again:
   ```bash
   cd /Users/mirza/Workspace/aspri-ai2
   npm run start:ai
   ```

### Option 2: If using PM2

```bash
pm2 restart ai-engine
```

### Option 3: If using Docker

```bash
docker-compose restart ai-engine
```

---

## ✨ What Changed?

### Before:
- Static system prompt (timestamp stale)
- AI calculated timestamps from 2023

### After:
- **Dynamic system prompt** with fresh timestamp on every message
- System prompt includes:
  ```
  Current timestamp (milliseconds): 1760805910965
  Current date/time (ISO): 2025-10-18T16:45:10.965Z

  TIMESTAMP CALCULATION RULES:
  - For "2 minutes from now": current_timestamp + (2 * 60 * 1000)
  - Example: 1760805910965 + 120000 = 1760806030965
  ```

---

## 🧪 Test After Restart

Send this message via WhatsApp:
```
Kirimkan saya pesan "hello Mirza" 2 menit dari sekarang
```

**Expected behavior:**
1. AI creates one-time job successfully ✅
2. After 2 minutes, you receive WhatsApp message: "hello Mirza" ✅

**Check logs:**
```bash
# AI Engine logs
tail -f logs/ai-engine.log

# Cronjob logs
tail -f logs/cronjob.log
```

**Expected cronjob log:**
```json
{
  "level": "info",
  "service": "cronjob-api",
  "name": "Send Hello Message",
  "type": "one-time",
  "scheduledTime": 1760806030965,  // Future timestamp ✅
  "msg": "Received create job request"
}
```

---

## 🐛 If Still Getting Error

1. **Verify build completed:**
   ```bash
   ls -la services/ai-engine/dist/prompts.js
   ls -la services/ai-engine/dist/agent.js
   ```

2. **Test timestamp manually:**
   ```bash
   cd services/ai-engine
   node test-timestamp.js
   ```

3. **Check which process is running:**
   ```bash
   ps aux | grep ai-engine
   ```

4. **Kill old process if needed:**
   ```bash
   pkill -f "ai-engine"
   npm run start:ai
   ```

---

## 📊 Verification

After restart, the AI Engine should log:
```
[INFO] Initializing AI Agent...
[INFO] Creating ReAct agent...
[INFO] Agent orchestrator initialized
```

Then when processing a message:
```
[DEBUG] Processing message with AI: chatId=..., llmProvider=ollama
```

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ No more "scheduledTime must be in the future" errors
- ✅ One-time jobs created successfully
- ✅ Jobs trigger after the specified time
- ✅ WhatsApp messages sent as scheduled

---

## Need Help?

Check `docs/TROUBLESHOOTING.md` for common issues.
