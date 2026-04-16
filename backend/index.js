require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

// --- 1. الإعدادات الأساسية ---
const corsOrigin = process.env.CORS_ORIGIN;

app.use(cors(
  corsOrigin
    ? {
        origin: corsOrigin.split(",").map(s => s.trim()).filter(Boolean),
        credentials: true,
      }
    : { origin: "*" }
));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// --- Middleware ---
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
// 🔥 AUTH
// ===================================================

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

// 🔐 FORGOT PASSWORD
app.post("/auth/forgot-password", async (req, res) => {
      try {
        const { email } = req.body;
    
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
    
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
    
        if (!user) {
          // لا تعطي تفاصيل (أمان)
          return res.json({ message: "If email exists, reset link sent" });
        }
    
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
          .createHash("sha256")
          .update(resetToken)
          .digest("hex");
    
        const expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min
    
        await prisma.user.update({
          where: { id: user.id },
          data: {
            resetToken: hashedToken,
            resetTokenExpiry: expiry,
          },
        });
    
        // ⚠️ مؤقتًا: نطبع الرابط بدل إرسال إيميل
        console.log("RESET LINK:");
        console.log(`https://m-e-tasks.vercel.app/reset-password?token=${resetToken}`);
    
        res.json({ message: "Reset link generated (check server logs)" });
    
      } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

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

// ===================================================
// 👤 USER
// ===================================================

// GET USER
app.get("/users/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tasks: true },
    });

    res.json(user);
  } catch (err) {
    console.error("USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔥 UPDATE EVERYTHING (MOOD + ENERGY + PROFILE)
app.patch("/users/me", authRequired, async (req, res) => {
  try {
    const { mood, energy, email, password } = req.body;

    const data = {};

    // mood
    if (mood) {
      const allowedMood = ["HAPPY", "CALM", "NEUTRAL", "SAD", "STRESSED", "TIRED"];
      if (!allowedMood.includes(mood)) {
        return res.status(400).json({ message: "Invalid mood" });
      }
      data.mood = mood;
    }

    // energy
    if (energy) {
      const allowedEnergy = ["LOW", "MEDIUM", "HIGH"];
      if (!allowedEnergy.includes(energy)) {
        return res.status(400).json({ message: "Invalid energy" });
      }
      data.energy = energy;
    }

    // email
    if (email) {
      data.email = email.toLowerCase().trim();
    }

    // password
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===================================================
// 📋 TASKS
// ===================================================

app.get("/tasks", authRequired, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.id },
    });

    res.json(tasks);
  } catch (err) {
    console.error("TASKS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/tasks", authRequired, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const title = req.body.title;
    const durationRaw = req.body.duration || req.body.durationMinutes;
    const energyRaw = req.body.energy || req.body.energyLevel;

    if (!title || !durationRaw || !energyRaw) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const duration = Number(durationRaw);
    if (isNaN(duration)) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    const allowedEnergy = ["LOW", "MEDIUM", "HIGH"];
    const energy = String(energyRaw).toUpperCase();

    if (!allowedEnergy.includes(energy)) {
      return res.status(400).json({ message: "Invalid energy" });
    }

    const task = await prisma.task.create({
      data: {
        title: String(title),
        duration,
        energy,
        status: "PENDING",
        userId: req.user.id,
      },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

app.patch("/tasks/:id", authRequired, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatus = ["PENDING", "IN_PROGRESS", "COMPLETED"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    res.json(task);
  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===================================================
// 🚀 RUN
// ===================================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});