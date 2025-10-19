# API Documentation

## WhatsApp Service API

Base URL: `http://localhost:3001`

### Health Check

**GET** `/health`

Check service status.

**Response:**
```json
{
  "service": "whatsapp",
  "status": "ready",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### Send Message

**POST** `/api/send-message`

Send a WhatsApp message to a contact or group.

**Request Body:**
```json
{
  "phoneNumber": "628123456789",
  "message": "Hello from ASPRI AI!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "phoneNumber": "628123456789",
    "sent": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "WhatsApp client is not ready"
  }
}
```

---

### Get Messages

**GET** `/api/messages/:phoneNumber`

Get recent messages from a chat.

**Parameters:**
- `phoneNumber` (path): Phone number or chat ID
- `limit` (query, optional): Number of messages (default: 10)

**Example:**
```
GET /api/messages/628123456789?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-id-123",
      "from": "628123456789@c.us",
      "to": "your-number@c.us",
      "body": "Hello!",
      "timestamp": 1705315800000,
      "fromMe": false
    }
  ]
}
```

---

### Get Chats

**GET** `/api/chats`

Get list of recent chats.

**Parameters:**
- `limit` (query, optional): Number of chats (default: 20)

**Example:**
```
GET /api/chats?limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "628123456789@c.us",
      "name": "John Doe",
      "isGroup": false,
      "unreadCount": 2,
      "lastMessage": {
        "body": "Last message text",
        "timestamp": 1705315800000
      }
    }
  ]
}
```

---

### Search Contacts

**GET** `/api/contacts/search`

Search for contacts by name or phone number.

**Parameters:**
- `q` (query, required): Search query

**Example:**
```
GET /api/contacts/search?q=John
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "628123456789@c.us",
      "name": "John Doe",
      "number": "628123456789",
      "isMyContact": true
    }
  ]
}
```

---

## Cronjob Service API

Base URL: `http://localhost:3002`

### Health Check

**GET** `/health`

Check service status.

**Response:**
```json
{
  "service": "cronjob",
  "status": "ready",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "activeJobs": 3
}
```

---

### Create Job

**POST** `/api/jobs`

Create a new scheduled cron job.

**Request Body:**
```json
{
  "name": "Daily Morning Reminder",
  "schedule": "0 9 * * *",
  "enabled": true,
  "payload": {
    "message": "Good morning!",
    "recipients": ["628123456789"]
  }
}
```

**Cron Schedule Examples:**
- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 9 * * *` - Every day at 9 AM
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 1 * *` - First day of every month at midnight

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-job-id",
    "name": "Daily Morning Reminder",
    "schedule": "0 9 * * *",
    "enabled": true,
    "payload": {
      "message": "Good morning!",
      "recipients": ["628123456789"]
    },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### List Jobs

**GET** `/api/jobs`

Get all cron jobs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-job-id",
      "name": "Daily Morning Reminder",
      "schedule": "0 9 * * *",
      "enabled": true,
      "payload": {},
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Job

**GET** `/api/jobs/:jobId`

Get details of a specific job.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-job-id",
    "name": "Daily Morning Reminder",
    "schedule": "0 9 * * *",
    "enabled": true,
    "payload": {},
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### Update Job

**PATCH** `/api/jobs/:jobId`

Update an existing job.

**Request Body (all fields optional):**
```json
{
  "name": "Updated Job Name",
  "schedule": "0 10 * * *",
  "enabled": false,
  "payload": {
    "newData": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-job-id",
    "name": "Updated Job Name",
    "schedule": "0 10 * * *",
    "enabled": false,
    "payload": {},
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

### Delete Job

**DELETE** `/api/jobs/:jobId`

Delete a cron job.

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

### Start Job

**POST** `/api/jobs/:jobId/start`

Enable/start a cron job.

**Response:**
```json
{
  "success": true,
  "data": {
    "started": true
  }
}
```

---

### Stop Job

**POST** `/api/jobs/:jobId/stop`

Disable/stop a cron job.

**Response:**
```json
{
  "success": true,
  "data": {
    "stopped": true
  }
}
```

---

## MCP Tools (for AI Agent)

### WhatsApp Tools

#### whatsapp_send_message

Send a WhatsApp message.

**Parameters:**
```json
{
  "phoneNumber": "628123456789",
  "message": "Hello from AI!"
}
```

---

#### whatsapp_get_messages

Get recent messages from a chat.

**Parameters:**
```json
{
  "phoneNumber": "628123456789",
  "limit": 10
}
```

---

#### whatsapp_get_chats

Get list of recent chats.

**Parameters:**
```json
{
  "limit": 20
}
```

---

#### whatsapp_search_contacts

Search for contacts.

**Parameters:**
```json
{
  "query": "John"
}
```

---

### Cronjob Tools

#### cronjob_create

Create a new cron job.

**Parameters:**
```json
{
  "name": "Daily Reminder",
  "schedule": "0 9 * * *",
  "enabled": true,
  "payload": {}
}
```

---

#### cronjob_list

Get all cron jobs.

**Parameters:** None

---

#### cronjob_get

Get specific job details.

**Parameters:**
```json
{
  "jobId": "uuid-job-id"
}
```

---

#### cronjob_update

Update a cron job.

**Parameters:**
```json
{
  "jobId": "uuid-job-id",
  "name": "Updated Name",
  "schedule": "0 10 * * *"
}
```

---

#### cronjob_delete

Delete a cron job.

**Parameters:**
```json
{
  "jobId": "uuid-job-id"
}
```

---

#### cronjob_start

Start/enable a job.

**Parameters:**
```json
{
  "jobId": "uuid-job-id"
}
```

---

#### cronjob_stop

Stop/disable a job.

**Parameters:**
```json
{
  "jobId": "uuid-job-id"
}
```

---

## Error Responses

All APIs follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "message": "Detailed error message",
    "code": "ERROR_CODE"
  }
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limits

**WhatsApp Service:**
- WhatsApp enforces its own rate limits (~10 messages/sec)
- Exceeding limits may result in temporary ban

**Cronjob Service:**
- No enforced rate limits
- Recommended max: 100 active jobs per instance

---

## Examples with curl

### Send WhatsApp Message
```bash
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "628123456789", "message": "Hello!"}'
```

### Create Cron Job
```bash
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Reminder",
    "schedule": "0 9 * * *",
    "enabled": true
  }'
```

### Get Chats
```bash
curl http://localhost:3001/api/chats?limit=10
```

### Stop Cron Job
```bash
curl -X POST http://localhost:3002/api/jobs/uuid-job-id/stop
```
