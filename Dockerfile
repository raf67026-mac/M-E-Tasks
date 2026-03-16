# 1. مرحلة بناء الفرونتد (Angular)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. مرحلة تجهيز الباكدند والتشغيل (Node.js)
FROM node:20-alpine
WORKDIR /app

# نسخ ملفات الباكدند
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/

# الانتقال لبيئة عمل الباكدند
WORKDIR /app/backend

# إنشاء مجلد dist ونسخ ملفات Angular إليه من المسار الصحيح
RUN mkdir -p dist
COPY --from=frontend-build /app/frontend/dist/frontend/browser/ ./dist/

# سطر سحري للتأكد من نجاح النسخ في السجلات
RUN ls -la ./dist

# توليد ملفات Prisma Client والمنفذ
RUN npx prisma generate
EXPOSE 8080

# تنفيذ التهجير وتشغيل السيرفر
CMD npx prisma migrate deploy && node index.js