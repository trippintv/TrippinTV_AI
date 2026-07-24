import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
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
const PORT = process.env.PORT || 3001;
const db = supabaseAdmin;

// --- 1. MIDDLEWARE ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
};

const adminUser = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { data: user } = await db.from('User').select('isAdmin').eq('id', req.user.id).single();
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch {
    res.status(500).json({ error: 'Error verifying admin status' });
  }
};

const genAI = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || '' });

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper: atomic increment via RPC
const incrementCol = async (table: string, column: string, id: string, amount: number) => {
  await db.rpc('increment_column', { table_name: table, column_name: column, row_id: id, amount });
};

// --- 2. ROUTES ---

app.post('/api/auth/confirm', async (req: any, res: any) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const { data: listData, error: listError } = await db.auth.admin.listUsers();
    if (listError) throw listError;
    const target = (listData.users || []).find((u: any) => u.email === email);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email_confirmed_at) return res.json({ confirmed: true, alreadyConfirmed: true });
    const { error: updErr } = await db.auth.admin.updateUserById(target.id, { email_confirm: true });
    if (updErr) throw updErr;
    res.json({ confirmed: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Confirmation failed' });
  }
});

// --- Users ---
app.get('/api/users', async (req: any, res: any) => {
  const { id } = req.query;
  try {
    if (id) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Authentication required to sync profile' });
      const token = authHeader.split(' ')[1];
      const { data: { user: supabaseUser }, error: authError } = await db.auth.getUser(token);
      if (authError || !supabaseUser || supabaseUser.id !== id) {
        return res.status(401).json({ error: 'Invalid token or ID mismatch' });
      }
      let { data: user } = await db.from('User').select('*').eq('id', supabaseUser.id).maybeSingle();
      if (!user) {
        const email = supabaseUser.email || 'unknown';
        const baseUsername = email.split('@')[0] || 'tripper';
        let username = baseUsername;
        let attempts = 0;
        while (attempts < 10) {
          const { data: existing } = await db.from('User').select('id').eq('username', username).maybeSingle();
          if (!existing) break;
          username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;
          attempts++;
        }
        const { data: created } = await db.from('User').insert({
          id: supabaseUser.id,
          username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${supabaseUser.id}`,
          points: 0,
          hasAgreedToDisclaimer: false,
        }).select().single();
        user = created;
      }
      res.json(user);
    } else {
      const { data: users } = await db.from('User').select('*');
      res.json(users || []);
    }
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    res.status(500).json({ error: "Fetch failed", detail: error?.message || String(error) });
  }
});

app.patch('/api/users/:id', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  if (req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { data: user, error } = await db.from('User').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    res.json(user);
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});

// --- Friends ---
const areFriends = async (a: string, b: string): Promise<boolean> => {
  const { count } = await db.from('Friendship').select('*', { count: 'exact', head: true })
    .or(`userAId.eq.${a},userBId.eq.${a},userAId.eq.${b},userBId.eq.${b}`);
  return (count || 0) > 0;
};

const createNotification = async (data: {
  recipientId: string; actorId?: string | null; type: string; entityId?: string | null; text: string;
}) => {
  try {
    await db.from('Notification').insert({ read: false, ...data });
  } catch (err) {
    console.error('Notification create failed', err);
  }
};

app.post('/api/friends/request', authenticateUser, async (req: any, res: any) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ error: 'receiverId is required' });
  if (senderId === receiverId) return res.status(400).json({ error: 'Cannot friend yourself' });
  try {
    if (await areFriends(senderId, receiverId)) return res.status(409).json({ error: 'Already friends' });
    const { data: existing } = await db.from('FriendRequest').select('*')
      .eq('senderId', senderId).eq('receiverId', receiverId).maybeSingle();
    if (existing) {
      if (existing.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
      const { data: updated } = await db.from('FriendRequest').update({ status: 'pending', updatedAt: new Date().toISOString() })
        .eq('id', existing.id).select().single();
      return res.json(updated);
    }
    const { data: reqRow, error } = await db.from('FriendRequest').insert({ senderId, receiverId, status: 'pending' }).select().single();
    if (error) throw error;
    res.status(201).json(reqRow);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

app.post('/api/friends/accept', authenticateUser, async (req: any, res: any) => {
  const receiverId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ error: 'senderId is required' });
  try {
    const { data: fr } = await db.from('FriendRequest').select('*')
      .eq('senderId', senderId).eq('receiverId', receiverId).maybeSingle();
    if (!fr || fr.status !== 'pending') return res.status(404).json({ error: 'No pending request found' });
    await db.from('FriendRequest').update({ status: 'accepted' }).eq('id', fr.id);
    const [a, b] = [senderId, receiverId].sort();
    const { data: existingF } = await db.from('Friendship').select('id').eq('userAId', a).eq('userBId', b).maybeSingle();
    if (!existingF) await db.from('Friendship').insert({ userAId: a, userBId: b });
    const { data: receiver } = await db.from('User').select('username').eq('id', receiverId).single();
    await createNotification({
      recipientId: senderId, actorId: receiverId, type: 'friend_accepted',
      text: `${receiver?.username || 'Someone'} accepted your friend request`,
    });
    res.json({ status: 'accepted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

app.post('/api/friends/reject', authenticateUser, async (req: any, res: any) => {
  const receiverId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ error: 'senderId is required' });
  try {
    const { data: fr } = await db.from('FriendRequest').select('*')
      .eq('senderId', senderId).eq('receiverId', receiverId).maybeSingle();
    if (!fr) return res.status(404).json({ error: 'No request found' });
    await db.from('FriendRequest').update({ status: 'rejected' }).eq('id', fr.id);
    res.json({ status: 'rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

app.delete('/api/friends/:friendId', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { friendId } = req.params;
  try {
    const [a, b] = [userId, friendId].sort();
    await db.from('Friendship').delete().eq('userAId', a).eq('userBId', b);
    res.json({ status: 'removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

app.get('/api/friends', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const { data: friendships } = await db.from('Friendship').select('*')
      .or(`userAId.eq.${userId},userBId.eq.${userId}`);
    const friendIds = (friendships || []).map((f: any) => (f.userAId === userId ? f.userBId : f.userAId));
    const { data: friends } = friendIds.length
      ? await db.from('User').select('*').in('id', friendIds)
      : { data: [] };
    const { data: incoming } = await db.from('FriendRequest').select('*, sender:User!FriendRequest_senderId_fkey(*)')
      .eq('receiverId', userId).eq('status', 'pending');
    const { data: outgoing } = await db.from('FriendRequest').select('*, receiver:User!FriendRequest_receiverId_fkey(*)')
      .eq('senderId', userId).eq('status', 'pending');
    res.json({ friends: friends || [], incoming: incoming || [], outgoing: outgoing || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

app.get('/api/users/search', authenticateUser, async (req: any, res: any) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  try {
    const { data: users } = await db.from('User').select('*')
      .ilike('username', `%${q}%`).neq('id', req.user.id).limit(20);
    res.json(users || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/friends/status/:userId', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { userId: otherId } = req.params;
  try {
    if (await areFriends(userId, otherId)) return res.json({ status: 'friends' });
    const { data: outgoing } = await db.from('FriendRequest').select('status')
      .eq('senderId', userId).eq('receiverId', otherId).maybeSingle();
    if (outgoing?.status === 'pending') return res.json({ status: 'outgoing' });
    const { data: incoming } = await db.from('FriendRequest').select('status')
      .eq('senderId', otherId).eq('receiverId', userId).maybeSingle();
    if (incoming?.status === 'pending') return res.json({ status: 'incoming' });
    res.json({ status: 'none' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// --- Videos ---
app.get('/api/videos', async (req: any, res: any) => {
  try {
    const { data: videos, error } = await db.from('Video').select('*, Comment(*)').order('createdAt', { ascending: false });
    if (error) throw error;
    res.json(videos || []);
  } catch (error: any) {
    console.error("GET /api/videos error:", error);
    res.status(500).json({ error: "DB Error", detail: error?.message || String(error) });
  }
});

app.post('/api/videos', authenticateUser, upload.single('video'), async (req: any, res: any) => {
  try {
    const { username, title, description } = req.body;
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: 'No file' });

    let aiDescription = description;
    try {
      const prompt = `Rewrite this for a viral video app: ${title} ${description}`;
      const result = await genAI.models.generateContent({ model: "gemini-1.5-flash", contents: prompt });
      aiDescription = result.text || description;
    } catch (e) { console.log("AI skipped", e); }

    const fileName = `${userId}/${Date.now()}-${req.file.originalname}`;
    const { error: uploadError } = await db.storage.from('videos').upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype, upsert: true
    });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = db.storage.from('videos').getPublicUrl(fileName);
    const { data: video, error: insertError } = await db.from('Video').insert({
      userId, username: username || 'Anonymous', title: title || "New Trip",
      description: aiDescription, videoUrl: publicUrl, thumbnailUrl: '/uploads/default-thumb.jpg',
    }).select().single();
    if (insertError) throw insertError;
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
    await incrementCol('Video', 'trips', id, increment);
    await incrementCol('User', 'points', userId, increment > 0 ? 10 : -10);
    const { data: video } = await db.from('Video').select('*').eq('id', id).single();
    if (increment > 0 && video && video.userId !== userId) {
      const { data: voter } = await db.from('User').select('username').eq('id', userId).single();
      await createNotification({
        recipientId: video.userId, actorId: userId, type: 'video_vote', entityId: video.id,
        text: `${voter?.username || 'Someone'} tripped your video "${video.title}"`,
      });
    }
    res.json(video);
  } catch (error) {
    console.error(error);
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
    const { data: existing } = await db.from('Reaction').select('id')
      .eq('videoId', id).eq('userId', userId).eq('type', type).maybeSingle();
    if (existing) {
      await db.from('Reaction').delete().eq('id', existing.id);
    } else {
      await db.from('Reaction').insert({ videoId: id, userId, type });
    }
    const { data: counts } = await db.rpc('get_video_reaction_counts', { vid_id: id });
    const summary: Record<string, number> = {};
    REACTION_TYPES.forEach(t => (summary[t] = 0));
    (counts || []).forEach((c: any) => (summary[c.type] = Number(c.count)));
    const { data: userReactions } = await db.rpc('get_user_video_reactions', { vid_id: id, uid: userId });
    res.json({ summary, userReactions: (userReactions || []).map((r: any) => r.type) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Reaction failed' });
  }
});

app.get('/api/videos/:id/reactions', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const { data: counts } = await db.rpc('get_video_reaction_counts', { vid_id: id });
    const summary: Record<string, number> = {};
    REACTION_TYPES.forEach(t => (summary[t] = 0));
    (counts || []).forEach((c: any) => (summary[c.type] = Number(c.count)));
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
    const { data: existing } = await db.from('Follow').select('id')
      .eq('followerId', followerId).eq('followingId', followingId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Already following' });
    await db.from('Follow').insert({ followerId, followingId });
    await createNotification({
      recipientId: followingId, actorId: followerId, type: 'new_follow', text: `started following you`,
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
    await db.from('Follow').delete().eq('followerId', followerId).eq('followingId', followingId);
    res.json({ status: 'unfollowed' });
  } catch (error) {
    res.status(500).json({ error: 'Unfollow failed' });
  }
});

app.get('/api/follow/status/:userId', authenticateUser, async (req: any, res: any) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;
  try {
    const { data } = await db.from('Follow').select('id')
      .eq('followerId', followerId).eq('followingId', followingId).maybeSingle();
    res.json({ following: !!data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// --- Posts ---
app.get('/api/posts', async (req: any, res: any) => {
  try {
    const { data: posts, error } = await db.from('Post').select('*, Comment(*)').order('createdAt', { ascending: false });
    if (error) throw error;
    res.json(posts || []);
  } catch (error: any) {
    console.error("GET /api/posts error:", error);
    res.status(500).json({ error: 'Failed to load posts', detail: error?.message || String(error) });
  }
});

app.post('/api/posts', authenticateUser, async (req: any, res: any) => {
  const { title, text, category, username } = req.body;
  const userId = req.user.id;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  try {
    const { data: post, error } = await db.from('Post').insert({
      userId,
      username: username || req.user.user_metadata?.username || req.user.email?.split('@')[0] || 'Anonymous',
      title: title || null, text: text.trim(), category: category || null,
    }).select().single();
    if (error) throw error;
    await incrementCol('User', 'points', userId, 10);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Post failed' });
  }
});

app.post('/api/post-comments', authenticateUser, async (req: any, res: any) => {
  const { postId, username, avatar, text, parentId } = req.body;
  const userId = req.user.id;
  if (!postId || !text || !text.trim()) return res.status(400).json({ error: 'postId and text are required' });
  try {
    const { data: comment, error } = await db.from('Comment').insert({
      userId, postId, username, avatar, text: text.trim(), parentId: parentId || null,
    }).select().single();
    if (error) throw error;
    await incrementCol('User', 'points', userId, 5);
    if (parentId) {
      const { data: parent } = await db.from('Comment').select('userId').eq('id', parentId).single();
      if (parent && parent.userId !== userId) {
        await createNotification({ recipientId: parent.userId, actorId: userId, type: 'comment', entityId: postId, text: `${username} replied to your comment` });
      }
    } else {
      const { data: post } = await db.from('Post').select('userId').eq('id', postId).single();
      if (post && post.userId !== userId) {
        await createNotification({ recipientId: post.userId, actorId: userId, type: 'comment', entityId: postId, text: `${username} commented on your post` });
      }
    }
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Comment failed' });
  }
});

app.post('/api/comments', authenticateUser, async (req: any, res: any) => {
  const { videoId, username, avatar, text, parentId } = req.body;
  const userId = req.user.id;
  try {
    const { data: comment, error } = await db.from('Comment').insert({
      userId, videoId, username, avatar, text, parentId: parentId || null,
    }).select().single();
    if (error) throw error;
    await incrementCol('User', 'points', userId, 5);
    if (parentId) {
      const { data: parent } = await db.from('Comment').select('userId').eq('id', parentId).single();
      if (parent && parent.userId !== userId) {
        await createNotification({ recipientId: parent.userId, actorId: userId, type: 'comment', entityId: videoId, text: `${username} replied to your comment` });
      }
    } else {
      const { data: video } = await db.from('Video').select('userId, title').eq('id', videoId).single();
      if (video && video.userId !== userId) {
        await createNotification({ recipientId: video.userId, actorId: userId, type: 'comment', entityId: videoId, text: `${username} commented on your video "${video.title}"` });
      }
    }
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: "Comment failed" });
  }
});

// --- Messages ---
app.get('/api/messages/:u1/:u2', authenticateUser, async (req: any, res: any) => {
  const { u1, u2 } = req.params;
  if (req.user.id !== u1 && req.user.id !== u2) return res.status(403).json({ error: "Unauthorized to view this chat" });
  if (!(await areFriends(u1, u2))) return res.status(403).json({ error: "You can only view chats with friends" });
  try {
    const { data: messages } = await db.from('Message').select('*')
      .or(`senderId.eq.${u1},receiverId.eq.${u1},senderId.eq.${u2},receiverId.eq.${u2}`)
      .order('createdAt', { ascending: true });
    res.json(messages || []);
  } catch (error) {
    res.status(500).json({ error: "Message fetch failed" });
  }
});

app.post('/api/messages', authenticateUser, async (req: any, res: any) => {
  const { receiverId, text } = req.body;
  const senderId = req.user.id;
  try {
    if (!(await areFriends(senderId, receiverId))) return res.status(403).json({ error: 'You can only message friends' });
    const { data: message, error } = await db.from('Message').insert({ senderId, receiverId, text }).select().single();
    if (error) throw error;
    const { data: sender } = await db.from('User').select('username').eq('id', senderId).single();
    await createNotification({ recipientId: receiverId, actorId: senderId, type: 'message', entityId: message.id, text: `New message from ${sender?.username || 'a friend'}` });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Message failed" });
  }
});

app.get('/api/conversations/:id', authenticateUser, async (req: any, res: any) => {
  const { id } = req.params;
  if (req.user.id !== id) return res.status(403).json({ error: "Unauthorized" });
  try {
    const { data: messages } = await db.from('Message').select('*, sender:User!Message_senderId_fkey(*), receiver:User!Message_receiverId_fkey(*)')
      .or(`senderId.eq.${id},receiverId.eq.${id}`).order('createdAt', { ascending: false });
    const seen = new Set<string>();
    const conversations = [];
    for (const msg of messages || []) {
      const sender = (msg as any).sender;
      const receiver = (msg as any).receiver;
      const partner = msg.senderId === id ? receiver : sender;
      if (!partner || seen.has(partner.id)) continue;
      seen.add(partner.id);
      const { sender: _s, receiver: _r, ...lastMessage } = msg as any;
      conversations.push({ user: partner, lastMessage });
    }
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Conversation fetch failed" });
  }
});

// --- Notifications ---
app.get('/api/notifications', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const { data: notifications } = await db.from('Notification').select('*')
      .eq('recipientId', userId).order('createdAt', { ascending: false }).limit(50);
    const unread = (notifications || []).filter(n => !n.read).length;
    res.json({ notifications: notifications || [], unread });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

app.post('/api/notifications/read', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.body;
  try {
    if (id) {
      await db.from('Notification').update({ read: true }).eq('id', id).eq('recipientId', userId);
    } else {
      await db.from('Notification').update({ read: true }).eq('recipientId', userId);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// --- Public profile ---
app.get('/api/users/:id/public', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const { data: user } = await db.from('User').select('id, username, avatar, bio, points, createdAt').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { data: videos } = await db.from('Video').select('*').eq('userId', id).order('createdAt', { ascending: false });
    const { count: followerCount } = await db.from('Follow').select('*', { count: 'exact', head: true }).eq('followingId', id);
    const { count: followingCount } = await db.from('Follow').select('*', { count: 'exact', head: true }).eq('followerId', id);
    res.json({ user, videos: videos || [], followerCount: followerCount || 0, followingCount: followingCount || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// --- Following feed ---
app.get('/api/feed/following', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const { data: follows } = await db.from('Follow').select('followingId').eq('followerId', userId);
    const ids = (follows || []).map(f => f.followingId);
    if (!ids.length) return res.json([]);
    const { data: videos } = await db.from('Video').select('*, Comment(*)')
      .in('userId', ids).order('createdAt', { ascending: false });
    res.json(videos || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load following feed' });
  }
});

// --- Safety ---
app.get('/api/safety/stats', async (req: any, res: any) => {
  try {
    const { count: userCount } = await db.from('User').select('*', { count: 'exact', head: true });
    const { count: videoCount } = await db.from('Video').select('*', { count: 'exact', head: true });
    const { count: reportCount } = await db.from('SafetyReport').select('*', { count: 'exact', head: true });
    res.json({ userCount: userCount || 0, videoCount: videoCount || 0, reportCount: reportCount || 0 });
  } catch (error) {
    res.status(500).send("Error");
  }
});

app.post('/api/safety', authenticateUser, async (req: any, res: any) => {
  try {
    const { data: report, error } = await db.from('SafetyReport').insert(req.body).select().single();
    if (error) throw error;
    res.json(report);
  } catch (error) {
    console.error("Safety Report Error:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

app.get('/api/safety', authenticateUser, adminUser, async (req: any, res: any) => {
  try {
    const { data: reports } = await db.from('SafetyReport').select('*').order('timestamp', { ascending: false });
    res.json(reports || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.delete('/api/safety', authenticateUser, adminUser, async (req: any, res: any) => {
  try {
    await db.from('SafetyReport').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear reports" });
  }
});

// --- 4. START ---
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Trippin' TV Server live at http://localhost:${PORT}`);
});
