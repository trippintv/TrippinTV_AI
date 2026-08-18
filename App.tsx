import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import Leaderboard from './components/Leaderboard';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import ChatView from './components/ChatView';
import FriendsView from './components/FriendsView';
import NotificationBell from './components/NotificationBell';
import NotificationsView from './components/NotificationsView';
import PublicProfileView from './components/PublicProfileView';
import SafetyDashboard from './components/SafetyDashboard';
import DisclaimerOverlay from './components/DisclaimerOverlay';
import PostCard from './components/PostCard';
import PostComposer from './components/PostComposer';
import { SkeletonFeed } from './components/Skeleton';
import SearchOverlay from './components/SearchOverlay';
import VideoGenerator from './components/VideoGenerator';
import Background from './components/Background';
import ShareModal from './components/ShareModal';
import ExploreView from './components/ExploreView';
import UserBadge from './components/UserBadge';
import { User, Video, Post, ViewType, Comment, Message, ReactionType, ReactionSummary } from './types';
import { supabase } from './src/lib/supabaseClient';
import { apiFetch } from './src/lib/api';
import { useToast } from './components/Toast';
import { haptic } from './src/lib/haptic';
import { initializeAdMob, showBanner, hideBanner, showRewardedAd } from './src/lib/admob';

const getToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentView, setCurrentView] = useState<ViewType | 'safety'>('feed');
  const [viewUserId, setViewUserId] = useState<string | undefined>(undefined);
  const [videos, setVideos] = useState<Video[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(0);
  const [postReactions, setPostReactions] = useState<Record<string, ReactionSummary>>({});
  const [postUserReactions, setPostUserReactions] = useState<Record<string, ReactionType[]>>({});
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [newVideosCount, setNewVideosCount] = useState(0);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<string[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [shareVideo, setShareVideo] = useState<Video | null>(null);
  const pendingReferralRef = useRef<string | null>(null);
  const { showToast } = useToast();

  // Supabase Realtime setup
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('app-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.senderId !== user.id) {
          if (currentView !== 'chat') {
            setUnreadChat(prev => prev + 1);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Video' }, (payload) => {
        const updatedVideo = payload.new as Video;
        setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Video' }, (payload) => {
        const newVideo = payload.new as Video;
        setVideos(prev => [newVideo, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentView]);

  // Initialize AdMob on mount
  useEffect(() => {
    initializeAdMob();
  }, []);

  // Show/hide banner ad based on view
  useEffect(() => {
    if (currentView === 'feed' && user) {
      showBanner();
    } else {
      hideBanner();
    }
  }, [currentView, user]);

  useEffect(() => {
    if (currentView === 'chat') {
      setUnreadChat(0);
    }
  }, [currentView]);

  // Initial Data Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, videosRes, postsRes, topicsRes] = await Promise.all([
          apiFetch('/api/users'),
          apiFetch('/api/videos'),
          apiFetch('/api/posts'),
          apiFetch('/api/topics')
        ]);
        const users = await usersRes.json();
        const videosData = await videosRes.json();
        const videoList = videosData.videos || [];
        const postsData = await postsRes.json();
        const postList = postsData.posts || [];
        const topicsData = await topicsRes.json();
        setAllUsers(users);
        setPosts(postList);
        setHasMorePosts(postsData.hasMore);
        setVideos(videoList);
        setHasMoreVideos(videosData.hasMore);
        setTopics((topicsData.topics || []).map((t: any) => t.tag));

        if (postList.length > 0) {
          const postResults = await Promise.all(
            postList.map(async (p: Post) => {
              try {
                const sumRes = await apiFetch(`/api/posts/${p.id}/reactions`);
                const summary = await sumRes.json();
                return { id: p.id, summary };
              } catch { return { id: p.id, summary: {} }; }
            })
          );
          const sumMap: Record<string, ReactionSummary> = {};
          postResults.forEach(r => { sumMap[r.id] = r.summary; });
          setPostReactions(sumMap);
        }

        const savedUser = localStorage.getItem('trippin_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const userInDb = users.find((u: User) => u.username === parsedUser.username);
          if (userInDb) setUser(userInDb);
        }

        // Parse deep links (/v/:id , /u/:id)
        const path = window.location.pathname;
        const vMatch = path.match(/^\/v\/(.+)$/);
        const uMatch = path.match(/^\/u\/(.+)$/);
        if (vMatch) {
          const vid = videoList.find((v: Video) => v.id === vMatch[1]);
          if (vid) { setCurrentView('feed'); /* scroll handled below */ }
        } else if (uMatch) {
          setViewUserId(uMatch[1]);
          setCurrentView('user');
        }
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Referral deep link: /r/:code
  useEffect(() => {
    const rMatch = window.location.pathname.match(/^\/r\/(.+)$/);
    if (!rMatch) return;
    pendingReferralRef.current = decodeURIComponent(rMatch[1]);
    window.history.replaceState({}, '', '/');
    if (!localStorage.getItem('trippin_user')) {
      setIsAuthModalOpen(true);
    }
  }, []);

  // Claim a pending referral code once the user is signed in.
  useEffect(() => {
    if (!user) return;
    const code = pendingReferralRef.current;
    if (!code) return;
    pendingReferralRef.current = null;
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch('/api/referrals/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
          setUser(prev => prev ? { ...prev, credits: data.credits, referredBy: data.referredBy } : null);
          setReferralCount(prev => prev + 1);
          showToast(`+${data.bonus} credits from your invite! 🎉`, 'success');
        } else if (data.error) {
          showToast(data.error, 'error');
        }
      } catch {}
    })();
  }, [user?.id]);

  // Load saved videos, referral info, and refresh topics when the user changes.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getToken();
        const [savedRes, refRes, topicsRes] = await Promise.all([
          apiFetch('/api/videos/saved', { headers: { 'Authorization': `Bearer ${token}` } }),
          apiFetch('/api/referrals', { headers: { 'Authorization': `Bearer ${token}` } }),
          apiFetch('/api/topics'),
        ]);
        if (savedRes.ok) {
          const d = await savedRes.json();
          setSavedVideos(d.videos || []);
          setSavedIds(new Set(d.ids || []));
        }
        if (refRes.ok) {
          const d = await refRes.json();
          setReferralCount(d.referralCount || 0);
        }
        if (topicsRes.ok) {
          const d = await topicsRes.json();
          setTopics((d.topics || []).map((t: any) => t.tag));
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user?.id]);

  // Video polling — detect new videos every 60s
  useEffect(() => {
    if (videos.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/videos?limit=5');
        const data = await res.json();
        const latest = data.videos || [];
        const existingIds = new Set(videos.map(v => v.id));
        const newOnes = latest.filter((v: Video) => !existingIds.has(v.id));
        if (newOnes.length > 0) setNewVideosCount(prev => prev + newOnes.length);
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [videos.length]);

  const loadMorePosts = async () => {
    if (loadingMorePosts || !hasMorePosts || posts.length === 0) return;
    setLoadingMorePosts(true);
    try {
      const last = posts[posts.length - 1];
      const res = await apiFetch(`/api/posts?before=${last.createdAt}`);
      const data = await res.json();
      const newPosts = data.posts || [];
      setPosts(prev => [...prev, ...newPosts]);
      setHasMorePosts(data.hasMore);
      if (newPosts.length > 0) {
        const postResults = await Promise.all(
          newPosts.map(async (p: Post) => {
            try {
              const sumRes = await apiFetch(`/api/posts/${p.id}/reactions`);
              const summary = await sumRes.json();
              return { id: p.id, summary };
            } catch { return { id: p.id, summary: {} }; }
          })
        );
        const sumMap: Record<string, ReactionSummary> = {};
        postResults.forEach(r => { sumMap[r.id] = r.summary; });
        setPostReactions(prev => ({ ...prev, ...sumMap }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const loadMoreVideos = async () => {
    if (loadingMoreVideos || !hasMoreVideos || videos.length === 0) return;
    setLoadingMoreVideos(true);
    try {
      const last = videos[videos.length - 1];
      let url = `/api/videos?before=${last.createdAt}`;
      if (activeTopic) url += `&tag=${encodeURIComponent(activeTopic)}`;
      const res = await apiFetch(url);
      const data = await res.json();
      setVideos(prev => [...prev, ...(data.videos || [])]);
      setHasMoreVideos(data.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreVideos(false);
    }
  };

  // Handle browser back/forward for deep links
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      const uMatch = path.match(/^\/u\/(.+)$/);
      if (uMatch) {
        setViewUserId(uMatch[1]);
        setCurrentView('user');
      } else if (!path.match(/^\/v\//)) {
        setCurrentView('feed');
        setViewUserId(undefined);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleAuthSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await syncUserFromBackend(session.user.id);
      setIsAuthModalOpen(false);
      // Daily login credit bonus
      const lastLogin = localStorage.getItem('trippin_last_login');
      const today = new Date().toDateString();
      if (lastLogin !== today) {
        localStorage.setItem('trippin_last_login', today);
        try {
          const cr = await apiFetch('/api/credits/earn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'daily_login' }),
          });
          if (cr.ok) {
            const { credits, streakDays } = await cr.json();
            setUser(prev => prev ? { ...prev, credits, streakDays: streakDays ?? prev.streakDays } : null);
            if (streakDays && streakDays > 1) {
              showToast(`${streakDays}-day streak! 🔥`, 'success');
            } else {
              showToast('+5 daily credits!', 'success');
            }
          }
        } catch {}
      }
    }
  };

  const syncUserFromBackend = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await apiFetch(`/api/users?id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to sync user');
      }

      const users = await res.json();
      const foundUser = Array.isArray(users) ? users[0] : users;
      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem('trippin_user', JSON.stringify(foundUser));
      }
    } catch (err) {
      console.error("User sync failed", err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await syncUserFromBackend(session.user.id);
      } else {
        setUser(null);
        localStorage.removeItem('trippin_user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Native deep-link handler for Google OAuth: trippintv://auth/callback?code=...
  // Completes the PKCE exchange started by AuthModal and returns the user to the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = async (event: { url: string }) => {
      const url = event.url;
      if (!url.includes('/auth/callback')) return;

      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (parsed.hash) {
          // Fallback: implicit tokens in the fragment (#access_token=...)
          const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            if (error) throw error;
          }
        }
      } catch (err) {
        console.error('OAuth callback failed', err);
      }
    };

    CapacitorApp.addListener('appUrlOpen', handler);
    return () => { CapacitorApp.removeAllListeners().catch(() => {}); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('trippin_user');
    setCurrentView('feed');
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      const updatedUser = await res.json();
      setUser(updatedUser);
      setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      localStorage.setItem('trippin_user', JSON.stringify(updatedUser));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAgreeDisclaimer = () => {
    handleUpdateUser({ hasAgreedToDisclaimer: true });
  };

  const handleVote = async (videoId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    haptic('medium');

    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const isVoting = !video.hasVoted;
    const increment = isVoting ? 1 : -1;

    try {
      const token = await getToken();
      const res = await apiFetch(`/api/videos/${videoId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ increment })
      });
      const updatedVideo = await res.json();
      
      setVideos(prev => prev.map(v => 
        v.id === videoId 
          ? { ...updatedVideo, hasVoted: isVoting } 
          : v
      ));

      // Update local points
      setUser(prev => prev ? { ...prev, points: Math.max(0, prev.points + (isVoting ? 10 : -10)) } : null);

      // Earn credits for voting
      if (isVoting) {
        try {
          const cr = await apiFetch('/api/credits/earn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'vote' }),
          });
          if (cr.ok) {
            const { credits } = await cr.json();
            setUser(prev => prev ? { ...prev, credits } : null);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Vote failed", err);
    }
  };

  const handleAddVideo = async (newVideo: Omit<Video, 'id' | 'createdAt' | 'trips' | 'comments'>, file?: File) => {
    try {
      if (!file) {
        throw new Error("A video file is required");
      }
      const token = await getToken();
      const formData = new FormData();
      formData.append('video', file);
      formData.append('username', newVideo.username);
      formData.append('title', newVideo.title);
      formData.append('description', newVideo.description);

      const res = await apiFetch('/api/videos', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Post failed");
      }
      const video = await res.json();
      setVideos([video, ...videos]);
      setIsUploadModalOpen(false);
      // Update local points
      setUser(prev => prev ? { ...prev, points: (prev.points || 0) + 50 } : null);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleComment = async (videoId: string, commentData: Partial<Comment>, parentId?: string) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    haptic('light');
    try {
      const token = await getToken();
      const res = await apiFetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...commentData,
          videoId,
          parentId,
          username: user.username,
          avatar: user.avatar
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Comment failed");
      }
      const newComment = await res.json();
      setVideos(prev => prev.map(v =>
        v.id === videoId ? { ...v, comments: [...(v.comments || []), newComment] } : v
      ));
      setUser(prev => prev ? { ...prev, points: prev.points + 5 } : null);
      // Earn credits for commenting
      try {
        const cr = await apiFetch('/api/credits/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'comment' }),
        });
        if (cr.ok) { const { credits } = await cr.json(); setUser(prev => prev ? { ...prev, credits } : null); }
      } catch {}
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddPost = async (postData: { title?: string; text: string; category?: string }) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const token = await getToken();
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...postData, username: user.username })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Post failed');
      }
      const post = await res.json();
      setPosts([post, ...posts]);
      setIsPostComposerOpen(false);
      setUser(prev => prev ? { ...prev, points: (prev.points || 0) + 10 } : null);
      // Earn credits for posting
      try {
        const cr = await apiFetch('/api/credits/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'post' }),
        });
        if (cr.ok) { const { credits } = await cr.json(); setUser(prev => prev ? { ...prev, credits } : null); }
      } catch {}
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePostComment = async (postId: string, commentData: Partial<Comment>, parentId?: string) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const token = await getToken();
      const res = await apiFetch('/api/post-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...commentData,
          postId,
          parentId,
          username: user.username,
          avatar: user.avatar
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Comment failed');
      }
      const newComment = await res.json();
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p
      ));
      setUser(prev => prev ? { ...prev, points: prev.points + 5 } : null);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleReact = async (videoId: string, type: ReactionType) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    haptic('medium');
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/videos/${videoId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        const data = await res.json();
        setVideos(prev => prev.map(v =>
          v.id === videoId ? { ...v, reactionSummary: data.summary, userReactions: data.userReactions } : v
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostReact = async (postId: string, type: ReactionType) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/posts/${postId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        const data = await res.json();
        setPostReactions(prev => ({ ...prev, [postId]: data.summary }));
        setPostUserReactions(prev => ({ ...prev, [postId]: data.userReactions }));
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, reactionSummary: data.summary, userReactions: data.userReactions } : p
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenProfile = (userId: string) => {
    setViewUserId(userId);
    setCurrentView('user');
    window.history.pushState({}, '', `/u/${userId}`);
  };

  const handleShare = async (video: Video) => {
    setShareVideo(video);
  };

  const handleOpenUsername = async (username: string) => {
    const target = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (target) {
      handleOpenProfile(target.id);
      return;
    }
    try {
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(username)}`);
      if (res.ok) {
        const results = await res.json();
        const match = results.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
        if (match) { handleOpenProfile(match.id); return; }
      }
    } catch {}
    showToast(`Couldn't find @${username}`, 'info');
  };

  const handleSelectTopic = async (tag: string | null) => {
    setActiveTopic(tag);
    setCurrentView('feed');
    window.history.pushState({}, '', '/');
    try {
      const res = await apiFetch(`/api/videos${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`);
      const data = await res.json();
      setVideos(data.videos || []);
      setHasMoreVideos(data.hasMore);
    } catch (err) {
      console.error(err);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSave = async (videoId: string) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    haptic('light');
    const isSaved = savedIds.has(videoId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(videoId); else next.add(videoId);
      return next;
    });
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/videos/${videoId}/save`, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Save failed');
      const savedRes = await apiFetch('/api/videos/saved', { headers: { 'Authorization': `Bearer ${token}` } });
      if (savedRes.ok) {
        const d = await savedRes.json();
        setSavedVideos(d.videos || []);
        setSavedIds(new Set(d.ids || []));
      }
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(videoId); else next.delete(videoId);
        return next;
      });
      showToast('Failed to save', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 md:px-8 py-3 flex justify-between items-center">
          <div className="skeleton w-10 h-10 rounded-full" />
          <div className="flex gap-3">
            <div className="skeleton h-8 w-20 rounded-full" />
            <div className="skeleton h-8 w-20 rounded-full" />
          </div>
        </div>
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4">
          <SkeletonFeed />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
        <Background />
        <Navbar 
          user={user} 
          onAuthClick={() => setIsAuthModalOpen(true)}
          onUploadClick={() => user ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)}
          onViewChange={(v) => { setCurrentView(v as any); if (v !== 'user') setViewUserId(undefined); window.history.pushState({}, '', v === 'feed' ? '/' : `/${v}`); }}
          currentView={currentView as any}
          onLogout={handleLogout}
          unreadChat={unreadChat}
          onSearchClick={() => setIsSearchOpen(true)}
          notificationBell={user ? <NotificationBell onOpen={() => { setCurrentView('notifications'); window.history.pushState({}, '', '/notifications'); }} onNavigate={(view, userId) => { setCurrentView(view as any); if (userId) setViewUserId(userId); window.history.pushState({}, '', userId ? `/u/${userId}` : `/${view}`); }} /> : undefined}
        />

        {isSearchOpen && (
          <SearchOverlay
            onClose={() => setIsSearchOpen(false)}
            onOpenProfile={handleOpenProfile}
            onSelectVideo={(id) => { setCurrentView('feed'); setIsSearchOpen(false); }}
            allUsers={allUsers}
            currentUser={user}
          />
        )}

        <main key={currentView} className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 mb-20 md:mb-0 view-enter">
          {currentView === 'feed' && (
            <>
              {newVideosCount > 0 && (
                <button
                  onClick={async () => {
                    try { const res = await apiFetch(`/api/videos${activeTopic ? `?tag=${encodeURIComponent(activeTopic)}` : ''}`); const data = await res.json(); setVideos(data.videos || []); setHasMoreVideos(data.hasMore); } catch {} setNewVideosCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full mb-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-full text-purple-400 text-xs font-bold hover:bg-purple-600/30 transition-all animate-banner-slide-down"
                >
                  {newVideosCount} new video{newVideosCount > 1 ? 's' : ''} — tap to refresh
                </button>
              )}
              {user && (
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setIsGeneratorOpen(true)}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl text-sm font-bold text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">🎬</span>
                    Generate with AI
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 rounded-full px-2 py-0.5">{user.credits} credits</span>
                  </button>
                  <button
                    onClick={async () => {
                      const earned = await showRewardedAd();
                      if (earned) {
                        const token = await getToken();
                        if (token) {
                          const cr = await apiFetch('/api/credits/earn', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ action: 'ad' }),
                          });
                          if (cr.ok) {
                            const { credits } = await cr.json();
                            setUser(prev => prev ? { ...prev, credits } : null);
                            showToast('+5 credits earned!', 'success');
                          }
                        }
                      }
                    }}
                    className="py-3 px-4 bg-green-600/20 border border-green-500/30 rounded-2xl text-sm font-bold text-green-400 hover:bg-green-600/30 transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    🎬 +5
                  </button>
                </div>
              )}
              <VideoFeed 
                videos={videos} 
                onVote={handleVote} 
                onComment={handleComment}
                onReact={handleReact}
                onOpenProfile={handleOpenProfile}
                onShare={handleShare}
                onToggleSave={handleToggleSave}
                onOpenUsername={handleOpenUsername}
                onSelectTopic={handleSelectTopic}
                topics={topics}
                activeTopic={activeTopic}
                savedIds={savedIds}
                user={user}
                hasMore={hasMoreVideos}
                loadingMore={loadingMoreVideos}
                onLoadMore={loadMoreVideos}
                onRefresh={() => { setIsLoading(true); window.location.reload(); }}
              />
            </>
          )}
          {currentView === 'leaderboard' && <Leaderboard videos={videos} />}
          {currentView === 'posts' && (
            <div className="flex flex-col items-center gap-8 py-4">
              {user && (
                <button
                  onClick={() => setIsPostComposerOpen(true)}
                  className="w-full max-w-[420px] bg-zinc-900 border border-dashed border-purple-500/50 rounded-3xl py-4 text-zinc-400 hover:text-white hover:border-purple-500 transition-all text-sm font-bold"
                >
                  + Share a trippin' story (no video needed)
                </button>
              )}
              {posts.length === 0 ? (
                <div className="text-center py-20 max-w-[420px]">
                  <p className="text-zinc-500 text-lg">No posts yet.</p>
                  <p className="text-zinc-600 text-sm mt-2">Be the first to post something wild!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onComment={handlePostComment}
                    onOpenProfile={handleOpenProfile}
                    onShare={handleShare as any}
                    onReact={handlePostReact}
                    onOpenUsername={handleOpenUsername}
                    onSelectTopic={handleSelectTopic}
                    user={user}
                  />
                ))
              )}
              {hasMorePosts && posts.length > 0 && (
                <button
                  onClick={loadMorePosts}
                  disabled={loadingMorePosts}
                  className="text-xs text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors py-4"
                >
                  {loadingMorePosts ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}
          {currentView === 'profile' && user && (
            <ProfileView 
              user={user} 
              videos={videos.filter(v => v.userId === user.id)} 
              onUpdateUser={handleUpdateUser}
              savedVideos={savedVideos}
              referralCount={referralCount}
            />
          )}
          {currentView === 'chat' && user && (
            <ChatView 
              currentUser={user}
              allUsers={allUsers}
            />
          )}
          {currentView === 'friends' && user && (
            <FriendsView currentUser={user} />
          )}
          {currentView === 'notifications' && user && (
            <NotificationsView onNavigate={(view, userId) => { setCurrentView(view as any); if (userId) setViewUserId(userId); window.history.pushState({}, '', userId ? `/u/${userId}` : `/${view}`); }} />
          )}
          {currentView === 'user' && viewUserId && (
            <PublicProfileView 
              userId={viewUserId}
              currentUser={user}
              onVote={handleVote}
              onComment={handleComment}
              onReact={handleReact}
              onOpenProfile={handleOpenProfile}
              onShare={handleShare}
            />
          )}
          {currentView === 'safety' && <SafetyDashboard />}
          {currentView === 'explore' && (
            <ExploreView
              onVote={handleVote}
              onComment={handleComment}
              onReact={handleReact}
              onOpenProfile={handleOpenProfile}
              onShare={handleShare}
              user={user}
              onOpenUsername={handleOpenUsername}
              onSelectTopic={handleSelectTopic}
            />
          )}
        </main>

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal 
            onClose={() => setIsAuthModalOpen(false)} 
            onAuthSuccess={handleAuthSuccess} 
          />
        )}

        {/* Share Modal */}
        {shareVideo && (
          <ShareModal video={shareVideo} onClose={() => setShareVideo(null)} />
        )}

        {/* Upload Modal */}
        {isUploadModalOpen && user && (
          <UploadModal 
            onClose={() => setIsUploadModalOpen(false)} 
            onUpload={handleAddVideo}
            user={user}
          />
        )}

        {/* Post Composer */}
        {isPostComposerOpen && user && (
          <PostComposer
            onClose={() => setIsPostComposerOpen(false)}
            onPost={handleAddPost}
            user={user}
          />
        )}

        {/* AI Video Generator */}
        {isGeneratorOpen && user && (
          <VideoGenerator
            user={user}
            onClose={() => setIsGeneratorOpen(false)}
            onVideoCreated={(video) => {
              setVideos([video, ...videos]);
              user.credits -= 5;
              setIsGeneratorOpen(false);
              setCurrentView('feed');
              window.history.pushState({}, '', '/');
              showToast('AI video generated and submitted!', 'success');
            }}
            getToken={getToken}
          />
        )}

        {/* Disclaimer logic */}
        {user && !user.hasAgreedToDisclaimer && (
          <DisclaimerOverlay onAgree={handleAgreeDisclaimer} />
        )}

        {/* Admin Safety Link (Floating for Demo) */}
        <button 
          onClick={() => setCurrentView('safety')}
          className="fixed bottom-20 right-4 md:bottom-4 z-[60] bg-red-600/20 hover:bg-red-600 text-[8px] font-black p-2 rounded-full border border-red-600/40 transition-all opacity-20 hover:opacity-100"
        >
          SAFETY LOGS
        </button>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around items-center h-16 z-40">
          <button onClick={() => setCurrentView('feed')} className={`flex flex-col items-center ${currentView === 'feed' ? 'text-purple-500' : 'text-zinc-400'}`}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Home</span>
          </button>
          <button onClick={() => setIsSearchOpen(true)} className="flex flex-col items-center text-zinc-400">
            <SearchIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Search</span>
          </button>
          <button onClick={() => setCurrentView('explore')} className={`flex flex-col items-center ${currentView === 'explore' ? 'text-purple-500' : 'text-zinc-400'}`}>
            <CompassIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Explore</span>
          </button>
          <button onClick={() => user ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)} className="flex flex-col items-center text-zinc-400">
            <div className="bg-purple-600 rounded-lg p-1 text-white -mt-4 border-4 border-black shadow-lg">
              <PlusIcon className="w-6 h-6" />
            </div>
            <span className="text-[10px] mt-1">Upload</span>
          </button>
          <button onClick={() => user ? setCurrentView('profile') : setIsAuthModalOpen(true)} className={`flex flex-col items-center ${currentView === 'profile' ? 'text-purple-500' : 'text-zinc-400'}`}>
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Profile</span>
          </button>
          {user && (
            <button onClick={() => setCurrentView('chat')} className={`flex flex-col items-center relative ${currentView === 'chat' ? 'text-purple-500' : 'text-zinc-400'}`}>
              <ChatIcon className="w-6 h-6" />
              <span className="text-[10px] mt-1">Chat</span>
              {unreadChat > 0 && (
                <span className="absolute -top-0.5 right-0 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center border border-black animate-pulse">
                  {unreadChat > 99 ? '99+' : unreadChat}
                </span>
              )}
            </button>
          )}
          {user && (
            <button onClick={() => setCurrentView('friends')} className={`flex flex-col items-center ${currentView === 'friends' ? 'text-purple-500' : 'text-zinc-400'}`}>
              <UserPlusIcon className="w-6 h-6" />
              <span className="text-[10px] mt-1">Friends</span>
            </button>
          )}
          {user && (
            <button onClick={() => setCurrentView('notifications')} className={`flex flex-col items-center ${currentView === 'notifications' ? 'text-purple-500' : 'text-zinc-400'}`}>
              <BellIcon className="w-6 h-6" />
              <span className="text-[10px] mt-1">Alerts</span>
            </button>
          )}
        </div>
    </div>
  );
};

// Simple Icons
const HomeIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const SearchIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const CompassIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
const TrophyIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>;
const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const PostIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" /></svg>;
const UserIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const ChatIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const UserPlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v6m3-3h-6m-7.5-3a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM3 19a6 6 0 0112 0" /></svg>;
const BellIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;

export default App;
