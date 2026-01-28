#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force

echo "Starting server..."
exec node server_dist/index.js
