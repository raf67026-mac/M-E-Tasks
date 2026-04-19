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

// ================== AUTH ==================
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Missing data" });

    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists)
      return res.status(400).json({ message: "User exists" });

    const hash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { email, password: hash },
    });

    res.json({ message: "Created" });
  } catch (e) {
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
  } catch {
    res.status(500).json({ message: "Error" });
  }
});

// ================== MIDDLEWARE ==================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ================== USER ==================
app.get("/users/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });
  res.json(user);
});

// ================== TASKS ==================
app.get("/tasks", auth, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user.id },
  });
  res.json(tasks);
});

app.post("/tasks", auth, async (req, res) => {
      try {
        const { title, durationMinutes, energyLevel } = req.body;
    
        if (!title || !durationMinutes || !energyLevel) {
          return res.status(400).json({ message: "Missing fields" });
        }
    
        const task = await prisma.task.create({
          data: {
            title,
            duration: durationMinutes,
            energy: energyLevel,
            userId: req.user.id,
          },
        });
    
        res.json(task);
      } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error creating task" });
      }
    });

app.put("/tasks/:id", auth, async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  const task = await prisma.task.update({
    where: { id: Number(id) },
    data: { completed },
  });

  res.json(task);
});

app.delete("/tasks/:id", auth, async (req, res) => {
  await prisma.task.delete({
    where: { id: Number(req.params.id) },
  });

  res.json({ message: "Deleted" });
});

// ================== MOOD ==================
app.get("/mood", auth, (req, res) => {
  res.json({ mood: "Tired", energy: "Low" });
});

// ================== RUN ==================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 running on " + PORT);
});