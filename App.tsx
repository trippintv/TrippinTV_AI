
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import Leaderboard from './components/Leaderboard';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import DisclaimerOverlay from './components/DisclaimerOverlay';
import { User, Video, ViewType } from './types';

const INITIAL_VIDEOS: Video[] = [
  {
    id: '1',
    userId: 'u1',
    username: 'skater_boi',
    title: 'Gravity left the chat',
    description: 'Bro really thought he could jump that gap.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/trip1/400/600',
    trips: 1242,
    comments: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: 'u2',
    username: 'funny_moments',
    title: 'Grocery store madness',
    description: 'This lady is absolutely trippin over a coupon.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/trip2/400/600',
    trips: 843,
    comments: [],
    createdAt: new Date().toISOString(),
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('feed');
  const [videos, setVideos] = useState<Video[]>(INITIAL_VIDEOS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Auto-login for demo purposes or local storage check
  useEffect(() => {
    const savedUser = localStorage.getItem('trippin_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAuth = (username: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isLoggedIn: true,
      hasAgreedToDisclaimer: false,
      points: 150, // Start with some bonus points
    };
    setUser(newUser);
    localStorage.setItem('trippin_user', JSON.stringify(newUser));
    setIsAuthModalOpen(false);
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('trippin_user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('trippin_user');
    setCurrentView('feed');
  };

  const handleAgreeDisclaimer = () => {
    if (user) {
      handleUpdateUser({ hasAgreedToDisclaimer: true });
    }
  };

  const handleVote = (videoId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const isVoting = !video.hasVoted;
    
    setVideos(prev => prev.map(v => 
      v.id === videoId 
        ? { ...v, trips: v.hasVoted ? v.trips - 1 : v.trips + 1, hasVoted: !v.hasVoted } 
        : v
    ));

    // Reward user for "Tripping" on a video
    const pointChange = isVoting ? 10 : -10;
    handleUpdateUser({ points: Math.max(0, user.points + pointChange) });
  };

  const handleAddVideo = (newVideo: Omit<Video, 'id' | 'createdAt' | 'trips' | 'comments'>) => {
    const video: Video = {
      ...newVideo,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      trips: 0,
      comments: [],
    };
    
    // Reward for uploading
    if (user) {
      handleUpdateUser({ points: user.points + 50 });
    }

    setVideos([video, ...videos]);
    setIsUploadModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar 
        user={user} 
        onAuthClick={() => setIsAuthModalOpen(true)}
        onUploadClick={() => user ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)}
        onViewChange={setCurrentView}
        currentView={currentView}
        onLogout={handleLogout}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 mb-20 md:mb-0">
        {currentView === 'feed' && (
          <VideoFeed 
            videos={videos} 
            onVote={handleVote} 
            onComment={(videoId, comment) => {
              if(!user) { setIsAuthModalOpen(true); return; }
              setVideos(prev => prev.map(v => 
                v.id === videoId ? { ...v, comments: [...v.comments, comment] } : v
              ));
              // Small reward for commenting
              handleUpdateUser({ points: user.points + 5 });
            }}
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
      </main>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal 
          onClose={() => setIsAuthModalOpen(false)} 
          onLogin={handleAuth} 
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
      </div>
    </div>
  );
};

// Simple Icons
const HomeIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const TrophyIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>;
const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

export default App;
