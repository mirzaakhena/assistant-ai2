# Cronjob Service API - Complete Examples

## Job Types

The Cronjob Service supports two types of jobs:

### 1. Recurring Jobs (type: "recurring")
- Uses cron expressions for scheduling
- Repeats on a schedule (e.g., every day, every hour, etc.)
- Runs indefinitely until stopped
- **Requires:** `schedule` field (cron expression)

### 2. One-Time Jobs (type: "one-time")
- Executes only once at a specific time
- Automatically disabled after execution
- **Requires:** `scheduledTime` field (Unix timestamp in milliseconds)

---

## Creating Jobs

### Create Recurring Job

**Example 1: Daily Morning Reminder (9 AM every day)**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Morning Reminder",
    "type": "recurring",
    "schedule": "0 9 * * *",
    "enabled": true,
    "payload": {
      "message": "Good morning! Time to start your day.",
      "action": "send_whatsapp_message"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123-abc",
    "name": "Daily Morning Reminder",
    "type": "recurring",
    "schedule": "0 9 * * *",
    "enabled": true,
    "payload": {
      "message": "Good morning! Time to start your day.",
      "action": "send_whatsapp_message"
    },
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Example 2: Every 5 Minutes Status Check**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Health Check Every 5 Minutes",
    "type": "recurring",
    "schedule": "*/5 * * * *",
    "enabled": true,
    "payload": {
      "action": "health_check",
      "endpoint": "/api/health"
    }
  }'
```

**Example 3: Weekly Report (Every Monday at 10 AM)**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Sales Report",
    "type": "recurring",
    "schedule": "0 10 * * 1",
    "enabled": true,
    "payload": {
      "action": "generate_report",
      "report_type": "sales",
      "recipients": ["admin@example.com"]
    }
  }'
```

### Cron Expression Reference

| Expression | Description |
|-----------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour (at minute 0) |
| `0 9 * * *` | Every day at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM (Mon-Fri) |
| `0 0 1 * *` | First day of every month at midnight |
| `0 9,17 * * *` | Every day at 9 AM and 5 PM |
| `0 */4 * * *` | Every 4 hours |

**Format:** `minute hour day-of-month month day-of-week`

---

### Create One-Time Job

**Example 1: Schedule Message in 1 Hour**
```javascript
// JavaScript example - calculate timestamp for 1 hour from now
const oneHourFromNow = Date.now() + (60 * 60 * 1000);

fetch('http://localhost:3002/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Send Birthday Reminder',
    type: 'one-time',
    scheduledTime: oneHourFromNow,
    enabled: true,
    payload: {
      message: 'Happy Birthday! 🎉',
      recipient: '628123456789'
    }
  })
});
```

**Example 2: Schedule for Specific Date/Time**
```bash
# Schedule for Jan 20, 2025 at 3:00 PM
# Unix timestamp: 1737385200000

curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Meeting Reminder - Q1 Review",
    "type": "one-time",
    "scheduledTime": 1737385200000,
    "enabled": true,
    "payload": {
      "message": "Q1 Review meeting starts in 15 minutes!",
      "action": "send_notification"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-456-def",
    "name": "Meeting Reminder - Q1 Review",
    "type": "one-time",
    "scheduledTime": 1737385200000,
    "enabled": true,
    "executed": false,
    "payload": {
      "message": "Q1 Review meeting starts in 15 minutes!",
      "action": "send_notification"
    },
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Example 3: Schedule Reminder in 30 Minutes**
```python
# Python example
import requests
import time

# Calculate timestamp for 30 minutes from now
scheduled_time = int((time.time() + 1800) * 1000)  # 30 min = 1800 sec

response = requests.post('http://localhost:3002/api/jobs', json={
    'name': 'Coffee Break Reminder',
    'type': 'one-time',
    'scheduledTime': scheduled_time,
    'enabled': True,
    'payload': {
        'message': 'Time for a coffee break! ☕',
        'action': 'send_notification'
    }
})
```

---

## Listing Jobs

### Get All Jobs
```bash
curl http://localhost:3002/api/jobs
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123-abc",
      "name": "Daily Morning Reminder",
      "type": "recurring",
      "schedule": "0 9 * * *",
      "enabled": true,
      "payload": {},
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "uuid-456-def",
      "name": "Meeting Reminder - Q1 Review",
      "type": "one-time",
      "scheduledTime": 1737385200000,
      "enabled": true,
      "executed": false,
      "payload": {},
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

### Get Job Statistics
```bash
curl http://localhost:3002/api/jobs/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "recurring": 3,
    "oneTime": 2,
    "active": 4,
    "executed": 1
  }
}
```

---

## Updating Jobs

### Update Recurring Job Schedule
```bash
curl -X PATCH http://localhost:3002/api/jobs/uuid-123-abc \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 10 * * *"
  }'
```

### Update One-Time Job Scheduled Time
```bash
curl -X PATCH http://localhost:3002/api/jobs/uuid-456-def \
  -H "Content-Type: application/json" \
  -d '{
    "scheduledTime": 1737388800000
  }'
```

**Note:** Cannot update job `type` after creation. Cannot update executed one-time jobs.

---

## Managing Jobs

### Start/Stop Jobs
```bash
# Stop a job (disable)
curl -X POST http://localhost:3002/api/jobs/uuid-123-abc/stop

# Start a job (enable)
curl -X POST http://localhost:3002/api/jobs/uuid-123-abc/start
```

### Delete Job
```bash
curl -X DELETE http://localhost:3002/api/jobs/uuid-123-abc
```

---

## Complete Workflow Examples

### Example 1: Birthday Reminder System

**1. Create recurring job to check birthdays daily**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Birthday Check",
    "type": "recurring",
    "schedule": "0 8 * * *",
    "enabled": true,
    "payload": {
      "action": "check_birthdays",
      "notification_time": "08:00"
    }
  }'
```

**2. When birthday detected, create one-time job to send greeting**
```javascript
// In your AI Engine cronjob handler
const birthdayTime = new Date('2025-01-20 09:00:00').getTime();

await fetch('http://localhost:3002/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Birthday Greeting - John Doe',
    type: 'one-time',
    scheduledTime: birthdayTime,
    enabled: true,
    payload: {
      message: 'Happy Birthday John! 🎂',
      recipient: '628123456789'
    }
  })
});
```

---

### Example 2: Meeting Reminder System

**1. Schedule 24h reminder**
```javascript
const meetingTime = new Date('2025-01-20 14:00:00').getTime();
const oneDayBefore = meetingTime - (24 * 60 * 60 * 1000);

await createJob({
  name: 'Meeting Reminder - 24h before',
  type: 'one-time',
  scheduledTime: oneDayBefore,
  payload: { message: 'Meeting tomorrow at 2 PM' }
});
```

**2. Schedule 1h reminder**
```javascript
const oneHourBefore = meetingTime - (60 * 60 * 1000);

await createJob({
  name: 'Meeting Reminder - 1h before',
  type: 'one-time',
  scheduledTime: oneHourBefore,
  payload: { message: 'Meeting in 1 hour!' }
});
```

**3. Schedule 5min reminder**
```javascript
const fiveMinBefore = meetingTime - (5 * 60 * 1000);

await createJob({
  name: 'Meeting Reminder - 5min before',
  type: 'one-time',
  scheduledTime: fiveMinBefore,
  payload: { message: 'Meeting starts in 5 minutes!' }
});
```

---

## Error Handling

### Invalid Cron Expression
```json
{
  "success": false,
  "error": {
    "message": "Invalid cron expression: 0 25 * * *"
  }
}
```

### One-Time Job in the Past
```json
{
  "success": false,
  "error": {
    "message": "scheduledTime must be in the future"
  }
}
```

### Starting Executed One-Time Job
```json
{
  "success": false,
  "error": {
    "message": "Cannot start already executed one-time job"
  }
}
```

---

## Best Practices

### Recurring Jobs
1. **Use appropriate intervals** - Don't schedule too frequently (e.g., every second)
2. **Consider server load** - Stagger jobs to avoid all running at once
3. **Add meaningful payloads** - Include context for AI Engine to process
4. **Monitor execution** - Check logs to ensure jobs are running

### One-Time Jobs
1. **Validate timestamps** - Ensure time is in the future
2. **Clean up executed jobs** - Delete old executed one-time jobs periodically
3. **Handle failures** - One-time jobs don't retry automatically
4. **Plan ahead** - Schedule with buffer time for reliability

### Payloads
```json
{
  "payload": {
    "action": "send_whatsapp_message",
    "recipient": "628123456789",
    "message_template": "reminder",
    "data": {
      "event": "Meeting",
      "time": "2 PM"
    }
  }
}
```

---

## Calculating Timestamps

### JavaScript/TypeScript
```javascript
// Current time
const now = Date.now();

// 1 hour from now
const oneHour = Date.now() + (60 * 60 * 1000);

// Specific date/time
const specific = new Date('2025-01-20 14:00:00').getTime();

// Tomorrow at 9 AM
const tomorrow9am = new Date();
tomorrow9am.setDate(tomorrow9am.getDate() + 1);
tomorrow9am.setHours(9, 0, 0, 0);
const timestamp = tomorrow9am.getTime();
```

### Python
```python
import time
from datetime import datetime, timedelta

# Current time
now = int(time.time() * 1000)

# 1 hour from now
one_hour = int((time.time() + 3600) * 1000)

# Specific date/time
specific = int(datetime(2025, 1, 20, 14, 0, 0).timestamp() * 1000)

# Tomorrow at 9 AM
tomorrow = datetime.now() + timedelta(days=1)
tomorrow_9am = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
timestamp = int(tomorrow_9am.timestamp() * 1000)
```

---

## Integration with AI Engine

When a job triggers (recurring or one-time), it publishes an event to Redis Streams (`cronjob:events`). The AI Engine consumes this event and can take actions like:

- Send WhatsApp messages
- Generate reports
- Trigger workflows
- Execute custom logic

**Example AI Engine Handler:**
```typescript
eventConsumer.on('cronjob:trigger', async (event) => {
  const { jobName, payload } = event.data;

  if (payload.action === 'send_whatsapp_message') {
    // Use MCP tool to send WhatsApp message
    await whatsappSendMessage(payload.recipient, payload.message);
  }
});
```
