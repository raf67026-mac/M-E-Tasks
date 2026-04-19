require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: "*" }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ==========================
// 🔒 Middleware
// ==========================
function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "No token" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ==========================
// 🔐 AUTH
// ==========================
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Missing data" });

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing)
      return res.status(400).json({ message: "User exists" });

    const hash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { email, password: hash },
    });

    res.json({ message: "Created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid" });

    const ok = await bcrypt.compare(password, user.password);

    if (!ok)
      return res.status(400).json({ message: "Invalid" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ==========================
// 👤 USER
// ==========================
app.get("/users/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  res.json(user);
});

// ==========================
// ✅ TASKS
// ==========================
app.get("/tasks", authRequired, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
});

app.post("/tasks", authRequired, async (req, res) => {
  const { title } = req.body;

  const task = await prisma.task.create({
    data: {
      title,
      completed: false,
      userId: req.user.id,
    },
  });

  res.json(task);
});

app.put("/tasks/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  const task = await prisma.task.update({
    where: { id: Number(id) },
    data: { completed },
  });

  res.json(task);
});

app.delete("/tasks/:id", authRequired, async (req, res) => {
  const { id } = req.params;

  await prisma.task.delete({
    where: { id: Number(id) },
  });

  res.json({ message: "Deleted" });
});

// ==========================
// 😊 MOOD
// ==========================
app.get("/mood", authRequired, async (req, res) => {
  res.json({
    mood: "Tired",
    energy: "Low",
  });
});

// ==========================
// 🚀 RUN
// ==========================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Server running on " + PORT);
});