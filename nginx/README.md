# Mentora - Production HTTPS & SSL Configuration Guide

Mentora v1.0 requires secure transport (`HTTPS`) in production environments to protect student documents, chat interactions, and authentication tokens.

## 1. Architecture Overview

In a containerized or bare-metal production deployment, Nginx serves as the reverse proxy terminating TLS/SSL connections:
- Port `80`: Automatically redirects all traffic to `443` (HTTPS)
- Port `443`: Terminates SSL, enforces modern cryptographic protocols (`TLSv1.2`, `TLSv1.3`), and reverse proxies:
  - `/api/*` -> Node.js Express Backend (`http://backend:5000`)
  - `/*` -> Optimized React Production Static Bundle (`/usr/share/nginx/html`)

---

## 2. Setting Up SSL via Let's Encrypt (Certbot)

### Step 1: Obtain a Free Certificate with Certbot
On your Linux production host with a valid domain name (`mentora.example.com`):

```bash
# Install certbot
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d mentora.example.com -d www.mentora.example.com
```

The certificates will be generated at `/etc/letsencrypt/live/mentora.example.com/`:
- `fullchain.pem`
- `privkey.pem`

### Step 2: Mount Certificates into Docker
Add the volume mount in `docker-compose.yml` under `frontend`:

```yaml
    volumes:
      - /etc/letsencrypt:/etc/nginx/ssl:ro
      - ./nginx/conf.d/mentora-ssl.conf.template:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
```

### Step 3: Automatic Certificate Renewal
Add a cron job to renew the certificates automatically:

```bash
0 3 * * * certbot renew --quiet && docker compose exec frontend nginx -s reload
```

---

## 3. Development / Staging Self-Signed Certificate

For local testing of HTTPS, generate a self-signed certificate:

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Mentora/CN=localhost"
```

---

## 4. Security Headers Included

The provided Nginx configuration includes production-grade security headers:
- `Strict-Transport-Security` (HSTS): Enforces browser-side HTTPS enforcement for 2 years.
- `X-Frame-Options: DENY`: Prevents clickjacking attacks.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `X-XSS-Protection: 1; mode=block`: Defends legacy browsers against reflected XSS.
- `Referrer-Policy: strict-origin-when-cross-origin`: Minimizes referrer leakage.
- `Content-Security-Policy`: Restricts script and content loading to trusted origins.
