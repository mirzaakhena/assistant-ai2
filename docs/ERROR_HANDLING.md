# Error Handling & Debugging Guide

## Improved Error Logging

Semua error sekarang di-log dengan detail lengkap untuk memudahkan debugging.

## Error Log Format

### Before (Tidak Jelas)
```json
{
  "level": 50,
  "service": "cronjob-api",
  "error": {},
  "msg": "Error creating job"
}
```
❌ Error object kosong, tidak ada informasi!

### After (Jelas & Detail)
```json
{
  "level": 50,
  "service": "cronjob-api",
  "message": "Invalid cron expression: 0 25 * * *",
  "name": "Error",
  "stack": "Error: Invalid cron expression...\n    at CronScheduler.createJob...",
  "requestBody": {
    "name": "Test Job",
    "type": "recurring",
    "schedule": "0 25 * * *"
  },
  "msg": "Error creating job"
}
```
✅ Lengkap dengan error message, stack trace, dan request data!

---

## Cronjob API Error Examples

### 1. Missing Required Fields

**Request:**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "recurring",
    "schedule": "0 9 * * *"
  }'
```

**Log Output:**
```json
{
  "level": 40,
  "service": "cronjob-api",
  "requestBody": {
    "type": "recurring",
    "schedule": "0 9 * * *"
  },
  "msg": "Validation failed: name is required"
}
```

**HTTP Response:**
```json
{
  "success": false,
  "error": {
    "message": "name is required"
  }
}
```

---

### 2. Invalid Job Type

**Request:**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "invalid-type"
  }'
```

**Log Output:**
```json
{
  "level": 40,
  "service": "cronjob-api",
  "requestBody": {
    "name": "Test",
    "type": "invalid-type"
  },
  "type": "invalid-type",
  "msg": "Validation failed: invalid type"
}
```

**HTTP Response:**
```json
{
  "success": false,
  "error": {
    "message": "type must be either \"recurring\" or \"one-time\""
  }
}
```

---

### 3. Invalid Cron Expression

**Request:**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "recurring",
    "schedule": "0 25 * * *"
  }'
```

**Log Output:**
```json
{
  "level": 50,
  "service": "cronjob-api",
  "message": "Invalid cron expression: 0 25 * * *",
  "name": "Error",
  "stack": "Error: Invalid cron expression: 0 25 * * *\n    at CronScheduler.createJob (/path/to/cron-scheduler.ts:48:13)",
  "requestBody": {
    "name": "Test",
    "type": "recurring",
    "schedule": "0 25 * * *"
  },
  "msg": "Error creating job"
}
```

**HTTP Response:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid cron expression: 0 25 * * *",
    "code": "Error"
  }
}
```

---

### 4. One-Time Job in the Past

**Request:**
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Past Job",
    "type": "one-time",
    "scheduledTime": 1000000000000
  }'
```

**Log Output:**
```json
{
  "level": 50,
  "service": "cronjob-api",
  "message": "scheduledTime must be in the future",
  "name": "Error",
  "stack": "Error: scheduledTime must be in the future\n    at CronScheduler.createJob...",
  "requestBody": {
    "name": "Past Job",
    "type": "one-time",
    "scheduledTime": 1000000000000
  },
  "msg": "Error creating job"
}
```

---

### 5. Job Not Found

**Request:**
```bash
curl http://localhost:3002/api/jobs/invalid-job-id
```

**Log Output:**
```json
{
  "level": 40,
  "service": "cronjob-api",
  "jobId": "invalid-job-id",
  "msg": "Job not found"
}
```

**HTTP Response:**
```json
{
  "success": false,
  "error": {
    "message": "Job not found"
  }
}
```

---

### 6. Cannot Change Job Type

**Request:**
```bash
curl -X PATCH http://localhost:3002/api/jobs/some-job-id \
  -H "Content-Type: application/json" \
  -d '{
    "type": "one-time"
  }'
```

**Log Output:**
```json
{
  "level": 40,
  "service": "cronjob-api",
  "jobId": "some-job-id",
  "updates": {
    "type": "one-time"
  },
  "msg": "Validation failed: cannot change job type"
}
```

---

## Success Logs

### Job Created Successfully

```json
{
  "level": 30,
  "service": "cronjob-api",
  "jobId": "uuid-123",
  "name": "Daily Reminder",
  "type": "recurring",
  "msg": "Job created successfully"
}
```

### Job Updated Successfully

```json
{
  "level": 30,
  "service": "cronjob-api",
  "jobId": "uuid-123",
  "updates": {
    "schedule": "0 10 * * *"
  },
  "msg": "Job updated successfully"
}
```

---

## Debugging Tips

### 1. Check Request Data

Semua error log sekarang include `requestBody`, sehingga kamu bisa lihat exactly apa yang dikirim:

```bash
npm run start:cronjob 2>&1 | grep "requestBody"
```

### 2. View Full Stack Trace

Untuk melihat detail error:

```bash
npm run start:cronjob 2>&1 | grep -A 10 "Error creating job"
```

**Output:**
```json
{
  "message": "Invalid cron expression: 0 25 * * *",
  "name": "Error",
  "stack": "Error: Invalid cron expression: 0 25 * * *
    at CronScheduler.createJob (/path/to/cron-scheduler.ts:48:13)
    at router.post (/path/to/api.ts:52:32)",
  "requestBody": {...}
}
```

### 3. Filter by Error Type

```bash
# Only validation errors (warn level)
npm run start:cronjob 2>&1 | grep '"level":40'

# Only system errors (error level)
npm run start:cronjob 2>&1 | grep '"level":50'
```

### 4. Monitor Specific Operations

```bash
# Watch job creation
npm run start:cronjob 2>&1 | grep "job request received"

# Watch validation failures
npm run start:cronjob 2>&1 | grep "Validation failed"
```

---

## Common Errors & Solutions

### Invalid Cron Expression

**Error:**
```
Invalid cron expression: 0 25 * * *
```

**Problem:** Hour value `25` is invalid (valid: 0-23)

**Solution:**
```bash
# Correct
"schedule": "0 9 * * *"   # 9 AM
```

**Reference:**
- Minute: 0-59
- Hour: 0-23
- Day of month: 1-31
- Month: 1-12
- Day of week: 0-7 (0 and 7 are Sunday)

---

### scheduledTime in the Past

**Error:**
```
scheduledTime must be in the future
```

**Problem:** Timestamp sudah lewat

**Solution:**
```javascript
// Calculate future timestamp
const futureTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

fetch('http://localhost:3002/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Future Job',
    type: 'one-time',
    scheduledTime: futureTime
  })
});
```

---

### Missing Required Fields

**Error:**
```
name is required
```

**Solution:** Ensure all required fields present:

**Recurring job:**
```json
{
  "name": "Job Name",
  "type": "recurring",
  "schedule": "0 9 * * *"
}
```

**One-time job:**
```json
{
  "name": "Job Name",
  "type": "one-time",
  "scheduledTime": 1705315800000
}
```

---

## Enable Debug Logging

For detailed request/response logs:

```bash
LOG_LEVEL=debug npm run start:cronjob
```

**Output includes:**
```json
{
  "level": 20,
  "service": "cronjob-api",
  "requestBody": {...},
  "msg": "Create job request received"
}
```

---

## HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET/DELETE |
| 201 | Created | Job created |
| 400 | Bad Request | Validation error |
| 404 | Not Found | Job not found |
| 500 | Server Error | System error |

---

## Best Practices

### 1. Always Check Logs First

Before debugging, check logs:
```bash
npm run start:cronjob 2>&1 | tail -50
```

### 2. Use Validation Logs

Validation failures logged as `warn` level with full context:
```json
{
  "level": 40,
  "requestBody": {...},
  "msg": "Validation failed: ..."
}
```

### 3. Include Context in Requests

Add descriptive names to jobs for easier debugging:
```json
{
  "name": "Daily-Report-9AM-Production",
  "type": "recurring",
  "schedule": "0 9 * * *"
}
```

### 4. Monitor Error Patterns

```bash
# Count error types
npm run start:cronjob 2>&1 | grep "Error" | sort | uniq -c
```

---

## Testing Error Scenarios

### Test Invalid Cron
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "recurring",
    "schedule": "invalid"
  }' | jq
```

### Test Past Timestamp
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "one-time",
    "scheduledTime": 1000000000000
  }' | jq
```

### Test Missing Fields
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

---

## Log Retention

### Development
Logs printed to console, not persisted.

### Production (PM2)
```bash
# View logs
pm2 logs cronjob-service

# Save to file
pm2 logs cronjob-service > errors-$(date +%Y%m%d).log

# Rotate logs
pm2 install pm2-logrotate
```

### Production (Docker)
```bash
# View logs
docker logs aspri-cronjob

# Save to file
docker logs aspri-cronjob > errors-$(date +%Y%m%d).log
```

---

## Getting Help

If error persists:

1. **Check logs** with full context
2. **Verify request** format matches examples
3. **Test** with curl examples from docs
4. **Review** CRONJOB_API_EXAMPLES.md for correct usage
