# Pull official POT provider image for YouTube BotGuard PO Token solving
FROM brainicism/bgutil-ytdlp-pot-provider:latest AS bgutil-source

# Multi-stage production build for Next.js with yt-dlp, ffmpeg, Deno, and POT provider
FROM node:20-bookworm-slim AS base

# Install system dependencies: Python3, python3-pip, ffmpeg, curl, unzip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp POT provider plugin in Python environment
RUN pip3 install --no-cache-dir --break-system-packages bgutil-ytdlp-pot-provider

# Install Deno globally (yt-dlp official JS runtime for YouTube challenge solving)
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y \
    && cp /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod a+rx /usr/local/bin/deno

# Install latest yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Global configuration for yt-dlp to solve BotGuard challenges via bgutil POT provider
RUN echo '--extractor-args "youtube:player-client=mweb,tv,web_safari;player_skip=webpage"' >> /etc/yt-dlp.conf \
    && echo '--extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"' >> /etc/yt-dlp.conf \
    && echo '--js-runtimes deno' >> /etc/yt-dlp.conf \
    && echo '--no-check-certificates' >> /etc/yt-dlp.conf

WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy bgutil POT provider
COPY --from=bgutil-source /app /opt/bgutil

# Copy built application and node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]

