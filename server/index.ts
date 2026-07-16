import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.ts';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
  if (err && (err as any).stack) console.error((err as any).stack);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED_REJECTION:', err);
  if (err && (err as any).stack) console.error((err as any).stack);
});

dotenv.config();

const app = express();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3001;

// --- 1. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Middleware to verify Supabase Auth JWT
const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
};

// Middleware to verify Admin status
const adminUser = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verifying admin status' });
  }
};

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || '' });

// --- 2. MULTER CONFIG (Memory Storage for Supabase Upload) ---
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- 3. ROUTES ---

// --- 3. ROUTES ---

// User Profile Sync/Fetch
app.get('/api/users', async (req: any, res: any) => {
  const { id } = req.query;
  try {
    if (id) {
      // For specific user fetch, we need to check if they are authenticated to allow "get-or-create"
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Authentication required to sync profile' });

      const token = authHeader.split(' ')[1];
      const { data: { user: supabaseUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !supabaseUser || supabaseUser.id !== id) {
        return res.status(401).json({ error: 'Invalid token or ID mismatch' });
      }

      let user = await prisma.user.findUnique({ where: { id: supabaseUser.id } });

      if (!user) {
        // Create default profile for new Supabase user
        const email = supabaseUser.email || 'unknown';
        const baseUsername = email.split('@')[0] || 'tripper';
        
        // Ensure username uniqueness
        let username = baseUsername;
        let attempts = 0;
        while (attempts < 10) {
          const existing = await prisma.user.findUnique({ where: { username } });
          if (!existing) break;
          username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;
          attempts++;
        }

        user = await prisma.user.create({
          data: {
            id: supabaseUser.id,
            username: username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${supabaseUser.id}`,
            points: 0,
            hasAgreedToDisclaimer: false,
          }
        });
      }
      res.json(user);
    } else {
      const users = await prisma.user.findMany();
      res.json(users);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.patch('/api/users/:id', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  if (req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });
  
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
app.post('/api/comments', authenticateUser, async (req: any, res: any) => {
  const { videoId, username, avatar, text } = req.body;
  const userId = req.user.id;
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
app.get('/api/messages/:u1/:u2', authenticateUser, async (req: any, res: any) => {
  const { u1, u2 } = req.params;
  if (req.user.id !== u1 && req.user.id !== u2) {
    return res.status(403).json({ error: "Unauthorized to view this chat" });
  }
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

app.post('/api/messages', authenticateUser, async (req: any, res: any) => {
  const { receiverId, text } = req.body;
  const senderId = req.user.id;
  try {
    const message = await prisma.message.create({
      data: { senderId, receiverId, text }
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Message failed" });
  }
});

// Conversations: list chat partners with the most recent message
app.get('/api/conversations/:id', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  if (req.user.id !== id) {
    return res.status(403).json({ error: "Unauthorized to view these conversations" });
  }
  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: id }, { receiverId: id }] },
      orderBy: { createdAt: 'desc' },
      include: { sender: true, receiver: true }
    });

    const seen = new Set<string>();
    const conversations = [];
    for (const msg of messages) {
      const partner = msg.senderId === id ? msg.receiver : msg.sender;
      if (seen.has(partner.id)) continue;
      seen.add(partner.id);
      const { sender, receiver, ...lastMessage } = msg as any;
      conversations.push({ user: partner, lastMessage });
    }
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Conversation fetch failed" });
  }
});

// Upload Video
app.post('/api/videos', authenticateUser, upload.single('video'), async (req: any, res: any) => {
  try {
    const { username, title, description } = req.body;
    const userId = req.user.id;
    
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

    // Upload to Supabase Storage
    const fileName = `${userId}/${Date.now()}-${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('videos')
      .getPublicUrl(fileName);

    const video = await prisma.video.create({
      data: {
        userId,
        username: username || 'Anonymous',
        title: title || "New Trip",
        description: aiDescription,
        videoUrl: publicUrl,
        thumbnailUrl: '/uploads/default-thumb.jpg', 
      }
    });

    res.json(video);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
});

app.post('/api/videos/:id/vote', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  const { increment } = req.body;
  const userId = req.user.id;
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

app.post('/api/safety', authenticateUser, async (req: any, res: any) => {
  try {
    const report = await prisma.safetyReport.create({ data: req.body });
    res.json(report);
  } catch (error) {
    console.error("Safety Report Error:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

app.get('/api/safety', authenticateUser, adminUser, async (req: any, res: any) => {
  try {
    const reports = await prisma.safetyReport.findMany({ orderBy: { timestamp: 'desc' } });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.delete('/api/safety', authenticateUser, adminUser, async (req: any, res: any) => {
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