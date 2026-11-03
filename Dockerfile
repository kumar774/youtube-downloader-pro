# Multi-stage production build for Next.js with yt-dlp, ffmpeg, Deno, and Rust POT provider
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

# Install yt-dlp with curl-cffi for Chrome TLS and browser impersonation
RUN pip3 install --no-cache-dir --break-system-packages "yt-dlp[default,curl-cffi]"

# Install matching Rust POT provider plugin for yt-dlp
RUN mkdir -p /etc/yt-dlp/plugins/bgutil \
    && curl -L https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest/download/bgutil-ytdlp-pot-provider-rs.zip -o /tmp/plugin.zip \
    && unzip -q /tmp/plugin.zip -d /etc/yt-dlp/plugins/bgutil \
    && rm /tmp/plugin.zip

# Install Deno globally (yt-dlp official JS runtime for YouTube challenge solving)
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y \
    && cp /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod a+rx /usr/local/bin/deno

# Install standalone Rust POT provider binary (bgutil-pot)
RUN curl -L https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest/download/bgutil-pot-linux-x86_64 -o /usr/local/bin/bgutil-pot \
    && chmod a+rx /usr/local/bin/bgutil-pot

# Global configuration for yt-dlp: Chrome browser TLS impersonation + POT provider + Deno JS runtime
RUN echo '--impersonate chrome' > /etc/yt-dlp.conf \
    && echo '--plugin-dirs /etc/yt-dlp/plugins/bgutil' >> /etc/yt-dlp.conf \
    && echo '--extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"' >> /etc/yt-dlp.conf \
    && echo '--extractor-args "youtubepot-bgutilcli:cli_path=/usr/local/bin/bgutil-pot"' >> /etc/yt-dlp.conf \
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

# Copy built application and node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]

