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

# نسخ ملفات الباكدند وتثبيت المكتبات
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# نسخ كود الباكدند وملفات Prisma
COPY backend/ ./backend/
COPY backend/prisma/ ./backend/prisma/

# الانتقال لبيئة عمل الباكدند
WORKDIR /app/backend

# إنشاء مجلد dist ونسخ ملفات Angular إليه
# ملاحظة: تم تعديل المسار ليشمل اسم المشروع 'frontend' المتوقع من Angular
RUN mkdir -p dist
COPY --from=frontend-build /app/frontend/dist/frontend/browser/ ./dist/

# التأكد من وجود الملفات (لأغراض اللوقز فقط)
RUN ls -la ./dist

# توليد ملفات Prisma Client
RUN npx prisma generate

# التوافق مع منفذ الكود الأساسي
EXPOSE 8080

# تنفيذ التهجير وتشغيل السيرفر
CMD npx prisma migrate deploy && node index.js