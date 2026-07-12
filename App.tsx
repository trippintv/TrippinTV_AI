
import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import Leaderboard from './components/Leaderboard';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import ChatView from './components/ChatView';
import SafetyDashboard from './components/SafetyDashboard';
import DisclaimerOverlay from './components/DisclaimerOverlay';
import { User, Video, ViewType, Comment, Message } from './types';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { io, Socket } from 'socket.io-client';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentView, setCurrentView] = useState<ViewType | 'safety'>('feed');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  // Socket setup
  useEffect(() => {
    if (user) {
      const socket = io(window.location.origin.replace('3000', '3001'));
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join', user.id);
      });

      socket.on('message', (msg: Message) => {
        if (currentView !== 'chat' && msg.senderId !== user.id) {
          setUnreadChat(true);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
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
          // Refresh user data from DB
          const userInDb = users.find((u: User) => u.username === parsedUser.username);
          if (userInDb) setUser(userInDb);
        }
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAuth = async (username: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      setUser(data);
      localStorage.setItem('trippin_user', JSON.stringify(data));
      setIsAuthModalOpen(false);
      // Refresh user list
      const usersRes = await fetch('/api/users');
      setAllUsers(await usersRes.json());
    } catch (err) {
      alert("Auth failed");
    }
  };

  const handleGoogleAuth = (userData: User) => {
    setUser(userData);
    localStorage.setItem('trippin_user', JSON.stringify(userData));
    setIsAuthModalOpen(false);
    // Refresh user list
    fetch('/api/users')
      .then(res => res.json())
      .then(users => setAllUsers(users));
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('trippin_user');
    setCurrentView('feed');
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
      const res = await fetch(`/api/videos/${videoId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, increment })
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
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('userId', newVideo.userId);
        formData.append('username', newVideo.username);
        formData.append('title', newVideo.title);
        formData.append('description', newVideo.description);
        
        res = await fetch('/api/videos', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newVideo)
        });
      }

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

  const handleComment = async (videoId: string, commentData: Partial<Comment>) => {
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commentData,
          videoId,
          userId: user.id,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bungee text-purple-500 animate-pulse text-2xl">LOADING TRIPPIN' TV...</div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Navbar 
          user={user} 
          onAuthClick={() => setIsAuthModalOpen(true)}
          onUploadClick={() => user ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)}
          onViewChange={(v) => setCurrentView(v as any)}
          currentView={currentView as any}
          onLogout={handleLogout}
          unreadChat={unreadChat}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 mb-20 md:mb-0">
          {currentView === 'feed' && (
            <VideoFeed 
              videos={videos} 
              onVote={handleVote} 
              onComment={handleComment}
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
          {currentView === 'safety' && <SafetyDashboard />}
        </main>

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal 
            onClose={() => setIsAuthModalOpen(false)} 
            onLogin={handleAuth} 
            onGoogleLogin={handleGoogleAuth}
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
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

// Simple Icons
const HomeIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const TrophyIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>;
const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const ChatIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;

export default App;
