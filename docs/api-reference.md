# 📊 Libera API Reference

## 🌟 API Overview

The Libera API provides comprehensive access to the Justice Safeguard Assistant system, enabling developers to integrate evidence analysis, case management, and audit capabilities into their applications.

---

## 🔐 Authentication

### Base URL
```
https://api.libera-justice.org
```

### Authentication Header
```
Authorization: Bearer <your_jwt_token>
```

### Getting an Access Token
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "counsel",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## 📋 Cases

### List Cases
```http
GET /api/cases
Authorization: Bearer <token>
```

**Response:**
```json
{
  "cases": [
    {
      "id": "uuid",
      "case_number": "2025-CR-001",
      "subject_id": "uuid",
      "counsel_id": "uuid",
      "status": "active",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Get Case Details
```http
GET /api/cases/{case_id}
Authorization: Bearer <token>
```

### Create New Case
```http
POST /api/cases
Authorization: Bearer <token>
Content-Type: application/json

{
  "case_number": "2025-CR-001",
  "subject_name": "John Smith",
  "subject_contact": "john.smith@email.com"
}
```

### Update Case Status
```http
PUT /api/cases/{case_id}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "closed"
}
```

---

## 📁 Evidence Management

### Upload Evidence
```http
POST /api/cases/{case_id}/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file_data>
```

**Response:**
```json
{
  "upload": {
    "id": "uuid",
    "filename": "evidence.jpg",
    "type": "image",
    "size": 1024000
  },
  "evidence": {
    "id": "uuid",
    "type": "photo",
    "timestamp": "2025-01-01T12:00:00Z"
  }
}
```

### List Case Evidence
```http
GET /api/cases/{case_id}/evidence
Authorization: Bearer <token>
```

### Search Evidence
```http
GET /api/cases/{case_id}/evidence/search?q=keyword
Authorization: Bearer <token>
```

### Get Evidence Timeline
```http
GET /api/cases/{case_id}/timeline
Authorization: Bearer <token>
```

---

## 🚨 Alerts

### List Case Alerts
```http
GET /api/alerts/case/{case_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "rule_id": "R-001",
      "severity": "high",
      "explanation": "Evidence timestamp outside warrant window",
      "evidence_refs": ["evidence-uuid"],
      "status": "pending",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Acknowledge Alert
```http
PUT /api/alerts/{alert_id}/acknowledge
Authorization: Bearer <token>
Content-Type: application/json

{
  "resolution_notes": "Alert reviewed and documented"
}
```

### Resolve Alert
```http
PUT /api/alerts/{alert_id}/resolve
Authorization: Bearer <token>
Content-Type: application/json

{
  "resolution_notes": "Motion to suppress filed"
}
```

### Export Case Alerts
```http
GET /api/alerts/case/{case_id}/export
Authorization: Bearer <token>
```

---

## 📜 Audit Log

### Get Recent Activity
```http
GET /api/audit/recent?limit=50
Authorization: Bearer <token>
```

### Get User Activity
```http
GET /api/audit/user/{user_id}?limit=100
Authorization: Bearer <token>
```

### Get Target Activity
```http
GET /api/audit/target/{target_type}/{target_id}?limit=50
Authorization: Bearer <token>
```

### Export Audit Data
```http
GET /api/audit/export?start_date=2025-01-01&end_date=2025-01-31
Authorization: Bearer <token>
```

---

## 👤 User Management

### Get User Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Update Password
```http
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "old_password",
  "new_password": "new_password"
}
```

### User Roles
- `counsel`: Full case management and evidence analysis
- `advocate`: Limited case access and viewing
- `auditor`: Read-only system access for compliance
- `admin`: Full system administration capabilities

---

## 📊 Error Handling

### Standard Error Response
```json
{
  "error": {
    "message": "Descriptive error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

---

## 🔧 Rate Limiting

### Limits
- **Authentication endpoints**: 5 requests per minute
- **Case management**: 100 requests per minute
- **File uploads**: 10 uploads per minute
- **Audit endpoints**: 50 requests per minute

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## 📋 Data Formats

### Evidence Types
- `document`: PDF, DOC, DOCX, TXT
- `photo`: JPEG, PNG, GIF, WebP
- `video`: MP4, AVI, MOV
- `audio`: MP3, WAV
- `physical_item`: Physical evidence with chain of custody
- `witness_statement`: Interview transcripts and affidavits

### Timestamp Format
All timestamps use ISO 8601 format:
```json
"timestamp": "2025-01-01T12:00:00Z"
```

### Location Format
Geographic data structure:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "123 Main St, New York, NY",
  "description": "Collection site"
}
```

---

## 🔍 Filtering & Pagination

### Query Parameters
- `limit`: Number of results per page (default: 20, max: 100)
- `offset`: Number of results to skip (default: 0)
- `sort`: Sort field (e.g., "created_at", "updated_at")
- `order`: Sort order ("asc" or "desc")

### Example
```http
GET /api/cases?limit=10&offset=20&sort=created_at&order=desc
```

---

## 🧪 Testing the API

### Postman Collection
Download our Postman collection for easy API testing:
[Libera API Collection](https://api.libera-justice.org/postman-collection.json)

### cURL Examples
```bash
# Login
curl -X POST https://api.libera-justice.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get cases
curl -X GET https://api.libera-justice.org/api/cases \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 API Status & Monitoring

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "version": "1.0.0",
  "service": "libera-api"
}
```

### API Status Page
Check real-time API status: [status.libera-justice.org](https://status.libera-justice.org)

---

## 🤝 API Support

### Getting Help
- **Documentation**: [docs.libera-justice.org](https://docs.libera-justice.org)
- **Support Email**: api-support@libera-justice.org
- **Developer Forum**: [community.libera-justice.org](https://community.libera-justice.org)

### Report Issues
- **GitHub Issues**: [github.com/MKWorldWide/Libera/issues](https://github.com/MKWorldWide/Libera/issues)
- **Security Issues**: security@libera-justice.org

---

## 📋 Version History

### v1.0.0 (Current)
- Complete case management API
- Evidence upload and analysis
- Alert system with acknowledgment
- Audit logging and compliance
- User authentication and authorization

### Upcoming Features
- Advanced evidence linking
- Bulk operations
- Webhook notifications
- Enhanced search capabilities

---

**Built with ❤️ by Athena - Moon, Oracle, Wife, Mommy** 🌙

*The API is the bridge between justice and technology—use it wisely.*
