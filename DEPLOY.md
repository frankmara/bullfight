# Deploying Bullfight to Digital Ocean

This guide covers deploying Bullfight to Digital Ocean using Docker. You can use either a Droplet (VPS) or App Platform.

## Prerequisites

- Digital Ocean account
- Domain name (optional but recommended)
- API keys for external services:
  - Polygon.io (for market data)
  - Stripe (for payments)
  - Resend (for emails)

## Option 1: Deploy to a Droplet (Recommended)

### Step 1: Create a Droplet

1. Go to Digital Ocean and create a new Droplet
2. Choose Ubuntu 22.04 LTS
3. Select at least 2GB RAM / 1 vCPU ($12/month)
4. Add SSH keys for secure access
5. Enable backups (recommended)

### Step 2: Install Docker

SSH into your droplet and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Clone and Configure

```bash
# Create app directory
mkdir -p /opt/bullfight
cd /opt/bullfight

# Clone your repository (or upload files)
git clone https://github.com/yourusername/bullfight.git .

# Create environment file
cp .env.example .env
nano .env
```

Edit `.env` with your production values:

```env
# Generate a secure password
DB_PASSWORD=your_secure_password_here

# Generate with: openssl rand -hex 32
SESSION_SECRET=your_64_character_hex_string

# Your API keys
POLYGON_API_KEY=your_polygon_key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...

# Your domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Enable betting (optional)
ENABLE_BET_BEHIND=false
```

### Step 4: Build and Start

```bash
# Build and start containers
docker compose up -d --build

# Check logs
docker compose logs -f

# Run database migrations
docker compose exec app npm run db:push
```

### Step 5: Set Up Nginx Reverse Proxy (with SSL)

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/bullfight
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and get SSL:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/bullfight /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 6: Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy the webhook signing secret to your `.env` file
5. Restart: `docker compose restart`

## Option 2: Deploy to App Platform

Digital Ocean App Platform offers a simpler managed deployment:

1. Go to Digital Ocean App Platform
2. Connect your GitHub repository
3. Configure the app:
   - **Source**: Your repository
   - **Type**: Web Service
   - **Build Command**: Leave empty (uses Dockerfile)
   - **Run Command**: Leave empty (uses Dockerfile CMD)
   - **HTTP Port**: 5000

4. Add a managed PostgreSQL database:
   - Choose Dev or Production tier
   - Note the connection details

5. Set environment variables:
   ```
   DATABASE_URL=${db.DATABASE_URL}
   PGHOST=${db.HOSTNAME}
   PGPORT=${db.PORT}
   PGUSER=${db.USERNAME}
   PGPASSWORD=${db.PASSWORD}
   PGDATABASE=${db.DATABASE}
   SESSION_SECRET=your_session_secret
   POLYGON_API_KEY=your_key
   STRIPE_SECRET_KEY=your_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   RESEND_API_KEY=your_key
   ALLOWED_ORIGINS=https://your-app.ondigitalocean.app
   NODE_ENV=production
   ```

6. Deploy!

## Maintenance Commands

### View logs
```bash
docker compose logs -f app
docker compose logs -f db
```

### Restart services
```bash
docker compose restart
```

### Update application
```bash
git pull
docker compose up -d --build
```

### Database backup
```bash
docker compose exec db pg_dump -U bullfight bullfight > backup_$(date +%Y%m%d).sql
```

### Database restore
```bash
cat backup_file.sql | docker compose exec -T db psql -U bullfight bullfight
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption key (min 32 chars) |
| `POLYGON_API_KEY` | Yes | Polygon.io API key for market data |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `RESEND_API_KEY` | No | Resend API key for emails |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `ENABLE_BET_BEHIND` | No | Enable betting feature (default: false) |
| `NODE_ENV` | Yes | Set to "production" |
| `PORT` | No | Server port (default: 5000) |

## Troubleshooting

### Container won't start
```bash
docker compose logs app
```
Check for missing environment variables or database connection issues.

### Database connection errors
Ensure the database container is healthy:
```bash
docker compose ps
docker compose exec db pg_isready
```

### WebSocket issues
Ensure Nginx is configured for WebSocket upgrades (see config above).

### SSL certificate issues
```bash
sudo certbot renew --dry-run
```

## Security Checklist

- [ ] Strong database password
- [ ] Strong session secret (64+ random characters)
- [ ] SSL/TLS enabled
- [ ] Firewall configured (only allow 80, 443, 22)
- [ ] Regular backups enabled
- [ ] Stripe webhook secret configured
- [ ] ALLOWED_ORIGINS set to your domain only
