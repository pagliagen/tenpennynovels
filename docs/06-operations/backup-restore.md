# Backup & Restore

**Navigation**: [Home](../INDEX.md) > [Operations](./README.md) > Backup & Restore

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-08

Procedure di backup e restore per i database di TenPennyNovels in produzione.

---

## Database Produzione

**Nome DB MongoDB**: `tenpennynovels` (NON `tenpennynovels-prod`)

---

## MongoDB Backup

### Backup Manuale

```bash
# Dump completo del database
mongodump --db tenpennynovels --out ~/backups/mongodb-$(date +%Y%m%d)

# Comprimere
tar -czf ~/backups/mongodb-$(date +%Y%m%d).tar.gz -C ~/backups mongodb-$(date +%Y%m%d)
rm -rf ~/backups/mongodb-$(date +%Y%m%d)
```

### Backup Automatico (Cron)

```bash
#!/bin/bash
# /home/ubuntu/scripts/backup-mongodb.sh

BACKUP_DIR="$HOME/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump e comprimi
mongodump --db tenpennynovels --out "/tmp/mongodump-$DATE"
tar -czf "$BACKUP_DIR/tenpennynovels-$DATE.tar.gz" -C /tmp "mongodump-$DATE"
rm -rf "/tmp/mongodump-$DATE"

# Rimuovi backup vecchi
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: tenpennynovels-$DATE.tar.gz"
```

```bash
# Aggiungere al crontab (backup giornaliero alle 3:00)
crontab -e
0 3 * * * /home/ubuntu/scripts/backup-mongodb.sh >> /home/ubuntu/logs/backup.log 2>&1
```

---

## MongoDB Restore

```bash
# Decomprimere
tar -xzf ~/backups/mongodb/tenpennynovels-20260308.tar.gz -C /tmp

# Restore (sovrascrive il database esistente)
mongorestore --db tenpennynovels --drop /tmp/mongodump-20260308/tenpennynovels

# Pulizia
rm -rf /tmp/mongodump-*
```

---

## Redis Backup

Redis usa RDB persistence (file `dump.rdb`).

```bash
# Forzare snapshot
redis-cli SAVE

# Copiare file RDB
cp /var/lib/redis/dump.rdb ~/backups/redis-$(date +%Y%m%d).rdb
```

### Redis Restore

```bash
# Fermare Redis
sudo systemctl stop redis

# Copiare il backup
sudo cp ~/backups/redis-20260308.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# Riavviare Redis
sudo systemctl start redis
```

---

## Qdrant Backup

Le collezioni Qdrant contengono embeddings che possono essere rigenerati. In caso di perdita, rieseguire il seeding degli embeddings.

```bash
# Snapshot di una collezione
curl -X POST http://127.0.0.1:6333/collections/document_chunks/snapshots

# Lista snapshot
curl http://127.0.0.1:6333/collections/document_chunks/snapshots
```

Per rigenerare gli embeddings da zero:
```bash
cd ~/tenpennynovels/scripts/seeders
npm run seed:dev:documents
```

---

## Verifica Backup

```bash
# Testare restore su database temporaneo
mongorestore --db tenpennynovels_test /tmp/mongodump-*/tenpennynovels
mongosh --eval "use tenpennynovels_test; db.stats()"
mongosh --eval "db.getSiblingDB('tenpennynovels_test').dropDatabase()"
```

---

## Related Documentation

- [Deployment Guide](./deployment-guide.md) - Setup produzione
- [Monitoring](./monitoring.md) - Monitoraggio servizi
