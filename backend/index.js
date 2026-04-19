require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

// ===============================
// 🌐 CORS
// ===============================
const corsOrigin = process.env.CORS_ORIGIN;

app.use(
  cors(
    corsOrigin
      ? {
          origin: corsOrigin.split(",").map((s) => s.trim()),
          credentials: true,
        }
      : { origin: "*" }
  )
);

app.use(express.json());

// ===============================
// 🔐 CONFIG
// ===============================
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ===============================
// 🔒 Middleware
// ===============================
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
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ===============================
// 🔥 AUTH
// ===============================

// 🟢 REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    res.json({ message: "User created successfully" });
  } catch (err) {
    console.error("REGISTER_ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟢 LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

// ===============================
// 🔐 FORGOT PASSWORD (بدون إيميل)
// ===============================
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.json({ message: "If email exists, reset sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const expiry = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: expiry,
      },
    });

    const resetLink = `https://m-e-tasks.vercel.app/reset-password?token=${resetToken}`;

    // 🔥 بدل الإيميل
    console.log("RESET LINK:", resetLink);

    res.json({
      message: "Reset link generated",
      resetLink,
    });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// 🔐 RESET PASSWORD
// ===============================
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Missing data" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// 🧪 TEST ROUTE (مهم)
// ===============================
app.get("/", (req, res) => {
  res.send("API is working ✅");
});

// ===============================
// 🚀 RUN
// ===============================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});