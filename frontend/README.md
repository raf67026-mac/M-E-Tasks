# 🟣 Mood Energy Tasks – Full Stack Project

A full-stack task management application that helps users organize tasks based on energy levels.

---

## 📌 Project Overview

**Mood Energy Tasks** is a web application designed to help users:

- Track daily tasks  
- Organize them based on energy levels (LOW / MEDIUM / HIGH)  
- Create, edit, and manage tasks  
- Reset passwords via email  
- Use JWT authentication  

The project consists of:

- **Frontend:** Angular  
- **Backend:** Node.js + Express  
- **Database:** PostgreSQL  
- **Authentication:** JWT  
- **Email Service:** SMTP (for reset password)

---

# 🛠 Tech Stack

### Frontend
- Angular  
- TypeScript  
- SCSS  
- REST API integration  

### Backend
- Node.js  
- Express  
- Prisma ORM  
- PostgreSQL  
- JWT Authentication  
- Nodemailer  

---

# 🚀 How to Run the Project Locally

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd mood-energy-tasks
```

---

## 2. Backend Setup

Navigate to backend folder:

```bash
cd backend
```

### Install dependencies

```bash
npm install
```

### Configure Environment Variables

Create a file called `.env` inside the backend folder:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mood_energy_tasks?schema=public
JWT_SECRET=your_secret_key

SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password

APP_BASE_URL=http://localhost:4200
```

---

### Database Setup

Run Prisma migrations:

```bash
npx prisma migrate dev
```

---

### Start Backend Server

```bash
npm start
```

Backend will run on:

```
http://localhost:3000
```

---

# 3. Frontend Setup

Navigate to frontend folder:

```bash
cd ../frontend
```

### Install dependencies

```bash
npm install
```

### Run Angular App

```bash
ng serve
```

Open in browser:

```
http://localhost:4200
```

---

# 🔐 Authentication Features

- User registration  
- Login system  
- JWT protected routes  
- Password reset via email  

---

# ⚠ Important Notes

- Never push `.env` file to GitHub  
- Always keep secrets private  
- Use `.env.example` instead  
- Database must be running before backend  
- Backend must be running before frontend  

---

## 👩‍💻 Developer

Developed by: **Rafif**  
Full Stack Trainee Developer
