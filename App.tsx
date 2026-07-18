
import React, { useState, useEffect, useRef } from 'react';
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
import { User, Video, ViewType, Comment, Message, ReactionType } from './types';
import { supabase } from './src/lib/supabaseClient';

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(false);

  // Supabase Realtime setup
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('app-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.senderId !== user.id) {
          if (currentView !== 'chat') {
            setUnreadChat(true);
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

  useEffect(() => {
    if (currentView === 'chat') {
      setUnreadChat(false);
    }
  }, [currentView]);

  // Initial Data Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, videosRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/videos')
        ]);
        const users = await usersRes.json();
        const videos = await videosRes.json();
        setAllUsers(users);
        setVideos(videos);

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
          const vid = videos.find((v: Video) => v.id === vMatch[1]);
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
    }
  };

  const syncUserFromBackend = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/users?id=${userId}`, {
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
      const res = await fetch(`/api/users/${user.id}`, {
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
      alert(err.message);
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

    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const isVoting = !video.hasVoted;
    const increment = isVoting ? 1 : -1;

    try {
      const token = await getToken();
      const res = await fetch(`/api/videos/${videoId}/vote`, {
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

      const res = await fetch('/api/videos', {
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
      alert(err.message);
    }
  };

  const handleComment = async (videoId: string, commentData: Partial<Comment>, parentId?: string) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const token = await getToken();
      const res = await fetch('/api/comments', {
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
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReact = async (videoId: string, type: ReactionType) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const token = await getToken();
      const res = await fetch(`/api/videos/${videoId}/react`, {
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

  const handleOpenProfile = (userId: string) => {
    setViewUserId(userId);
    setCurrentView('user');
    window.history.pushState({}, '', `/u/${userId}`);
  };

  const handleShare = async (video: Video) => {
    const url = `${window.location.origin}/v/${video.id}`;
    const shareData = {
      title: `Trippin' TV - ${video.title}`,
      text: `Check out this wild trip by @${video.username} on Trippin' TV!`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      } else {
        alert(`Share this link: ${url}`);
      }
    } catch {
      // user cancelled share
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bungee text-purple-500 animate-pulse text-2xl">LOADING TRIPPIN' TV...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
        <Navbar 
          user={user} 
          onAuthClick={() => setIsAuthModalOpen(true)}
          onUploadClick={() => user ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)}
          onViewChange={(v) => { setCurrentView(v as any); if (v !== 'user') setViewUserId(undefined); window.history.pushState({}, '', v === 'feed' ? '/' : `/${v}`); }}
          currentView={currentView as any}
          onLogout={handleLogout}
          unreadChat={unreadChat}
          notificationBell={user ? <NotificationBell onOpen={() => { setCurrentView('notifications'); window.history.pushState({}, '', '/notifications'); }} /> : undefined}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 mb-20 md:mb-0">
          {currentView === 'feed' && (
            <VideoFeed 
              videos={videos} 
              onVote={handleVote} 
              onComment={handleComment}
              onReact={handleReact}
              onOpenProfile={handleOpenProfile}
              onShare={handleShare}
              user={user}
            />
          )}
          {currentView === 'leaderboard' && <Leaderboard videos={videos} />}
          {currentView === 'profile' && user && (
            <ProfileView 
              user={user} 
              videos={videos.filter(v => v.userId === user.id)} 
              onUpdateUser={handleUpdateUser}
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
            <NotificationsView />
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
        </main>

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal 
            onClose={() => setIsAuthModalOpen(false)} 
            onAuthSuccess={handleAuthSuccess} 
          />

        )}

        {/* Upload Modal */}
        {isUploadModalOpen && user && (
          <UploadModal 
            onClose={() => setIsUploadModalOpen(false)} 
            onUpload={handleAddVideo}
            user={user}
          />
        )}

        {/* Disclaimer logic */}
        {user && !user.hasAgreedToDisclaimer && (
          <DisclaimerOverlay onAgree={handleAgreeDisclaimer} />
        )}

        {/* Admin Safety Link (Floating for Demo) */}
        <button 
          onClick={() => setCurrentView('safety')}
          className="fixed bottom-4 right-4 z-[60] bg-red-600/20 hover:bg-red-600 text-[8px] font-black p-2 rounded-full border border-red-600/40 transition-all opacity-20 hover:opacity-100"
        >
          SAFETY LOGS
        </button>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around items-center h-16 z-40">
          <button onClick={() => setCurrentView('feed')} className={`flex flex-col items-center ${currentView === 'feed' ? 'text-purple-500' : 'text-zinc-400'}`}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Home</span>
          </button>
          <button onClick={() => setCurrentView('leaderboard')} className={`flex flex-col items-center ${currentView === 'leaderboard' ? 'text-purple-500' : 'text-zinc-400'}`}>
            <TrophyIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">Winners</span>
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
              {unreadChat && (
                <div className="absolute top-0 right-1/4 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse"></div>
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
const TrophyIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>;
const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const ChatIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const UserPlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v6m3-3h-6m-7.5-3a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM3 19a6 6 0 0112 0" /></svg>;
const BellIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;

export default App;
