require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const app = express();
const prisma = new PrismaClient();

// --- 1. الإعدادات والـ CORS ---
// السماح لجميع الروابط مؤقتاً لضمان عمل الموقع على Railway
app.use(cors({ 
    origin: true, 
    credentials: true 
}));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// --- 2. الدوال المساعدة ---
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// --- 3. مسارات الـ API (Login & Register) ---

// مسار تسجيل الدخول (Login)
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login successful", token, user: { id: user.id, name: user.name } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error during login" });
  }
});

// مسار إنشاء حساب (Register)
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), password: hashedPassword, name }
    });

    res.json({ message: "User created successfully", userId: newUser.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error creating user. Email might already exist." });
  }
});

// مسار نسيت كلمة المرور (Forgot Password)
app.post("/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: "Email required" });
      const genericMsg = "If the email exists, we sent a reset link. ✨";
      res.json({ message: genericMsg });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
});

// --- 4. إعدادات الملفات الثابتة (Frontend) ---

// --- إعدادات الاستضافة النهائية ---

// 1. تحديد المسار (تأكدي من هذا المسار بناءً على هيكل مجلداتك)
const frontendPath = path.join(__dirname, "..", "frontend", "dist", "browser"); 
app.use(express.static(frontendPath));

// 2. توجيه المسارات بشكل آمن
app.get('*', (req, res) => {
    // استثناء طلبات الـ API الفعلية لضمان عدم تداخلها
    if (req.url.startsWith('/auth') || req.url.startsWith('/tasks')) {
        return res.status(404).json({ message: "API endpoint not found" });
    }

    // إرسال ملف الأنجيولار الرئيسي لأي طلب آخر
    res.sendFile(path.join(frontendPath, "index.html"), (err) => {
        if (err) {
            // مسار احتياطي في حال اختلف الهيكل
            res.sendFile(path.join(__dirname, "dist", "index.html"), (err2) => {
               if (err2) res.status(404).send("Frontend not found");
            });
        }
    });
});

// 3. تشغيل السيرفر (مرة واحدة فقط)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));