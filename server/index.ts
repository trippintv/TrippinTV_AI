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
    const { username, ...rest } = req.body;

    if (username !== undefined) {
      if (typeof username !== 'string' || !username.trim() || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3-20 characters' });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }
      const clean = username.trim();
      // Case-insensitive uniqueness check
      const { data: existing } = await db.from('User').select('id')
        .ilike('username', clean).neq('id', id).maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'That username is already taken' });
      }
      rest.username = clean;

      // Cascade username to all of the user's content
      const userId = req.user.id;
      await db.from('Video').update({ username: clean }).eq('userId', userId);
      await db.from('Post').update({ username: clean }).eq('userId', userId);
      await db.from('Comment').update({ username: clean }).eq('userId', userId);
    }

    const { data: user, error } = await db.from('User').update(rest).eq('id', id).select().single();
    if (error) throw error;
    res.json(user);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    console.error('User update failed:', err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.get('/api/users/check-username', async (req: any, res: any) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string') return res.status(400).json({ available: false });
  try {
    const { data, error } = await db.from('User').select('id').ilike('username', username.trim()).maybeSingle();
    if (error) throw error;
    res.json({ available: !data });
  } catch {
    res.json({ available: false });
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
    const { data: sender } = await db.from('User').select('username').eq('id', senderId).single();
    await createNotification({
      recipientId: receiverId, actorId: senderId, type: 'friend_request',
      text: `${sender?.username || 'Someone'} sent you a friend request`,
    });
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
  const { before, limit: limitParam } = req.query;
  const pageSize = Math.min(parseInt(limitParam as string) || 20, 50);
  try {
    let query = db.from('Video').select('*, Comment(*)').order('createdAt', { ascending: false }).limit(pageSize + 1);
    if (before) query = query.lt('createdAt', before);
    const { data: videos, error } = await query;
    if (error) throw error;
    const hasMore = (videos || []).length > pageSize;
    const items = (videos || []).slice(0, pageSize);
    res.json({ videos: items, hasMore });
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

// --- AI-Generated Video Submission (URL-based, no file upload) ---
app.post('/api/videos/from-url', authenticateUser, async (req: any, res: any) => {
  try {
    const { videoUrl, title, description } = req.body;
    if (!videoUrl || !title) return res.status(400).json({ error: 'videoUrl and title are required' });

    const userId = req.user.id;
    const { data: userProfile } = await db.from('User').select('username').eq('id', userId).single();

    const { data: video, error: insertError } = await db.from('Video').insert({
      userId,
      username: userProfile?.username || 'Anonymous',
      title,
      description: description || '',
      videoUrl,
      thumbnailUrl: '/uploads/default-thumb.jpg',
    }).select().single();
    if (insertError) throw insertError;

    // Award 3 credits for posting
    const { data: user } = await db.from('User').select('credits, points').eq('id', userId).single();
    if (user) {
      await db.from('User').update({ credits: (user.credits || 0) + 3, points: (user.points || 0) + 50 }).eq('id', userId);
    }

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
  const { before, limit: limitParam } = req.query;
  const pageSize = Math.min(parseInt(limitParam as string) || 20, 50);
  try {
    let query = db.from('Post').select('*, Comment(*)').order('createdAt', { ascending: false }).limit(pageSize + 1);
    if (before) query = query.lt('createdAt', before);
    const { data: posts, error } = await query;
    if (error) throw error;
    const hasMore = (posts || []).length > pageSize;
    const items = (posts || []).slice(0, pageSize);
    res.json({ posts: items, hasMore });
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

app.post('/api/posts/:id/react', authenticateUser, async (req: any, res: any) => {
  const { id: postId } = req.params;
  const { type } = req.body;
  const userId = req.user.id;
  if (!REACTION_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid reaction type' });
  try {
    const { data: existing } = await db.from('ReactionOnPost')
      .select('id').eq('postId', postId).eq('userId', userId).eq('type', type).maybeSingle();
    if (existing) {
      await db.from('ReactionOnPost').delete().eq('id', existing.id);
    } else {
      await db.from('ReactionOnPost').insert({ postId, userId, type });
      const { data: post } = await db.from('Post').select('userId, username').eq('id', postId).single();
      if (post && post.userId !== userId) {
        const emoji = type === 'fire' ? '🔥' : type === 'laugh' ? '😂' : type === 'skull' ? '💀' : type === 'heart' ? '❤️' : '👀';
        await createNotification({ recipientId: post.userId, actorId: userId, type: 'video_vote', entityId: postId, text: `${req.user.user_metadata?.username || 'Someone'} reacted ${emoji} to your post` });
      }
    }
    const { data: counts } = await db.rpc('get_post_reaction_counts', { post_id: postId });
    const { data: userReactions } = await db.rpc('get_user_post_reactions', { post_id: postId, uid: userId });
    const summary = (counts || []).reduce((acc: any, r: any) => { acc[r.type] = Number(r.count); return acc; }, {});
    const userReacts = (userReactions || []).map((r: any) => r.type);
    res.json({ summary, userReactions: userReacts });
  } catch (error) {
    res.status(500).json({ error: 'Reaction failed' });
  }
});

app.get('/api/posts/:id/reactions', async (req: any, res: any) => {
  const { id: postId } = req.params;
  try {
    const { data: counts } = await db.rpc('get_post_reaction_counts', { post_id: postId });
    const summary = (counts || []).reduce((acc: any, r: any) => { acc[r.type] = Number(r.count); return acc; }, {});
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reactions' });
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
  const { before, limit: limitParam } = req.query;
  const pageSize = Math.min(parseInt(limitParam as string) || 50, 100);
  if (req.user.id !== u1 && req.user.id !== u2) return res.status(403).json({ error: "Unauthorized to view this chat" });
  if (!(await areFriends(u1, u2))) return res.status(403).json({ error: "You can only view chats with friends" });
  try {
    let query = db.from('Message').select('*')
      .or(`senderId.eq.${u1},receiverId.eq.${u1},senderId.eq.${u2},receiverId.eq.${u2}`)
      .order('createdAt', { ascending: false }).limit(pageSize + 1);
    if (before) query = query.lt('createdAt', before);
    const { data: messages } = await query;
    const hasMore = (messages || []).length > pageSize;
    const items = (messages || []).slice(0, pageSize).reverse();
    res.json({ messages: items, hasMore });
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
    const convsWithUnread = await Promise.all(conversations.map(async (conv) => {
      const { count } = await db.from('Message')
        .select('*', { count: 'exact', head: true })
        .eq('senderId', conv.user.id).eq('receiverId', id).is('readAt', null);
      return { ...conv, unreadCount: count || 0 };
    }));
    res.json(convsWithUnread);
  } catch (error) {
    res.status(500).json({ error: "Conversation fetch failed" });
  }
});

app.post('/api/messages/mark-read', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ error: 'senderId is required' });
  try {
    await db.from('Message')
      .update({ readAt: new Date().toISOString() })
      .eq('senderId', senderId).eq('receiverId', userId).is('readAt', null);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark messages read' });
  }
});

// --- Notifications ---
app.get('/api/notifications', authenticateUser, async (req: any, res: any) => {
  const userId = req.user.id;
  const { before, limit: limitParam } = req.query;
  const pageSize = Math.min(parseInt(limitParam as string) || 20, 50);
  try {
    let query = db.from('Notification')
      .select('*, actor:User!Notification_actorId_fkey(id, username, avatar)')
      .eq('recipientId', userId).order('createdAt', { ascending: false }).limit(pageSize + 1);
    if (before) query = query.lt('createdAt', before);
    const { data: notifications } = await query;
    const hasMore = (notifications || []).length > pageSize;
    const items = (notifications || []).slice(0, pageSize);
    const unreadRes = await db.from('Notification').select('*', { count: 'exact', head: true })
      .eq('recipientId', userId).eq('read', false);
    const unread = unreadRes.count || 0;
    res.json({ notifications: items, unread, hasMore });
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

// --- CREDITS SYSTEM ---

// Earn credits for an action
app.post('/api/credits/earn', authenticateUser, async (req: any, res: any) => {
  const { action } = req.body;
  const amounts: Record<string, number> = {
    vote: 1,
    comment: 2,
    post: 3,
    daily_login: 5,
    referral: 10,
  };
  const amount = amounts[action];
  if (!amount) return res.status(400).json({ error: 'Unknown action' });

  try {
    const { data: user, error: fetchErr } = await db.from('User').select('credits').eq('id', req.userId).single();
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found' });

    const newCredits = (user.credits || 0) + amount;
    const { error: updateErr } = await db.from('User').update({ credits: newCredits }).eq('id', req.userId);
    if (updateErr) throw updateErr;

    res.json({ credits: newCredits, earned: amount, action });
  } catch (err) {
    console.error('Credit earn error:', err);
    res.status(500).json({ error: 'Failed to earn credits' });
  }
});

// --- AI VIDEO GENERATION (Replicate) ---

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

app.post('/api/generate-video', authenticateUser, async (req: any, res: any) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (prompt.length > 500) {
    return res.status(400).json({ error: 'Prompt must be 500 characters or less' });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(503).json({ error: 'AI video generation is not configured yet. Admin needs to set REPLICATE_API_TOKEN.' });
  }

  try {
    // Check credits
    const { data: user } = await db.from('User').select('credits').eq('id', req.userId).single();
    if (!user || (user.credits || 0) < 5) {
      return res.status(403).json({ error: 'Not enough credits. You need 5 credits to generate a video.' });
    }

    // Deduct credits
    const newCredits = user.credits - 5;
    await db.from('User').update({ credits: newCredits }).eq('id', req.userId);

    // Create prediction via Replicate API
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Google Veo 3 — text-to-video, supports 9:16 portrait + audio
        version: '5e80c73750ffc5dfbe5cee2d694c6ed3da7706660d9132613e6736443b365464',
        input: {
          prompt: prompt.trim(),
          duration: 6,
          aspect_ratio: '9:16',
          resolution: '720p',
          generate_audio: true,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Replicate API error:', err);
      // Refund credits on failure
      await db.from('User').update({ credits: user.credits }).eq('id', req.userId);
      return res.status(502).json({ error: 'Video generation service error. Credits refunded.' });
    }

    const prediction = await response.json();
    res.json({ predictionId: prediction.id, status: prediction.status, credits: newCredits });
  } catch (err) {
    console.error('Generate video error:', err);
    res.status(500).json({ error: 'Failed to start video generation' });
  }
});

// Poll generation status
app.get('/api/generate-video/:predictionId', authenticateUser, async (req: any, res: any) => {
  const { predictionId } = req.params;
  if (!REPLICATE_API_TOKEN) {
    return res.status(503).json({ error: 'Not configured' });
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    });
    const prediction = await response.json();

    if (prediction.status === 'succeeded') {
      res.json({
        status: 'succeeded',
        videoUrl: prediction.output,
      });
    } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
      // Refund credits
      const { data: user } = await db.from('User').select('credits').eq('id', req.userId).single();
      if (user) {
        await db.from('User').update({ credits: (user.credits || 0) + 5 }).eq('id', req.userId);
      }
      res.json({ status: prediction.status, error: prediction.error, credits: (user?.credits || 0) + 5 });
    } else {
      res.json({ status: prediction.status });
    }
  } catch (err) {
    console.error('Poll generation error:', err);
    res.status(500).json({ error: 'Failed to check generation status' });
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
