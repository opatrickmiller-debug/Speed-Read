# Self-Hosting Overpass API - Complete Setup Guide

## Overview

This guide explains how to run your own Overpass API server for SpeedShield, giving you unlimited speed limit queries without rate limits.

---

## Table of Contents
1. [Quick Start (Recommended)](#quick-start)
2. [Detailed Setup](#detailed-setup)
3. [Server Sizing](#server-sizing)
4. [Maintenance](#maintenance)
5. [Troubleshooting](#troubleshooting)

---

## Quick Start (Recommended)

### Using Docker (Easiest Method)

**Step 1: Get a VPS**
- DigitalOcean, Linode, Hetzner, or any Linux VPS
- Minimum: 4GB RAM, 50GB SSD for USA data
- Ubuntu 22.04 LTS recommended

**Step 2: Install Docker**
```bash
# Connect to your server via SSH
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y
```

**Step 3: Create docker-compose.yml**
```bash
mkdir ~/overpass && cd ~/overpass
nano docker-compose.yml
```

Paste this content:
```yaml
version: '3'
services:
  overpass:
    image: wiktorn/overpass-api
    container_name: overpass-api
    restart: always
    ports:
      - "8080:80"
    environment:
      # Choose your region:
      # north-america/us - Full USA (~10GB)
      # north-america/us-midwest - Midwest only (~2GB)
      # north-america/us/minnesota - Just Minnesota (~500MB)
      OVERPASS_META: "yes"
      OVERPASS_MODE: "init"
      OVERPASS_PLANET_URL: "https://download.geofabrik.de/north-america/us-midwest-latest.osm.bz2"
      OVERPASS_DIFF_URL: "https://download.geofabrik.de/north-america/us-midwest-updates/"
      OVERPASS_RULES_LOAD: "10"
    volumes:
      - overpass-db:/db

volumes:
  overpass-db:
```

**Step 4: Start the Server**
```bash
docker-compose up -d

# Watch the logs (initial data load takes 30-60 minutes)
docker-compose logs -f
```

**Step 5: Test It**
```bash
# Wait for "Overpass API ready" in logs, then test:
curl "http://localhost:8080/api/interpreter?data=[out:json];node(44.95,-93.09,44.96,-93.08);out;"
```

**Step 6: Configure SpeedShield**
In your SpeedShield backend `.env` file:
```
OVERPASS_SERVER_URL=http://your-server-ip:8080/api/interpreter
```

---

## Detailed Setup

### Option A: Docker (Recommended)

See Quick Start above. Docker handles all dependencies automatically.

### Option B: Manual Installation (Advanced)

**Requirements:**
- Ubuntu 20.04+ or Debian 11+
- 4GB+ RAM
- 50GB+ SSD

**Install Dependencies:**
```bash
apt update && apt upgrade -y
apt install -y build-essential g++ make expat libexpat1-dev zlib1g-dev \
  wget bzip2 osm2pgsql osmium-tool

# Install Overpass API
cd /opt
wget https://dev.overpass-api.de/releases/osm-3s_v0.7.61.tar.gz
tar -xzf osm-3s_v0.7.61.tar.gz
cd osm-3s_v0.7.61
./configure CXXFLAGS="-O2" --prefix=/opt/overpass
make -j$(nproc)
make install
```

**Download OSM Data:**
```bash
mkdir -p /opt/overpass/data
cd /opt/overpass/data

# Download your region (choose one):
# Full USA (~10GB compressed, ~80GB extracted)
wget https://download.geofabrik.de/north-america/us-latest.osm.bz2

# US Midwest only (~2GB compressed)
wget https://download.geofabrik.de/north-america/us-midwest-latest.osm.bz2

# Minnesota only (~500MB compressed)
wget https://download.geofabrik.de/north-america/us/minnesota-latest.osm.bz2
```

**Initialize Database:**
```bash
/opt/overpass/bin/init_osm3s.sh /opt/overpass/data/us-midwest-latest.osm.bz2 \
  /opt/overpass/db /opt/overpass
```

**Start Server:**
```bash
# Start the dispatcher
/opt/overpass/bin/dispatcher --osm-base --db-dir=/opt/overpass/db &

# Start the web server (using nginx or Apache)
# Configure to proxy /api/interpreter to the dispatcher
```

---

## Server Sizing

| Region | Data Size | RAM | SSD | Monthly Cost |
|--------|-----------|-----|-----|--------------|
| Minnesota | 500MB | 2GB | 20GB | $6-12 |
| US Midwest | 2GB | 4GB | 50GB | $20-24 |
| Full USA | 10GB | 8GB | 150GB | $40-80 |
| North America | 15GB | 16GB | 200GB | $80-160 |

### Recommended VPS Providers

| Provider | 4GB RAM Plan | Notes |
|----------|--------------|-------|
| Hetzner | $8/mo | Best value, EU datacenter |
| DigitalOcean | $24/mo | Easy, good support |
| Linode | $24/mo | Reliable |
| Vultr | $24/mo | Many locations |
| AWS Lightsail | $20/mo | AWS ecosystem |

---

## Maintenance

### Updating OSM Data

OSM data changes daily. Update weekly or monthly for fresh speed limits:

**Docker Method:**
```bash
cd ~/overpass
docker-compose down
docker-compose up -d
# Container auto-updates on restart if OVERPASS_DIFF_URL is set
```

**Manual Method:**
```bash
# Download latest diff
wget https://download.geofabrik.de/north-america/us-midwest-updates/

# Apply updates
/opt/overpass/bin/fetch_osc.sh <diff-id> \
  https://download.geofabrik.de/north-america/us-midwest-updates/ \
  /opt/overpass/diffs

/opt/overpass/bin/apply_osc_to_db.sh /opt/overpass/diffs /opt/overpass/db
```

### Monitoring

Add basic monitoring to check server health:
```bash
# Add to crontab (crontab -e)
*/5 * * * * curl -s "http://localhost:8080/api/interpreter?data=[out:json];node(1);out;" > /dev/null || echo "Overpass down" | mail -s "Alert" you@email.com
```

---

## Troubleshooting

### "Database not ready"
- Wait for initial data load (30-60 min for Midwest)
- Check logs: `docker-compose logs -f`

### Slow Queries
- Increase RAM
- Use SSD (not HDD)
- Reduce query radius in your app

### Out of Memory
- Reduce `OVERPASS_RULES_LOAD` in docker-compose.yml
- Upgrade to larger VPS

### Connection Refused
- Check firewall: `ufw allow 8080`
- Verify Docker is running: `docker ps`

---

## Security (Production)

For production, add these security measures:

**1. Firewall**
```bash
ufw allow 22    # SSH
ufw allow 8080  # Overpass (or use nginx proxy)
ufw enable
```

**2. Nginx Reverse Proxy (recommended)**
```nginx
server {
    listen 80;
    server_name overpass.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        
        # Rate limiting (optional extra protection)
        limit_req zone=overpass burst=20;
    }
}
```

**3. HTTPS with Let's Encrypt**
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d overpass.yourdomain.com
```

---

## Cost Summary

| Setup | One-Time | Monthly | Users Supported |
|-------|----------|---------|-----------------|
| Current (free APIs) | $0 | $0 | 1-10 |
| Self-Hosted (Midwest) | ~2 hrs | $20 | Unlimited |
| Self-Hosted (Full USA) | ~4 hrs | $40 | Unlimited |

**Break-even vs Commercial APIs:**
- TomTom at $1,200/mo for 1000 users
- Self-hosted at $40/mo = **$1,160/mo savings**
- Break-even: ~3 months of development time

---

## Next Steps

1. Choose your region and VPS provider
2. Follow Quick Start guide
3. Update `OVERPASS_SERVER_URL` in SpeedShield backend
4. Test with a few users
5. Set up weekly data updates

Questions? The Overpass API community is helpful:
- https://wiki.openstreetmap.org/wiki/Overpass_API
- https://github.com/drolbr/Overpass-API
