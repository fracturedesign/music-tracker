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
RUN apk add --no-cache ffmpeg openssl
COPY --from=builder /app/dist ./dist
COPY server.js ./
ENV PORT=3001
ENV HTTPS_PORT=3443
ENV DATA_PATH=/data/data.json
EXPOSE 3001
EXPOSE 3443
CMD ["node", "server.js"]
