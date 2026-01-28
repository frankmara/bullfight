# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Build the server
RUN npm run server:build

# Build the Expo web frontend
RUN npx expo export --platform web --output-dir dist

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built server from builder
COPY --from=builder /app/server_dist ./server_dist

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy shared schema (needed at runtime)
COPY --from=builder /app/shared ./shared

# Copy drizzle config for migrations
COPY --from=builder /app/drizzle.config.ts ./

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start the server
CMD ["node", "server_dist/index.js"]
