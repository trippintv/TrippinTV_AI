
import React, { useState, useEffect } from 'react';
import VideoCard from './VideoCard';

const VideoFeed = ({ videos, onVote, onComment, user }) => {
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
      {showNotice && (
        <div className="w-full max-w-[420px] bg-zinc-900 border-2 border-dashed border-purple-500/50 rounded-3xl p-6 relative overflow-hidden group animate-in fade-in slide-in-from-top duration-500">
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
              <h3 className="bungee text-lg leading-tight mb-1 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent uppercase">
                TO START TRIPPIN ....
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Found something wild? <span className="text-white font-bold">Tap the TV icon</span> to "Trip" on it! Each Trip pushes the creator up. 
              </p>
            </div>
          </div>
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

const TVIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3L12 7L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="5" y="9" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="18.5" cy="16.5" r="1" fill="currentColor" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default VideoFeed;
