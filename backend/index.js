require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const app = express();
const prisma = new PrismaClient();

// --- 1. الإعدادات الأساسية ---
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { 
    origin: corsOrigin.split(",").map(s => s.trim()).filter(Boolean), 
    credentials: true 
} : undefined));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// --- 2. الدوال المساعدة (Helpers) ---
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// --- 3. Middleware الحماية ---
function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) return res.status(401).json({ message: "Missing auth token" });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// --- 4. مسارات الـ API (تأكد من وجود الكود الكامل بداخلها) ---

// مثال لمسار forgot-password
async function forgotHandler(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email required" });
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    const genericMsg = "If the email exists, we sent a reset link. Please check your inbox ✨";
    
    if (!user) return res.json({ message: genericMsg });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: tokenHash, resetTokenExpiry } });

    return res.json({ message: genericMsg });
  } catch (e) {
    console.error("FORGOT_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}
app.post("/auth/forgot-password", forgotHandler);

// --- إعدادات الاستضافة النهائية ---

// تحديد المسار بشكل مطلق لضمان الدقة
const frontendPath = path.join(__dirname, "dist"); 
app.use(express.static(frontendPath));

app.get(/^(?!\/(auth|tasks|users|ai|mood)).*$/, (req, res) => {
    // حاول إرسال الملف، وإذا فشل سيطبع لك المسار الحقيقي في الـ Logs
    res.sendFile(path.join(frontendPath, "index.html"), (err) => {
        if (err) {
            console.error("FRONTEND_ERROR: Looked for index.html at", path.join(frontendPath, "index.html"));
            res.status(500).send("Frontend files missing. Check Dockerfile COPY command.");
        }
    });
});

// 3. تشغيل السيرفر
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));