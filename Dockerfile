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

# الانتقال لمجلد الباكند أولاً
WORKDIR /app/backend

# إنشاء المجلد ونسخ الملفات بداخله مباشرة
RUN mkdir -p dist
COPY --from=frontend-build /app/frontend/dist/browser/ ./dist/

# التأكد من أننا نرى الملفات داخل المجلد الحالي
RUN ls -la dist

# تشغيل السيرفر
RUN npx prisma generate
EXPOSE 3000
CMD npx prisma migrate deploy && node index.js