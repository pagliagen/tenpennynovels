# Monitoring

**Navigation**: [Home](../INDEX.md) > [Operations](./README.md) > Monitoring

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-08

Monitoraggio dei servizi TenPennyNovels in produzione su OVH VPS con PM2.

---

## Health Check Endpoints

| Servizio | Endpoint | Risposta OK |
|----------|----------|-------------|
| API Gateway | `https://api.tenpennynovels.com/health` | `{"status":"ok"}` |
| Unified Backend | `https://ws.tenpennynovels.com/health` | `{"status":"ok","mongodb":"connected","redis":"connected"}` |
| Embeddings Worker | `http://127.0.0.1:5001/health` (solo locale) | `{"status":"healthy","model":"...","dimension":384}` |
| Qdrant | `http://127.0.0.1:6333/healthz` (solo locale) | `{"status":"ok"}` |
| ElasticSearch | `http://127.0.0.1:9200/_cluster/health` (solo locale) | `{"status":"green"}` o `{"status":"yellow"}` |

### Script Health Check

```bash
#!/bin/bash
ENDPOINTS=(
  "https://api.tenpennynovels.com/health"
  "https://ws.tenpennynovels.com/health"
)

for url in "${ENDPOINTS[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
  if [ "$response" -eq 200 ]; then
    echo "OK: $url ($response)"
  else
    echo "FAIL: $url ($response)"
  fi
done
```

---

## PM2 Monitoring

```bash
# Stato di tutti i processi
pm2 status

# Monitoraggio real-time (CPU, memoria, logs)
pm2 monit

# Info dettagliata su un processo
pm2 describe tenpennynovels-unified-backend

# Uso risorse di tutti i processi
pm2 list
```

### Log Management

```bash
# Log in tempo reale (tutti i processi)
pm2 logs

# Log di un servizio specifico
pm2 logs tenpennynovels-game --lines 100

# Solo errori
pm2 logs --err

# Log con timestamp
pm2 logs --timestamp
```

### Log Rotation

```bash
# Installare il modulo di log rotation
pm2 install pm2-logrotate

# Configurare
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## Nginx Logs

```bash
# Access log API
sudo tail -f /var/log/nginx/api-tenpennynovels-access.log

# Error log API
sudo tail -f /var/log/nginx/api-tenpennynovels-error.log

# Error log WebSocket
sudo tail -f /var/log/nginx/ws-tenpennynovels-error.log

# Error log generale
sudo tail -f /var/log/nginx/error.log
```

---

## Metriche da Monitorare

### Processi PM2

| Metrica | Soglia Allarme | Comando |
|---------|---------------|---------|
| Status | != "online" | `pm2 status` |
| Restarts | > 5 in 1h | `pm2 describe <name>` |
| Memory | > 1GB (backend), > 512MB (frontend) | `pm2 list` |
| CPU | > 80% sostenuto | `pm2 monit` |
| Uptime | < 1 minuto (crash loop) | `pm2 status` |

### Database

```bash
# MongoDB: connessioni attive e stato
mongosh --eval "db.serverStatus().connections"

# Redis: info e memoria
redis-cli INFO memory
redis-cli INFO clients

# Qdrant: collezioni e stato
curl http://127.0.0.1:6333/collections

# ElasticSearch: salute cluster
curl http://127.0.0.1:9200/_cluster/health?pretty
```

### Sistema

```bash
# Uso disco
df -h

# Uso memoria
free -h

# Processi Node attivi
ps aux | grep node | grep -v grep

# Porte in ascolto
sudo netstat -tulpn | grep -E '(4000|4001|4003|4004|8000|3001|5001)'
```

---

## Alerting (Opzionale)

### Cron Job per Health Check

```bash
# Aggiungere a crontab: crontab -e
# Check ogni 5 minuti
*/5 * * * * curl -sf https://api.tenpennynovels.com/health > /dev/null || echo "API Gateway DOWN" | mail -s "TPN Alert" admin@tenpennynovels.com
```

---

## Related Documentation

- [Deployment Guide](./deployment-guide.md) - Setup e deploy
- [Backup & Restore](./backup-restore.md) - Backup database
- [Docker Troubleshooting](./docker-troubleshooting.md) - Problemi dev locale
