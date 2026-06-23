# AssistSphere — Instance 2 Deployment Guide

## Prerequisites

```bash
# Install Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in
docker --version                 # verify
docker compose version           # verify
```

## Step-by-step

### 1. Clone the infra directory to Instance 2

```bash
scp -r ./infra ubuntu@INSTANCE2_IP:~/assistsphere-infra
# or git clone your repo and cd into infra/
```

### 2. Configure your values

```bash
cd ~/assistsphere-infra

# Environment variables
cp .env.example .env
nano .env   # set GRAFANA_ADMIN_PASSWORD

# Coturn
nano coturn/turnserver.conf
# → Replace INSTANCE2_PUBLIC_IP  (your Instance 2 public IP)
# → Replace REPLACE_WITH_STRONG_SECRET with: openssl rand -hex 16

# Prometheus
nano prometheus/prometheus.yml
# → Replace INSTANCE1_PRIVATE_IP with Instance 1's Oracle VCN private IP

# Nginx vhost
nano nginx/conf.d/monitoring.conf
# → Replace yourdomain.com with your actual domain
```

### 3. SSL Certificates (optional for testing, required for production)

```bash
# Install certbot on Instance 2 (not inside Docker)
sudo snap install --classic certbot
sudo certbot certonly --standalone -d monitor.yourdomain.com

# Copy certs to infra ssl dir
sudo cp /etc/letsencrypt/live/monitor.yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/monitor.yourdomain.com/privkey.pem   ./nginx/ssl/

# Create htpasswd for Prometheus basic auth (optional extra layer)
sudo apt install apache2-utils
htpasswd -c ./nginx/ssl/.htpasswd admin
```

### 4. Open firewall ports (Oracle Security List)

| Port | Protocol | Purpose |
|------|----------|---------|
| 80   | TCP | HTTP (redirect to HTTPS) |
| 443  | TCP | HTTPS (Nginx → Grafana/Prometheus) |
| 3478 | TCP+UDP | TURN/STUN |
| 5349 | TCP+UDP | TURN/STUN over TLS |
| 49152-65535 | UDP | TURN media relay |

### 5. Deploy — Phase 1

```bash
# Start Coturn + Nginx only first
docker compose up -d coturn nginx

# Verify RAM
free -h
docker stats --no-stream
```

### 6. Deploy — Phase 2 (Monitoring)

```bash
docker compose up -d prometheus grafana

free -h          # Check RAM — should be < 600 MB total
docker stats
```

### 7. Deploy — Phase 3 (Logging)

```bash
docker compose up -d loki promtail

# Check Loki is receiving logs
curl http://localhost:3100/ready
```

### 8. Verify

```bash
# All containers running
docker compose ps

# Grafana at https://monitor.yourdomain.com/grafana/
# Prometheus at https://monitor.yourdomain.com/prometheus/

# Instance 1 Node Exporter (install natively):
wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-arm64.tar.gz
tar xvf node_exporter-*.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/
# Then create systemd service and enable it
```

## Useful commands

```bash
# RAM check
free -h

# Container resource usage
docker stats

# Follow all logs
docker compose logs -f

# Restart a specific service
docker compose restart grafana

# Update all images and redeploy
docker compose pull && docker compose up -d

# Rollback (docker compose keeps previous image cached)
docker compose down
docker compose up -d
```
