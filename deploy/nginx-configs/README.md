# Nginx Configuration Files

Configurazioni Nginx per tutti i 7 subdomini di TenPennyNovels.

---

## 📋 Files

| Config | Subdomain | Port | PM2 Process |
|--------|-----------|------|-------------|
| `tenpennynovels.com.conf` | tenpennynovels.com | 4000 | tenpennynovels-landing |
| `game.tenpennynovels.com.conf` | game.tenpennynovels.com | 4001 | tenpennynovels-game |
| `documenti.tenpennynovels.com.conf` | documenti.tenpennynovels.com | 4003 | tenpennynovels-documenti |
| `gestione.tenpennynovels.com.conf` | gestione.tenpennynovels.com | 4004 | tenpennynovels-gestione |
| `api.tenpennynovels.com.conf` | api.tenpennynovels.com | 8000 | tenpennynovels-api-gateway |
| `ws.tenpennynovels.com.conf` | ws.tenpennynovels.com | 3001 | tenpennynovels-unified-backend |
| `cdn.tenpennynovels.com.conf` | cdn.tenpennynovels.com | - | Static files (Nginx) |

---

## 🚀 Installation

### Copy to Nginx

```bash
# Copy all configs
sudo cp deploy/nginx-configs/*.conf /etc/nginx/sites-available/

# Enable all sites
sudo ln -sf /etc/nginx/sites-available/tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/game.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/documenti.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/gestione.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/ws.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/cdn.tenpennynovels.com.conf /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔐 SSL Certificates

Le configurazioni includono già SSL setup (porte 443), ma i certificati devono essere generati con Certbot:

```bash
sudo certbot --nginx \
  -d tenpennynovels.com \
  -d game.tenpennynovels.com \
  -d documenti.tenpennynovels.com \
  -d gestione.tenpennynovels.com \
  -d api.tenpennynovels.com \
  -d ws.tenpennynovels.com \
  -d cdn.tenpennynovels.com
```

---

## ⚙️ Configuration Details

### Frontend Apps (4000-4004)

- **Gzip compression** abilitato
- **Cache Control** per `/_next/static/` (1 year)
- **Security headers** (X-Frame-Options, X-Content-Type-Options)
- **Proxy headers** standard

### API Gateway (8000)

- **Client max body size**: 10M (file uploads)
- **CORS**: Gestito da api-gateway backend (not Nginx)
- **Health check** endpoint senza rate limit

### WebSocket (3001) ⚠️ SPECIAL

- **Upgrade headers** per WebSocket
- **Timeouts**: 7 days (keep-alive long sessions)
- **Buffering**: Disabled
- **Paths**: `/` e `/socket.io/`

### CDN (Static)

- **Cache Control**: 1 year per immagini
- **CORS**: Solo game.tenpennynovels.com e gestione.tenpennynovels.com
- **Directory listing**: Disabled

---

## 🔍 Testing

```bash
# Test specific subdomain
curl -I https://tenpennynovels.com
curl -I https://game.tenpennynovels.com
curl -I https://api.tenpennynovels.com/health

# Test WebSocket (requires WebSocket client)
wscat -c wss://ws.tenpennynovels.com/socket.io/
```

---

## 🐛 Troubleshooting

### 502 Bad Gateway

```bash
# Check PM2 process is running
pm2 status

# Check port is listening
sudo netstat -tulpn | grep :4000

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Not Found

```bash
# Verify certificates exist
sudo certbot certificates

# Regenerate if needed
sudo certbot --nginx -d tenpennynovels.com
```

### WebSocket Connection Failed

1. Verify `proxy_read_timeout` è 7 days (604800s)
2. Verify `Upgrade` e `Connection` headers sono configurati
3. Check PM2: `pm2 logs tenpennynovels-unified-backend`

---

## 📖 Documentation

Per dettagli completi: [docs/04-nginx-configuration.md](../docs/04-nginx-configuration.md) *(TODO)*

---

## 🔗 Related

- [SSL Certificates Guide](../docs/06-ssl-certificates.md) *(TODO)*
- [Troubleshooting](../docs/99-troubleshooting.md)
