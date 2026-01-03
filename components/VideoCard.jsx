
import React, { useState, useRef } from 'react';
import { moderateComment } from '../services/geminiService';

const VideoCard = ({ video, onVote, onComment, user }) => {
  const [commentText, setCommentText] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showTapOverlay, setShowTapOverlay] = useState(false);
  
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  const handleVideoClick = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!video.hasVoted) {
        onVote(video.id);
      }
      setShowTapOverlay(true);
      setTimeout(() => setShowTapOverlay(false), 800);
    }
    lastTap.current = now;
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) {
      v.requestFullscreen();
    } else if (v.webkitRequestFullscreen) {
      v.webkitRequestFullscreen();
    } else if (v.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Trippin' TV - ${video.title}`,
      text: `Check out this wild trip by @${video.username} on Trippin' TV!`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { console.debug('Share failed', err); }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !user) return;
    setIsAiProcessing(true);
    const isSafe = await moderateComment(commentText);
    if (isSafe) {
      const newComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        text: commentText,
        createdAt: new Date().toISOString(),
      };
      onComment(video.id, newComment);
      setCommentText('');
    } else {
      alert("Whoa! Keep it clean.");
    }
    setIsAiProcessing(false);
  };

  return (
    <div className="bg-zinc-900 rounded-3xl overflow-hidden w-full max-w-[420px] shadow-2xl border border-zinc-800 group relative">
      <div className="relative aspect-[9/16] bg-black cursor-pointer" onClick={handleVideoClick}>
        <video 
          ref={videoRef}
          src={video.videoUrl} 
          className="w-full h-full object-cover"
          loop muted autoPlay playsInline
        />
        
        {showTapOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="animate-ping absolute">
               <TripIcon className="w-24 h-24 text-purple-500 opacity-50" active={true} />
            </div>
            <TripIcon className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] scale-125 transition-transform" active={true} />
          </div>
        )}

        {/* Interaction Bar */}
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-6 z-10" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-1">
            <button 
              onClick={() => onVote(video.id)}
              className={`p-3 rounded-full transition-all transform active:scale-90 shadow-lg ${video.hasVoted ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-zinc-800/80 hover:bg-zinc-700'}`}
            >
              <TripIcon className={`w-7 h-7 ${video.hasVoted ? 'text-white' : 'text-zinc-300'}`} active={!!video.hasVoted} />
            </button>
            <span className={`text-xs font-black drop-shadow-md ${video.hasVoted ? 'text-purple-400' : 'text-white'}`}>
              {video.trips.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button 
              onClick={() => setShowComments(!showComments)}
              className={`p-3 rounded-full transition-all ${showComments ? 'bg-zinc-700' : 'bg-zinc-800/80 hover:bg-zinc-700'}`}
            >
              <ChatIcon className="w-7 h-7" />
            </button>
            <span className="text-xs font-bold drop-shadow-md">{video.comments.length}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button onClick={handleShare} className="p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-all">
              <ShareIcon className="w-7 h-7 text-zinc-300" />
            </button>
            <span className="text-[10px] font-bold drop-shadow-md uppercase tracking-tighter">Share</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleFullscreen} className="p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-all">
              <FullscreenIcon className="w-7 h-7 text-zinc-300" />
            </button>
            <span className="text-[10px] font-bold drop-shadow-md uppercase tracking-tighter">Full</span>
          </div>
        </div>

        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2 mb-2">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}`} className="w-8 h-8 rounded-full border border-purple-500 bg-zinc-800" alt="" />
              <span className="font-bold text-sm">@{video.username}</span>
            </div>
            <h3 className="text-lg font-bold mb-1 truncate">{video.title}</h3>
            <p className="text-zinc-300 text-sm line-clamp-2 leading-snug">{video.description}</p>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="p-4 bg-zinc-900 max-h-[400px] overflow-y-auto border-t border-zinc-800 animate-in slide-in-from-bottom duration-300">
          <div className="space-y-4 mb-4">
            {video.comments.length > 0 ? (
              video.comments.map(c => (
                <div key={c.id} className="flex gap-3 items-start animate-in fade-in duration-300">
                  <img 
                    src={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`} 
                    className="w-8 h-8 rounded-full shrink-0 border border-zinc-800 object-cover bg-zinc-800" 
                    alt="" 
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-zinc-400 block mb-0.5 uppercase tracking-tighter">@{c.username}</span>
                    <p className="text-sm text-zinc-200 leading-tight break-words">{c.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">Be the first to comment!</p>
            )}
          </div>
          {user && (
            <div className="flex gap-2 sticky bottom-0 bg-zinc-900 pt-2 border-t border-zinc-800/50">
              <input 
                type="text" 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Say something..." 
                className="flex-1 bg-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-white"
                onKeyPress={(e) => e.key === 'Enter' && handlePostComment()}
                disabled={isAiProcessing}
              />
              <button 
                onClick={handlePostComment} 
                className="bg-purple-600 p-2.5 rounded-xl hover:bg-purple-500 disabled:opacity-50 transition-colors"
                disabled={!commentText.trim() || isAiProcessing}
              >
                {isAiProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <SendIcon className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TripIcon = ({ className, active }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3L12 7L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="5" y="9" width="11" height="10" rx="1" fill={active ? 'white' : 'transparent'} fillOpacity={active ? '0.2' : '0'} stroke="currentColor" strokeWidth="1.5" />
    {active && <path d="M10.5 14C10.5 14 11 13 12 13C13 13 13.5 14 13.5 14M9 11C9 11 10 10 12 10C14 10 15 11 15 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" />}
    <circle cx="18.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="18.5" cy="16.5" r="1" fill="currentColor" />
  </svg>
);

const ChatIcon = ({className}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const FullscreenIcon = ({className}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>;
const ShareIcon = ({className}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
const SendIcon = ({className}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;

export default VideoCard;
