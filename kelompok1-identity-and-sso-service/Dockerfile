# ============================================
# Identity & SSO Service - Dockerfile
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install && \
    npx prisma generate && \
    cp -R node_modules /dev_modules && \
    npm prune --omit=dev && \
    cp -R node_modules /prod_modules

FROM node:20-alpine AS dev
WORKDIR /app
COPY --from=deps /dev_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma generate && npm run dev"]

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /prod_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
