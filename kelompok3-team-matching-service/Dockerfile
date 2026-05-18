# Team Matching Service (svc-match) — added for nexus integration.
# PORT and DATABASE_* are read from env (see src/config/database.js),
# so no source changes are needed.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Internal port aligned with the nexus gateway (override via PORT env).
EXPOSE 8080

CMD ["node", "src/index.js"]
