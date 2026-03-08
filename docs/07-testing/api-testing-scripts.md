# API Testing Scripts

**Navigation**: [Home](../INDEX.md) > [Testing](./README.md) > API Testing

**Status**: 🚧 In Development | **Last Updated**: 2026-03-08

Documentation of the API testing approach, available tools, and manual testing examples for TenPennyNovels.

---

## Overview

**Current state**: Limited test coverage. The project has Jest and Playwright configured, but automated API test suites are not yet comprehensive. Manual testing via `curl` is the primary approach for validating endpoints.

---

## Testing Tools

| Tool | Where | Purpose |
|------|-------|---------|
| **Jest** | `apps/game`, `apps/documents`, `apps/management` | Unit and component tests |
| **Playwright** | `apps/game` | End-to-end (e2e) tests |
| **curl** | Manual | API endpoint validation |

### Jest Configuration

```bash
# Run tests in game app
cd apps/game && npm test

# Run tests in documents app
cd apps/documents && npm test

# Run tests in management app
cd apps/management && npm test

# CI mode (e.g., documents)
cd apps/documents && npm run test:ci
```

### Playwright (E2E)

```bash
cd apps/game
npm run test:e2e
```

---

## Health Check Endpoints

Verify services are running before testing:

| Service | Port | Endpoint | Example |
|---------|------|----------|---------|
| **API Gateway** | 8000 | `GET /health` | `curl http://localhost:8000/health` |
| **Unified Backend** | 3001 | `GET /health` | `curl http://localhost:3001/health` |

```bash
# API Gateway (public entry point)
curl http://localhost:8000/health

# Unified Backend (internal)
curl http://localhost:3001/health
```

---

## Manual Testing with curl

Base URL: `http://localhost:8000` (via API Gateway) or `http://localhost:3001` (direct to backend).

### Auth Flow

#### 1. Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

Response includes `accessToken` and `refreshToken`. Save the `accessToken` for subsequent requests.

#### 2. Token Refresh

```bash
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN" \
  -d '{}'
```

#### 3. Get Session (authenticated)

```bash
curl -X GET http://localhost:8000/auth/session \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### Character Creation

```bash
# Get occupations (needed for character creation)
curl -X GET http://localhost:8000/auth/occupations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Create character (simplified payload)
curl -X POST http://localhost:8000/game/characters/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Character",
    "surname": "Smith",
    "occupationId": "OCCUPATION_ID",
    "gender": "male",
    "age": 30
  }'
```

---

### Location Browsing

```bash
# List accessible locations
curl -X GET http://localhost:8000/game/locations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get location details
curl -X GET http://localhost:8000/game/locations/LOCATION_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Enter location
curl -X POST http://localhost:8000/game/locations/LOCATION_ID/enter \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Document Search

```bash
# Semantic search (requires query param)
curl -X GET "http://localhost:8000/documents/semantic-search?q=medicina+vittoriana&type=ambientazione" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# List documents
curl -X GET http://localhost:8000/documents/routes/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Testing Checklist

| Area | Endpoints | Notes |
|------|-----------|-------|
| **Auth** | login, refresh, session, logout | JWT + cookie flow |
| **Characters** | create, my, :id, submit | Requires occupationId |
| **Locations** | list, :id, enter, leave | Requires selected character |
| **Documents** | list, semantic-search, ask | Search uses Qdrant + ElasticSearch |
| **Messages** | send, inbox, sent | Direct messaging |
| **Chats** | POST /chats, GET /chats/:locationId | Location chat |

---

## Future Plans

- **Increase coverage**: Add integration tests for critical API flows
- **Automated scripts**: Bash or Node.js scripts for regression testing
- **API contract tests**: Validate request/response schemas
- **Load testing**: Stress test key endpoints (auth, search, chat)

---

## Related Documentation

- [API Reference](../02-backend/api-reference.md) - Complete endpoint list
- [Testing Strategy](./README.md) - Testing overview
- [Character Wizard Testing](./wizard-testing-guide.md) - UI testing guide
- [Authentication System](../02-backend/authentication-system.md) - JWT and cookie flow
