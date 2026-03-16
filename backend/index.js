require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();


const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map(s => s.trim()).filter(Boolean), credentials: true } : undefined));
app.use(express.json());


const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:4200";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function createMailer() {
  const user = mustEnv("SMTP_USER");
  const pass = mustEnv("SMTP_PASS");

  // Prefer generic SMTP (recommended for Azure/SendGrid/etc.)
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Fallback: Gmail service (works for local testing if configured properly)
  return nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || "gmail",
    auth: { user, pass },
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function brandConfig() {
  return {
    name: process.env.BRAND_NAME || "mood-energy-tasks",
    // default palette: purple + blue
    purple: process.env.BRAND_PURPLE || "#6C4AB6",
    blue: process.env.BRAND_BLUE || "#2F80ED",
    outerBg: process.env.BRAND_OUTER_BG || "#2D2A4A",
    innerSoft: process.env.BRAND_INNER_SOFT || "#F3EEFF",
    fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER,
    fromName: process.env.SMTP_FROM_NAME || (process.env.BRAND_NAME || "mood-energy-tasks"),
    supportEmail: process.env.SUPPORT_EMAIL || (process.env.SMTP_FROM || process.env.SMTP_USER || ""),
  };
}

function resetEmailHtml({ resetLink }) {
  const b = brandConfig();
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset Password</title>
</head>
<body style="margin:0;padding:0;background:${b.outerBg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${b.outerBg};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 10px 24px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:${b.purple};line-height:1.2;">
                ${b.name}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:600;color:#222;line-height:1.4;margin-top:6px;">
                Reset your password
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:8px 24px 0 24px;">
              <div style="width:100%;max-width:520px;height:140px;border-radius:12px;background:${b.innerSoft};"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 10px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;line-height:1.8;">
                We received a request to reset your password. Click the button below to set a new one.
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666;line-height:1.8;margin-top:10px;">
                If you didn’t request this, you can safely ignore this email.
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:18px 24px 10px 24px;">
              <a href="${resetLink}"
                 style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;
                        text-decoration:none;color:#fff;background:${b.blue};padding:12px 22px;border-radius:10px;">
                Reset Password
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 22px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#777;line-height:1.6;">
                Or copy and paste this link:
                <div style="word-break:break-all;color:${b.blue};margin-top:6px;">
                  ${resetLink}
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:18px 24px;background:#FAF8FF;border-top:1px solid #EEE;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#777;line-height:1.7;">
                © ${year} ${b.name}${b.supportEmail ? ` • Support: ${b.supportEmail}` : ""}
              </div>
            </td>
          </tr>
        </table>

        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#CFCBE8;line-height:1.6;margin-top:12px;">
          Please do not reply to this email.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function normalizeEnergy(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH") return v;
  return "MEDIUM";
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "PENDING" || v === "IN_PROGRESS" || v === "COMPLETED") return v;
  return null;
}


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


app.get("/", (req, res) => {
  res.send("API is running 🚀");
});




app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing data" });

    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: { email: normalizedEmail, password: hashed },
      select: { id: true, email: true },
    });

    return res.json({ message: "Registered", user });
  } catch (e) {
    console.error("REGISTER_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});


app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing data" });

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token });
  } catch (e) {
    console.error("LOGIN_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});




app.get("/users/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, mood: true, energy: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (e) {
    console.error("GET_ME_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});


app.post("/users/me", authRequired, async (req, res) => {
  try {
    const { email, password, mood, energy } = req.body || {};

    const data = {};

    if (typeof email === "string" && email.trim()) {
      data.email = email.trim().toLowerCase();
    }

    if (typeof password === "string" && password.trim().length >= 6) {
      data.password = await bcrypt.hash(password.trim(), 10);
    }

    if (typeof mood === "string" && mood.trim()) data.mood = mood.trim();
    if (typeof energy === "string" && energy.trim()) data.energy = energy.trim();

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true, email: true, mood: true, energy: true },
    });

    return res.json({ message: "Updated", user });
  } catch (e) {
    console.error("UPDATE_ME_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});



app.get("/mood", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { mood: true, energy: true },
    });
    return res.json({
      mood: user?.mood || "NEUTRAL",
      energy: user?.energy || "MEDIUM",
    });
  } catch (e) {
    console.error("GET_MOOD_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/mood", authRequired, async (req, res) => {
  try {
    const { mood, energy } = req.body || {};
    const data = {};
    if (typeof mood === "string" && mood.trim()) data.mood = mood.trim();
    if (typeof energy === "string" && energy.trim()) data.energy = energy.trim();

    await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("SET_MOOD_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});



app.post("/ai/suggest", authRequired, async (req, res) => {
  try {
    const { prompt, tasks } = req.body || {};
    const p = String(prompt || "").toLowerCase();

    const suggestions = [];
    const list = Array.isArray(tasks) ? tasks : [];
    const incomplete = list.filter((t) => t?.status !== "COMPLETED");

    if (incomplete.length === 0) {
      suggestions.push("Start with a quick win: create one small task (15–30 min).");
    } else {
      suggestions.push("Pick 1 task and finish it before starting another.");
      suggestions.push("Split a big task into 3 smaller steps to reduce friction.");
    }

    if (p.includes("study") || p.includes("exam")) {
      suggestions.unshift("Study sprint: 25 minutes focus + 5 minutes break (repeat twice).");
    }
    if (p.includes("deadline") || p.includes("today")) {
      suggestions.unshift("Deadline mode: do the highest-impact task first (no multitasking).");
    }

    return res.json({ suggestions: suggestions.slice(0, 6) });
  } catch (e) {
    console.error("AI_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});


async function forgotHandler(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email required" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });

    // Always return the same message (prevents email enumeration)
    const genericMsg = "If the email exists, we sent a reset link. Please check your inbox ✨";

    if (!user) return res.json({ message: genericMsg });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetTokenExpiry },
    });

    const transporter = createMailer();
    const resetLink = `${APP_BASE_URL}/reset-password?token=${rawToken}`;
    const b = brandConfig();

    await transporter.sendMail({
      from: b.fromName ? `"${b.fromName}" <${b.fromEmail}>` : b.fromEmail,
      to: normalizedEmail,
      subject: "Reset your password",
      html: resetEmailHtml({ resetLink }),
    });

    return res.json({ message: genericMsg });
  } catch (e) {
    console.error("FORGOT_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

app.post("/auth/forgot-password", forgotHandler);
app.post("/forgot-password", forgotHandler);


async function resetHandler(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: "Missing data" });

    const pwd = String(password);
    if (pwd.trim().length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({ where: { resetToken: tokenHash } });
    if (!user) return res.status(400).json({ message: "Invalid token" });

    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: "Token expired" });
    }

    const hashed = await bcrypt.hash(pwd, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    return res.json({ message: "Password updated" });
  } catch (e) {
    console.error("RESET_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

app.post("/auth/reset-password", resetHandler);
app.post("/reset-password", resetHandler);


app.get("/tasks", authRequired, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ tasks });
  } catch (e) {
    console.error("GET_TASKS_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/tasks", authRequired, async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();

    const rawEnergy = req.body?.energy ?? req.body?.energyLevel ?? "MEDIUM";
    const energy = normalizeEnergy(rawEnergy);

    let duration = req.body?.duration;
    if (duration == null) duration = req.body?.durationMinutes;
    if (duration == null && req.body?.durationHours != null) {
      duration = Math.round(Number(req.body.durationHours) * 60);
    }
    duration = Number(duration);

    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ message: "Duration is required" });
    }

    const task = await prisma.task.create({
      data: {
        title,
        duration: Math.round(duration),
        energy,
        status: "PENDING",
        userId: req.user.userId,
      },
    });

    return res.json({ task });
  } catch (e) {
    console.error("CREATE_TASK_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.patch("/tasks/:id", authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const status = normalizeStatus(req.body?.status);
    if (!status) return res.status(400).json({ message: "Invalid status" });

    const result = await prisma.task.updateMany({
      where: { id, userId: req.user.userId },
      data: { status },
    });

    if (result.count === 0) return res.status(404).json({ message: "Task not found" });

    const task = await prisma.task.findFirst({
      where: { id, userId: req.user.userId },
    });

    return res.json({ task });
  } catch (e) {
    console.error("PATCH_TASK_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.delete("/tasks/:id", authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const result = await prisma.task.deleteMany({
      where: { id, userId: req.user.userId },
    });

    if (result.count === 0) return res.status(404).json({ message: "Task not found" });

    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE_TASK_ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});


// --- إضافات الاستضافة للربط مع الأنغولار ---
const path = require("path");

// إخبار السيرفر بمكان ملفات الأنغولار الجاهزة
app.use(express.static(path.join(__dirname, "public")));

// توجيه أي طلب غير معروف لواجهة الأنغولار (مهم جداً للـ Routing)
// Routing مهم جداً للـ (.*) توجيه أي طلب غير معروف لواجهة الأنغولار
app.get('(.*)', (req, res, next) => {
  // API اتركه يمر للـ auth أو tasks أو users إذا كان الطلب يبدأ بـ
  if (req.url.startsWith('/auth') || req.url.startsWith('/tasks') || req.url.startsWith('/users') || req.url.startsWith('/ai') || req.url.startsWith('/mood')) {
      return next();
  }
  // غير ذلك، أرسل ملف الأنغولار الرئيسي
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// ---------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running http://localhost:${PORT}`));