# Docker Troubleshooting Guide

This guide covers common Docker-related issues and their solutions for TenPennyNovels development.

## Common Issues and Solutions

### Error: "service depends on undefined service"

**Symptom:**
```
ERROR: Service 'tenpennynovels-game-backend' depends on service 'tenpennynovels-mongodb'
which is undefined.
```

**Cause:**
Backend services require infrastructure (MongoDB/Redis) to be running first. The infrastructure and backend services are defined in separate Docker Compose files.

**Solution:**

**Option 1: Use the all-in-one command (recommended)**
```bash
npm run docker:all:start
```
This automatically starts infrastructure first, then backends.

**Option 2: Start services separately**
```bash
# 1. Start infrastructure
npm run docker:infra:start

# 2. Wait for health checks (30 seconds)
sleep 30

# 3. Verify infrastructure is ready
npm run docker:check

# 4. Start backends
npm run docker:backends:start
```

**Check infrastructure status anytime:**
```bash
npm run docker:check
```

---

### Backend Connection Errors on Startup

**Symptom:**
Backends log MongoDB or Redis connection errors when starting:
```
MongoServerSelectionError: connect ECONNREFUSED
Error: Redis connection failed
```

**Cause:**
Infrastructure services are still performing health checks and aren't ready yet.

**Is this normal?**
✅ **Yes!** This is expected behavior during startup. The backends have automatic retry logic:
- **MongoDB:** Retries connection for 10 seconds with automatic reconnection
- **Redis:** Exponential backoff reconnection (up to 1000ms intervals)

**What to do:**
- **Do nothing** - Services will automatically connect within 30-60 seconds
- Monitor progress: `npm run docker:logs:game`
- Verify infrastructure health: `npm run docker:check`

**When to worry:**
- If errors persist for more than 2 minutes
- If `npm run docker:check` shows services as unhealthy

---

### Network Issues

**Symptom:**
Services can't communicate despite all containers running:
```
Error: connect ECONNREFUSED host.docker.internal:3000
getaddrinfo ENOTFOUND tenpennynovels-mongodb
```

**Check network:**
```bash
# List networks
docker network ls | grep tenpennynovels

# Inspect network details
docker network inspect tenpennynovels_network
```

**Solution: Recreate the network**
```bash
# 1. Stop all services
npm run docker:all:stop

# 2. Remove the network (if it exists)
docker network rm tenpennynovels_network

# 3. Start fresh
npm run docker:all:start
```

The infrastructure services will automatically recreate the network with correct configuration.

---

### Container Keeps Restarting

**Symptom:**
```bash
docker ps
# Shows container with "Restarting (1) X seconds ago"
```

**Diagnosis:**
```bash
# Check logs for the failing service
npm run docker:logs:game

# Or for any service:
docker logs tenpennynovels-game-backend
```

**Common causes:**
1. **Database connection failure** - Infrastructure not running
2. **Port conflict** - Another process using the same port
3. **Environment variable missing** - Check .env file
4. **Build error** - Rebuild the image

**Solutions:**

**For database issues:**
```bash
npm run docker:check  # Verify infrastructure
```

**For port conflicts:**
```bash
# Find process using port 3001 (example for game-backend)
lsof -i :3001
kill -9 <PID>
```

**For build issues:**
```bash
./docker-backends.sh rebuild
```

---

### Infrastructure Services Won't Start

**Symptom:**
MongoDB or Redis containers fail to start or remain unhealthy.

**Check infrastructure logs:**
```bash
docker-compose -f docker-compose.infrastructure.yml logs mongodb
docker-compose -f docker-compose.infrastructure.yml logs redis
```

**Common causes:**
1. **Port already in use** (27017 for MongoDB, 6379 for Redis)
2. **Volume permissions issues**
3. **Corrupted data volumes**

**Solutions:**

**Check for port conflicts:**
```bash
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis
```

**Reset infrastructure (⚠️ destroys data):**
```bash
# Stop infrastructure
npm run docker:infra:stop

# Remove volumes
docker volume rm tenpennynovels_mongodb_data
docker volume rm tenpennynovels_redis_data

# Start fresh
npm run docker:infra:start
```

---

### "Hot Reload" Not Working

**Symptom:**
Code changes don't trigger service restart in Docker.

**Check volume mounts:**
```bash
docker inspect tenpennynovels-game-backend | grep -A 10 Mounts
```

**Solution:**
Volume mounts are configured in `docker-compose.backends.yml`. The issue is usually:

1. **File not in mounted directory** - Only these directories auto-reload:
   - `services/*/src/` (source code)
   - `services/shared/` (shared utilities)
   - `services/database/` (database models)

2. **tsx watch not running** - Check logs:
   ```bash
   npm run docker:logs:game
   # Should show: "File change detected. Restarting..."
   ```

3. **Docker VM file watching disabled** - On Mac/Windows, ensure Docker Desktop has file sharing enabled for project directory

---

### Services Not Found in docker-compose.backends.yml

**Symptom:**
```
ERROR: The Compose file is invalid because:
Service X is invalid: DependsOn contains an undefined service
```

**Cause:**
After recent updates, cross-file service dependencies were removed from `docker-compose.backends.yml`.

**Solution:**
This error should not occur after the fix. If you see it:
1. Ensure you have the latest version of `docker-compose.backends.yml`
2. Backend services should NOT have `depends_on` clauses referencing MongoDB or Redis
3. Only API Gateway should have `depends_on` for other backend services

**Verify your docker-compose.backends.yml:**
```bash
grep -A 3 "depends_on:" docker-compose.backends.yml
```

Should only show API Gateway dependencies on backends, not MongoDB/Redis.

---

## Best Practices

### ✅ DO:
- Always use `npm run docker:all:start` for initial setup
- Use `npm run docker:check` before manually starting backends
- Wait 30-60 seconds after starting infrastructure before starting backends
- Check logs with `npm run docker:logs:<service>` when troubleshooting
- Use `./docker-backends.sh status` to verify all services are running

### ❌ DON'T:
- Run `npm run docker:backends:start` without infrastructure running first
- Force-stop containers with `docker kill` (use proper shutdown commands)
- Modify docker-compose files without understanding service dependencies
- Delete volumes without backing up data first

---

## Quick Reference

### Health Check Commands
```bash
npm run docker:check           # Check infrastructure health
npm run docker:status          # Check all service status
docker ps                      # List running containers
```

### Start/Stop Commands
```bash
npm run docker:all:start       # Start everything (recommended)
npm run docker:all:stop        # Stop everything
npm run docker:infra:start     # Start infrastructure only
npm run docker:backends:start  # Start backends (requires infrastructure)
```

### Debugging Commands
```bash
npm run docker:logs            # All backend logs
npm run docker:logs:game       # Game backend logs
docker logs <container-name>   # Specific container logs
docker exec -it <container> sh # Enter container shell
```

### Reset Commands
```bash
npm run docker:restart         # Restart all services
./docker-backends.sh rebuild   # Rebuild all images
docker system prune -a         # Clean up everything (⚠️ destroys all data)
```

---

## Getting Help

If you're still experiencing issues:

1. **Check service logs:** `npm run docker:logs:<service>`
2. **Verify infrastructure:** `npm run docker:check`
3. **Check container status:** `docker ps -a`
4. **Review environment variables:** Ensure `.env` file is properly configured
5. **Try clean restart:** `npm run docker:all:stop && npm run docker:all:start`

For persistent issues, check:
- Docker Desktop has sufficient resources (4GB+ RAM recommended)
- No other services are using required ports (3000-3002, 8000, 8080, 27017, 6379)
- Project directory has proper permissions
- Docker Desktop is up to date
