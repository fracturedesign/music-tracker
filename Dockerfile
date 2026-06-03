FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN apk add --no-cache ffmpeg
COPY --from=builder /app/dist ./dist
COPY server.js ./
ENV PORT=3001
ENV DATA_PATH=/data/data.json
EXPOSE 3001
CMD ["node", "server.js"]
