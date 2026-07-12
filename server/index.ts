import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- 1. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || '' });

// --- 2. MULTER CONFIG ---
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, 'uploads/'); 
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Serve static files
app.use('/uploads', express.static(path.resolve('uploads')));

// --- 3. ROUTES ---

// 1. Auth
app.post('/api/auth/login', async (req: any, res: any) => {
  const { username } = req.body;
  try {
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          points: 150,
          isLoggedIn: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isLoggedIn: true }
      });
    }
    res.json(user);
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(500).json({ error: "Auth failed" });
  }
});

app.post('/api/auth/google', async (req: any, res: any) => {
  const { token } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid token");

    const { sub, email, name, picture } = payload;
    const username = name?.replace(/\s+/g, '_').toLowerCase() || `user_${sub.substring(0, 5)}`;

    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          avatar: picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          points: 150,
          isLoggedIn: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isLoggedIn: true }
      });
    }
    res.json(user);
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ error: "Google authentication failed" });
  }
});

app.patch('/api/users/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: updates
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.get('/api/users', async (req: any, res: any) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// Get Videos
app.get('/api/videos', async (req: any, res: any) => {
  try {
    const videos = await prisma.video.findMany({
      include: { comments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "DB Error" });
  }
});

// Comments
app.post('/api/comments', async (req: any, res: any) => {
  const { userId, videoId, username, avatar, text } = req.body;
  try {
    const comment = await prisma.comment.create({
      data: { userId, videoId, username, avatar, text }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: 5 } }
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: "Comment failed" });
  }
});

// Messages
app.get('/api/messages/:u1/:u2', async (req: any, res: any) => {
  const { u1, u2 } = req.params;
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: u1, receiverId: u2 },
          { senderId: u2, receiverId: u1 },
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Message fetch failed" });
  }
});

app.post('/api/messages', async (req: any, res: any) => {
  const { senderId, receiverId, text } = req.body;
  try {
    const message = await prisma.message.create({
      data: { senderId, receiverId, text }
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Message failed" });
  }
});

// Upload Video
app.post('/api/videos', upload.single('video'), async (req: any, res: any) => {
  try {
    const { userId, username, title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file' });
    }

    // AI Check
    let aiDescription = description;
    try {
      const prompt = `Rewrite this for a viral video app: ${title} ${description}`;
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      aiDescription = result.text || description;
    } catch (e) {
      console.log("AI skipped", e);
    }

    const videoUrl = `/uploads/${req.file.filename}`;

    const video = await prisma.video.create({
      data: {
        userId,
        username,
        title: title || "New Trip",
        description: aiDescription,
        videoUrl: videoUrl,
        thumbnailUrl: '/uploads/default-thumb.jpg', 
      }
    });

    res.json(video);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/videos/:id/vote', async (req: any, res: any) => {
  const { id } = req.params;
  const { userId, increment } = req.body;
  try {
    const video = await prisma.video.update({
      where: { id },
      data: { trips: { increment } }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: increment > 0 ? 10 : -10 } }
    });
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Vote failed" });
  }
});

// Stats
app.get('/api/safety/stats', async (req: any, res: any) => {
  try {
    const userCount = await prisma.user.count();
    const videoCount = await prisma.video.count();
    const reportCount = await prisma.safetyReport.count();
    res.json({ userCount, videoCount, reportCount });
  } catch (error) {
    res.status(500).send("Error");
  }
});

app.post('/api/safety', async (req: any, res: any) => {
  try {
    const report = await prisma.safetyReport.create({ data: req.body });
    res.json(report);
  } catch (error) {
    console.error("Safety Report Error:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

app.get('/api/safety', async (req: any, res: any) => {
  try {
    const reports = await prisma.safetyReport.findMany({ orderBy: { timestamp: 'desc' } });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.delete('/api/safety', async (req: any, res: any) => {
  try {
    await prisma.safetyReport.deleteMany();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear reports" });
  }
});

// --- 4. START ---
app.listen(PORT, () => {
  console.log(`🚀 Trippin' TV Server live at http://localhost:${PORT}`);
});