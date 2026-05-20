FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma schema first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev || npm install --omit=dev

# Generate Prisma client at build time (no DB connection needed)
RUN npx prisma generate

COPY . .

EXPOSE 8080

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
