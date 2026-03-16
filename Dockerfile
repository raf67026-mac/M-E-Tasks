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

# الانتقال لمجلد الباكند أولاً كبيئة عمل أساسية
WORKDIR /app/backend

# إنشاء مجلد dist داخل المجلد الحالي (app/backend/)
RUN mkdir -p dist

# نسخ محتويات الانغولار إلى مجلد dist الذي أنشأناه
COPY --from=frontend-build /app/frontend/dist/browser/ ./dist/

# أمر للتاكد من أن الملفات موجودة فعلاً في المكان الصحيح
RUN ls -la ./dist

# تجهيز قاعدة البيانات وتشغيل المشروع
RUN npx prisma generate
EXPOSE 3000
CMD npx prisma migrate deploy && node index.js