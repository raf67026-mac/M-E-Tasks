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

# إنشاء مجلد dist يدوياً للتأكد من وجوده
RUN mkdir -p /app/backend/dist

# نسخ الملفات من مرحلة البناء إلى المجلد الصحيح
COPY --from=frontend-build /app/frontend/dist/browser/ /app/backend/dist/

# التأكد من أن الملفات وصلت فعلاً (ستظهر في سجلات Railway)
RUN ls -la /app/backend/dist

# تشغيل السيرفر
WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 3000
CMD npx prisma migrate deploy && node index.js