FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p logs && addgroup -g 1001 -S nodejs && adduser -S -G nodejs -u 1001 nodejs \
    && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000
CMD ["node", "app.js"]