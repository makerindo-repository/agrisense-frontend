#!/bin/sh
set -e

echo "🚀 Starting AgriSense..."

if [ "${RUN_STARTUP_TASKS:-true}" = "true" ]; then
  # Wait for database
  echo "⏳ Waiting for database..."
  while ! nc -z ${DB_HOST:-db} ${DB_PORT:-3306}; do
    sleep 1
  done
  echo "✅ Database is ready"

  # Run migrations
  echo "🗄️ Running migrations..."
  php artisan migrate --force

  # Clear caches
  echo "🧹 Clearing caches..."
  php artisan config:clear
  php artisan cache:clear
  php artisan route:clear
  php artisan view:clear

  # Optimize only config. Route cache is intentionally skipped because
  # shared bootstrap/cache volumes and multiple containers can race and
  # leave Laravel requiring a missing routes-v7.php file.
  echo "⚡ Optimizing..."
  php artisan config:cache
else
  echo "⏭️ Skipping Laravel startup tasks for worker process"
fi

echo "✅ AgriSense is ready!"

# Execute command
exec "$@"
