
import React, { useState, useEffect } from 'react';
import { Video, User, Comment } from '../types';
import VideoCard from './VideoCard';

interface VideoFeedProps {
  videos: Video[];
  onVote: (videoId: string) => void;
  onComment: (videoId: string, comment: Comment) => void;
  user: User | null;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ videos, onVote, onComment, user }) => {
  const [showNotice, setShowNotice] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('trippin_vote_notice_dismissed');
    if (dismissed) {
      setShowNotice(false);
    }
  }, []);

  const dismissNotice = () => {
    setShowNotice(false);
    localStorage.setItem('trippin_vote_notice_dismissed', 'true');
  };

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* Voting & Prizes Notice */}
      {showNotice && (
        <div className="w-full max-w-[420px] bg-zinc-900 border-2 border-dashed border-purple-500/50 rounded-3xl p-6 relative overflow-hidden group animate-in fade-in slide-in-from-top duration-500">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-600/10 blur-2xl rounded-full group-hover:bg-purple-600/20 transition-all"></div>
          
          <button 
            onClick={dismissNotice}
            className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>

          <div className="flex gap-4 items-start">
            <div className="bg-purple-600/20 p-3 rounded-2xl border border-purple-500/30">
              <TVIcon className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="bungee text-lg leading-tight mb-1 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                TO START TRIPPIN ....
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Found something wild? <span className="text-white font-bold">Tap the TV icon</span> to "Trip" on it! Each Trip pushes the creator up the <span className="text-purple-400 font-bold">Weekly Legends</span> leaderboard. 
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-purple-600 animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">Win real cash prizes</span>
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
          `}</style>
        </div>
      )}

      {videos.map((video) => (
        <VideoCard 
          key={video.id} 
          video={video} 
          onVote={onVote} 
          onComment={onComment}
          user={user}
        />
      ))}
      
      {videos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No trips yet. Be the first to upload!</p>
        </div>
      )}
    </div>
  );
};

const TVIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3L12 7L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="5" y="9" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="18.5" cy="16.5" r="1" fill="currentColor" />
  </svg>
);

const CloseIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default VideoFeed;
