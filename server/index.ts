import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
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
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
// Confirms a newly-created email user via the service-role admin API so login
// works immediately without depending on email delivery (which can be rate-limited
// or unconfigured in some environments).
app.post('/api/auth/confirm', async (req: any, res: any) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const target = (listData.users || []).find((u: any) => u.email === email);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target.email_confirmed_at) {
      return res.json({ confirmed: true, alreadyConfirmed: true });
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      email_confirm: true,
    });
    if (updErr) throw updErr;
    res.json({ confirmed: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Confirmation failed' });
  }
});

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

// --- Friends feature ---

// Returns true if the two users are friends (either direction).
const areFriends = async (a: string, b: string): Promise<boolean> => {
  const count = await prisma.friendship.count({
    where: {
      OR: [
        { userAId: a, userBId: b },
        { userAId: b, userBId: a },
      ],
    },
  });
  return count > 0;
};

// Inserts a notification for a recipient (fire-and-forget, never blocks the request).
const createNotification = async (data: {
  recipientId: string;
  actorId?: string | null;
  type: string;
  entityId?: string | null;
  text: string;
}) => {
  try {
    await prisma.notification.create({ data: { read: false, ...data } });
  } catch (err) {
    console.error('Notification create failed', err);
  }
};

// Send a friend request
app.post('/api/friends/request', authenticateUser, async (req: any, res: any) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ error: 'receiverId is required' });
  if (senderId === receiverId) return res.status(400).json({ error: 'Cannot friend yourself' });
  try {
    if (await areFriends(senderId, receiverId)) {
      return res.status(409).json({ error: 'Already friends' });
    }
    const existing = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });
    if (existing) {
      if (existing.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
      // recreate if previously rejected
      await prisma.friendRequest.update({ where: { id: existing.id }, data: { status: 'pending', updatedAt: new Date() } });
      return res.json({ status: 'pending' });
    }
    const reqRow = await prisma.friendRequest.create({
      data: { senderId, receiverId, status: 'pending' },
    });
    res.status(201).json(reqRow);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept a friend request (receiver is the current user)
app.post('/api/friends/accept', authenticateUser, async (req: any, res: any) => {
  const receiverId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ error: 'senderId is required' });
  try {
    const fr = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });
    if (!fr || fr.status !== 'pending') return res.status(404).json({ error: 'No pending request found' });
    await prisma.friendRequest.update({ where: { id: fr.id }, data: { status: 'accepted' } });
    const [a, b] = [senderId, receiverId].sort();
    await prisma.friendship.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      create: { userAId: a, userBId: b },
      update: {},
    });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    await createNotification({
      recipientId: senderId,
      actorId: receiverId,
      type: 'friend_accepted',
      text: `${receiver?.username || 'Someone'} accepted your friend request`,
    });
    res.json({ status: 'accepted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Reject a friend request
app.post('/api/friends/reject', authenticateUser, async (req: any, res: any) => {
  const receiverId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ error: 'senderId is required' });
  try {
    const fr = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });
    if (!fr) return res.status(404).json({ error: 'No request found' });
    await prisma.friendRequest.update({ where: { id: fr.id }, data: { status: 'rejected' } });
    res.json({ status: 'rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Remove a friend (either party can do this)
app.delete('/api/friends/:friendId', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { friendId } = req.params;
  try {
    const [a, b] = [userId, friendId].sort();
    await prisma.friendship.deleteMany({ where: { userAId: a, userBId: b } });
    res.json({ status: 'removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// List current user's friends, incoming & outgoing requests
app.get('/api/friends', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    });
    const friendIds = friendships.map((f: any) => (f.userAId === userId ? f.userBId : f.userAId));
    const friends = friendIds.length
      ? await prisma.user.findMany({ where: { id: { in: friendIds } } })
      : [];

    const incoming = await prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: { sender: true },
    });
    const outgoing = await prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'pending' },
      include: { receiver: true },
    });

    res.json({ friends, incoming, outgoing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

// Search users by username (for adding friends)
app.get('/api/users/search', authenticateUser, async (req: any, res: any) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        NOT: { id: req.user.id },
      },
      take: 20,
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Friendship status between current user and another user
app.get('/api/friends/status/:userId', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { userId: otherId } = req.params;
  try {
    if (await areFriends(userId, otherId)) return res.json({ status: 'friends' });
    const outgoing = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: userId, receiverId: otherId } },
    });
    if (outgoing && outgoing.status === 'pending') return res.json({ status: 'outgoing' });
    const incoming = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: otherId, receiverId: userId } },
    });
    if (incoming && incoming.status === 'pending') return res.json({ status: 'incoming' });
    res.json({ status: 'none' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to check status' });
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

// Get Posts (text-only, no video)
app.get('/api/posts', async (req: any, res: any) => {
  try {
    const posts = await prisma.post.findMany({
      include: { comments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// Create Post
app.post('/api/posts', authenticateUser, async (req: any, res: any) => {
  const { title, text, category, username } = req.body;
  const userId = req.user.id;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  try {
    const post = await prisma.post.create({
      data: {
        userId,
        username: username || req.user.user_metadata?.username || req.user.email?.split('@')[0] || 'Anonymous',
        title: title || null,
        text: text.trim(),
        category: category || null,
      },
    });
    await prisma.user.update({ where: { id: userId }, data: { points: { increment: 10 } } });
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Post failed' });
  }
});

// Comments on a post (supports replies via parentId)
app.post('/api/post-comments', authenticateUser, async (req: any, res: any) => {
  const { postId, username, avatar, text, parentId } = req.body;
  const userId = req.user.id;
  if (!postId || !text || !text.trim()) return res.status(400).json({ error: 'postId and text are required' });
  try {
    const comment = await prisma.comment.create({
      data: { userId, postId, username, avatar, text: text.trim(), parentId: parentId || null },
    });
    await prisma.user.update({ where: { id: userId }, data: { points: { increment: 5 } } });

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (parent && parent.userId !== userId) {
        await createNotification({
          recipientId: parent.userId,
          actorId: userId,
          type: 'comment',
          entityId: postId,
          text: `${username} replied to your comment`,
        });
      }
    } else {
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (post && post.userId !== userId) {
        await createNotification({
          recipientId: post.userId,
          actorId: userId,
          type: 'comment',
          entityId: postId,
          text: `${username} commented on your post`,
        });
      }
    }
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Comment failed' });
  }
});

// Comments (supports replies via parentId)
app.post('/api/comments', authenticateUser, async (req: any, res: any) => {
  const { videoId, username, avatar, text, parentId } = req.body;
  const userId = req.user.id;
  try {
    const comment = await prisma.comment.create({
      data: { userId, videoId, username, avatar, text, parentId: parentId || null }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: 5 } }
    });

    if (parentId) {
      // notify parent comment author
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (parent && parent.userId !== userId) {
        await createNotification({
          recipientId: parent.userId,
          actorId: userId,
          type: 'comment',
          entityId: videoId,
          text: `${username} replied to your comment`,
        });
      }
    } else {
      // notify video owner
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (video && video.userId !== userId) {
        await createNotification({
          recipientId: video.userId,
          actorId: userId,
          type: 'comment',
          entityId: videoId,
          text: `${username} commented on your video "${video.title}"`,
        });
      }
    }
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
  if (!(await areFriends(u1, u2))) {
    return res.status(403).json({ error: "You can only view chats with friends" });
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
    if (!(await areFriends(senderId, receiverId))) {
      return res.status(403).json({ error: 'You can only message friends' });
    }
    const message = await prisma.message.create({
      data: { senderId, receiverId, text }
    });
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    await createNotification({
      recipientId: receiverId,
      actorId: senderId,
      type: 'message',
      entityId: message.id,
      text: `New message from ${sender?.username || 'a friend'}`,
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
    if (increment > 0 && video.userId !== userId) {
      const voter = await prisma.user.findUnique({ where: { id: userId } });
      await createNotification({
        recipientId: video.userId,
        actorId: userId,
        type: 'video_vote',
        entityId: video.id,
        text: `${voter?.username || 'Someone'} tripped your video "${video.title}"`,
      });
    }
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Vote failed" });
  }
});

// --- Reactions ---
const REACTION_TYPES = ['fire', 'laugh', 'skull', 'heart', 'eyes'];

app.post('/api/videos/:id/react', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  const { type } = req.body;
  const userId = req.user.id;
  if (!REACTION_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid reaction type' });
  try {
    const existing = await prisma.reaction.findUnique({
      where: { videoId_userId_type: { videoId: id, userId, type } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({ data: { videoId: id, userId, type } });
    }
    const counts = await prisma.reaction.groupBy({
      by: ['type'],
      where: { videoId: id },
      _count: { _all: true },
    });
    const summary: Record<string, number> = {};
    REACTION_TYPES.forEach(t => (summary[t] = 0));
    counts.forEach((c: any) => (summary[c.type] = c._count._all));
    res.json({ summary, userReactions: (await prisma.reaction.findMany({ where: { videoId: id, userId } })).map(r => r.type) });
  } catch (error) {
    res.status(500).json({ error: 'Reaction failed' });
  }
});

app.get('/api/videos/:id/reactions', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const counts = await prisma.reaction.groupBy({
      by: ['type'],
      where: { videoId: id },
      _count: { _all: true },
    });
    const summary: Record<string, number> = {};
    REACTION_TYPES.forEach(t => (summary[t] = 0));
    counts.forEach((c: any) => (summary[c.type] = c._count._all));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reactions' });
  }
});

// --- Follows ---
app.post('/api/follow/:userId', authenticateUser, async (req: any, res: any) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;
  if (followerId === followingId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) return res.status(409).json({ error: 'Already following' });
    await prisma.follow.create({ data: { followerId, followingId } });
    const followed = await prisma.user.findUnique({ where: { id: followingId } });
    await createNotification({
      recipientId: followingId,
      actorId: followerId,
      type: 'new_follow',
      text: `started following you`,
    });
    res.status(201).json({ status: 'following' });
  } catch (error) {
    res.status(500).json({ error: 'Follow failed' });
  }
});

app.delete('/api/follow/:userId', authenticateUser, async (req: any, res: any) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;
  try {
    await prisma.follow.deleteMany({ where: { followerId, followingId } });
    res.json({ status: 'unfollowed' });
  } catch (error) {
    res.status(500).json({ error: 'Unfollow failed' });
  }
});

app.get('/api/follow/status/:userId', authenticateUser, async (req: any, res: any) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;
  try {
    const f = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    res.json({ following: !!f });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// --- Notifications ---
app.get('/api/notifications', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = notifications.filter(n => !n.read).length;
    res.json({ notifications, unread });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

app.post('/api/notifications/read', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.body;
  try {
    if (id) {
      await prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { read: true } });
    } else {
      await prisma.notification.updateMany({ where: { recipientId: userId }, data: { read: true } });
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// --- Public profile + videos (for clicking @username) ---
app.get('/api/users/:id/public', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, avatar: true, bio: true, points: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const videos = await prisma.video.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
    const followerCount = await prisma.follow.count({ where: { followingId: id } });
    const followingCount = await prisma.follow.count({ where: { followerId: id } });
    res.json({ user, videos, followerCount, followingCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Following feed (videos from people you follow)
app.get('/api/feed/following', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const follows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
    const ids = follows.map(f => f.followingId);
    const videos = ids.length
      ? await prisma.video.findMany({
          where: { userId: { in: ids } },
          include: { comments: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load following feed' });
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
// Serve the built frontend in production (Capacitor / phone hits this server)
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));
// SPA fallback: non-API routes serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Trippin' TV Server live at http://localhost:${PORT}`);
});