
FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Development environment
FROM base AS development
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# Production environment
FROM base AS production
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/server.js"]
