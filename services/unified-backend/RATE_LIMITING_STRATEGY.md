# Rate Limiting Strategy

## Architecture Overview

TenPenny Novels implements a **two-tier rate limiting strategy**:

### Tier 1: API Gateway (External Traffic)
**File**: `services/api-gateway/src/app.ts`

All external requests are rate-limited at the API Gateway level:
- **Unauthenticated** (documents, public endpoints): 30 req/min per IP
- **Authenticated** (game, admin): 120+ req/min per user

This is the **primary line of defense** for all external traffic.

### Tier 2: Backend Endpoints (Critical Write Operations)
**Location**: `services/unified-backend/src/modules/*/routes/`

Selective rate limiting on critical endpoints that modify data:
- **POST endpoints** (create data): 20-30 req/min per user
- **DELETE endpoints** (destroy data): 20-30 req/min per user
- **PUT/PATCH** (update data): 30-60 req/min per user
- **GET endpoints** (read-only): Managed by API Gateway only

## Rationale

### Why Backend Rate Limiting for Write Ops?

1. **Defense in Depth**: Multiple layers of rate limiting provide better protection
2. **DoS Mitigation**: Prevents abuse of compute-intensive operations (sending messages, deleting)
3. **Database Protection**: Shields database from spam/flood attacks
4. **User Experience**: Prevents accidental client loops from overwhelming the server

### Why NOT on GET Endpoints?

1. **API Gateway handles it**: All GET requests are already limited at gateway
2. **Read operations are cheap**: No database writes, minimal server load
3. **Avoid double-limiting**: Two rate limits on same request = poor UX
4. **Caching friendly**: GET requests often cached or CDN-served

## Implementation Details

### express-rate-limit Configuration

All backend rate limiters use:
- **keyGenerator**: `req.user?.userId || req.ip` (prioritize authenticated user)
- **skip**: Skip if user not authenticated (public endpoints)
- **windowMs**: 60 seconds
- **handler**: Custom JSON response with `429 Too Many Requests`

### Response Format

```json
{
  "result": false,
  "error": "Troppe richieste. Aspetta un momento prima di inviare altri messaggi.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Current Implementation Status

### Routes with Backend Rate Limiting
- ✅ `game/routes/onGameMessages.ts` - Send/delete in-game messages
- ✅ `game/routes/offGameMessages.ts` - Send/delete OOC messages, typing indicators

### Routes Using Gateway Rate Limiting Only
- ℹ️ All GET endpoints (list, search, fetch)
- ℹ️ All authenticated endpoints already behind API Gateway limits
- ℹ️ Admin routes (inherent low-volume due to admin-only access)

## Monitoring

Monitor rate limiting effectiveness:
```bash
# Check API Gateway rate limit logs
grep "rate-limit\|429" /var/log/api-gateway.log

# Monitor backend rate limiting
grep "RATE_LIMIT_EXCEEDED" services/unified-backend/logs/*.log
```

## Adjusting Limits

To increase/decrease rate limits:
1. Edit `services/unified-backend/src/modules/*/routes/*.ts`
2. Modify `max: <number>` in rate limiter configuration
3. Test with `/verify` endpoint
4. Deploy via CI/CD

## Related Documentation

- [API Gateway Rate Limiting](../../services/api-gateway/docs/rate-limiting.md)
- [Security Best Practices](../../SECURITY.md)
- [Performance Guidelines](../services/README.md#performance)
