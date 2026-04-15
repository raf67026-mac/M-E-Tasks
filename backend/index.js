require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

// --- 1. الإعدادات الأساسية ---
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { 
    origin: corsOrigin.split(",").map(s => s.trim()).filter(Boolean), 
    credentials: true 
} : { origin: "*"}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// --- 2. Helpers ---
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// --- 3. Middleware ---
function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing auth token" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ===================================================
// 🔥 AUTH ROUTES
// ===================================================

// ✅ REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword
      }
    });

    res.json({ message: "User created successfully" });

  } catch (err) {
    console.error("REGISTER_ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ FORGOT PASSWORD
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email required" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });

    const genericMsg = "If the email exists, we sent a reset link ✨";
    
    if (!user) return res.json({ message: genericMsg });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetTokenExpiry }
    });

    res.json({ message: genericMsg });

  } catch (e) {
    console.error("FORGOT_ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});
// ==============================
// 👤 USER INFO
// ==============================
app.get("/users/me", authRequired, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { tasks: true }
      });
  
      res.json(user);
    } catch (err) {
      console.error("USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // ==============================
  // 📋 TASKS
  // ==============================
  app.get("/tasks", authRequired, async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({
        where: { userId: req.user.id }
      });
  
      res.json(tasks);
    } catch (err) {
      console.error("TASKS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ➕ CREATE TASK
app.post("/tasks", authRequired, async (req, res) => {
    try {
      const { title, duration, energy } = req.body;
  
      const task = await prisma.task.create({
        data: {
          title,
          duration,
          energy,
          userId: req.user.id,
        },
      });
  
      res.json(task);
    } catch (err) {
      console.error("CREATE TASK ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
// ===================================================
// 🚀 RUN SERVER
// ===================================================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});