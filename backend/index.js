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

    if (!email || !password) {
      return res.status(400).json({ message: "Missing data" });
    }

    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      return res.status(400).json({ message: "User exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hash,
      },
    });

    res.json({ message: "Created" });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ message: "Error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing data" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET
    );

    res.json({ token });
  } catch (e) {
    console.error("LOGIN ERROR:", e); // 🔥 مهم
    res.status(500).json({ message: "Login error" });
  }
});

// ================== MIDDLEWARE ==================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    console.error("AUTH ERROR:", e);
    res.status(401).json({ message: "Invalid token" });
  }
}

// ================== USER ==================
app.get("/users/me", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    res.json(user);
  } catch (e) {
    console.error("GET USER ERROR:", e);
    res.status(500).json({ message: "Error fetching user" });
  }
});

app.patch("/users/me", auth, async (req, res) => {
  try {
    const { name, username, email, password, mood, energy } = req.body;

    const data = {};

    if (name !== undefined) data.name = name;
    if (username !== undefined) data.username = username;
    if (email !== undefined) data.email = email;
    if (mood !== undefined) data.mood = mood;
    if (energy !== undefined) data.energy = energy;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      data.password = hash;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json(user);
  } catch (e) {
    console.error("UPDATE USER ERROR:", e);
    res.status(500).json({ message: "Error updating user" });
  }
});

// ================== TASKS ==================
app.get("/tasks", auth, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.id },
    });

    res.json(tasks);
  } catch (e) {
    console.error("GET TASKS ERROR:", e);
    res.status(500).json({ message: "Error fetching tasks" });
  }
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
    console.error("CREATE TASK ERROR:", e);
    res.status(500).json({ message: "Error creating task" });
  }
});

app.patch("/tasks/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await prisma.task.update({
      where: { id: Number(id) },
      data: { status },
    });

    res.json(task);
  } catch (e) {
    console.error("UPDATE TASK ERROR:", e);
    res.status(500).json({ message: "Error updating task" });
  }
});

app.delete("/tasks/:id", auth, async (req, res) => {
  try {
    await prisma.task.delete({
      where: { id: Number(req.params.id) },
    });

    res.json({ message: "Deleted" });
  } catch (e) {
    console.error("DELETE TASK ERROR:", e);
    res.status(500).json({ message: "Error deleting task" });
  }
});

// ================== RUN ==================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 running on " + PORT);
});