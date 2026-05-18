# Notification Service (svc-notify) — added for nexus integration.
# PORT and GMAIL_USER/GMAIL_PASS are read from env (log-only if unset).
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Internal port aligned with the nexus gateway (override via PORT env).
EXPOSE 8080

CMD ["node", "src/app.js"]
