# ============================================================
# AgriSense Multi-stage Docker Build
# ============================================================
# Stage 1: Build frontend (Node.js)
# Stage 2: Build backend (PHP + Python)
# ============================================================
# LAYER ORDERING STRATEGY:
#   Layers are ordered from least-frequently-changed (top) to
#   most-frequently-changed (bottom) so Docker cache stays warm
#   across typical code-only pushes.
# ============================================================

# ════════════════════════════════════════════
# STAGE 1: Frontend Build
# ════════════════════════════════════════════
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files (changes rarely → cache npm ci)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source (changes often — placed AFTER npm ci so deps stay cached)
COPY . .

# ── Inject VITE_* env vars at build time ──
# .dockerignore excludes .env for security, so we pass VITE_*
# variables via docker-compose build args instead.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_RECAPTCHA_SITE_KEY=""
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

# Build with limited memory to fit on 2GB VPS
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN npm run build

# ════════════════════════════════════════════
# STAGE 2: Backend Runtime
# ════════════════════════════════════════════
FROM php:8.2-fpm-bookworm

WORKDIR /app

# ── Layer 1: System deps + PHP extensions (changes VERY rarely) ──
# This is the most expensive layer (~12 min to build).
# It only rebuilds when this RUN instruction itself changes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    postgresql-client \
    libpq-dev \
    build-essential \
    autoconf \
    pkg-config \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    netcat-openbsd \
    git \
    curl \
    zip \
    unzip \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    zlib1g-dev \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    gd \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    zip \
    bcmath \
    xml \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

# ── Layer 2: Composer binary (changes rarely) ──
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# ── Layer 3: PHP dependencies (changes when composer.lock changes) ──
# Copy ONLY dependency-definition files first so composer install is cached
# across code-only changes.
COPY backend/composer.json backend/composer.lock /app/backend/
WORKDIR /app/backend
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# ── Layer 4: Python ML dependencies (changes when requirements.txt changes) ──
# Copy ONLY requirements.txt first to cache the expensive pip install layer.
COPY backend/requirements-prod.txt /tmp/ai_requirements.txt
RUN python3 -m venv /opt/ai_env \
    && /opt/ai_env/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/ai_env/bin/pip install --no-cache-dir -r /tmp/ai_requirements.txt \
    && rm /tmp/ai_requirements.txt \
    && find /opt/ai_env -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /opt/ai_env -name '*.pyc' -delete 2>/dev/null || true

# ── Layer 5: Application source code (changes MOST often) ──
# These layers rebuild on every code push, but they are fast (just COPY).
COPY backend /app/backend
COPY docs/deploy_model_bundle /app/docs/deploy_model_bundle

# Re-run composer dump-autoload after full source is available
# (scripts like post-autoload-dump may reference app classes).
WORKDIR /app/backend
RUN composer dump-autoload --optimize --no-dev

ENV AI_MODEL_BUNDLE_PATH=/app/docs/deploy_model_bundle
ENV PYTHON_EXECUTABLE=/opt/ai_env/bin/python
ENV AI_FORECAST_MODELS=svm,xgboost,lstm

# Copy frontend build dari stage 1
COPY --from=frontend-builder /app/dist /app/dist

# Setup Laravel permissions
# IMPORTANT: Only chown the directories that need write access, NOT the entire
# /app tree. chown -R on /app took 583s because it touched every file in the
# Python venv (~200k files). This targeted approach takes <2s.
RUN chmod -R 755 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chown www-data:www-data /app/backend

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port for FastCGI
EXPOSE 9000

# Health check (cek konfigurasi FPM)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD php-fpm -t || exit 1

# Non-root runtime
USER www-data

# Entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command
CMD ["php-fpm", "-F"]
