# 1. بناء الفرونتد (Angular)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. تجهيز الباكدند (Node.js)
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
COPY backend/prisma/ ./prisma/

# النسخ من المسار الفعلي الذي أكدته الصور
# تأكدي أن المسار ينتهي بكلمة dist فقط بدون /app/backend/dist
COPY --from=frontend-build /app/frontend/dist/browser ./backend/dist

# تشغيل Prisma وتجهيز السيرفر
WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 3000
CMD npx prisma migrate deploy && node index.js