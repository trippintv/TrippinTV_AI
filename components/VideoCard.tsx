
import React, { useState, useRef, useEffect } from 'react';
import { Video, User, Comment, ReactionType, ReactionSummary } from '../types';
import { moderateContent } from '../services/geminiService';
import ReportModal from './ReportModal';

interface VideoCardProps {
  video: Video;
  onVote: (videoId: string) => void;
  onComment: (videoId: string, comment: Comment, parentId?: string) => void;
  user: User | null;
  onOpenProfile: (userId: string) => void;
  onShare: (video: Video) => void;
  onReact: (videoId: string, type: ReactionType) => void;
  reactionSummary?: ReactionSummary;
  userReactions?: ReactionType[];
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'laugh', emoji: '😂', label: 'Laugh' },
  { type: 'skull', emoji: '💀', label: 'Skull' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'eyes', emoji: '👀', label: 'Eyes' },
];

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onVote,
  onComment,
  user,
  onOpenProfile,
  onShare,
  onReact,
  reactionSummary,
  userReactions = [],
}) => {
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showTapOverlay, setShowTapOverlay] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef<number>(0);

  const handleVideoClick = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!video.hasVoted) onVote(video.id);
      setShowTapOverlay(true);
      setTimeout(() => setShowTapOverlay(false), 800);
    }
    lastTap.current = now;
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    const v = videoRef.current as any;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    else if (v.msRequestFullscreen) v.msRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !user) return;
    setIsAiProcessing(true);
    const result = await moderateContent(commentText, 'comment');
    if (result.safe) {
      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        text: commentText,
        createdAt: new Date().toISOString(),
      };
      onComment(video.id, newComment, replyTo?.id);
      setCommentText('');
      setReplyTo(null);
    } else {
      alert(`Safety Alert: Comment blocked. ${result.reason}`);
    }
    setIsAiProcessing(false);
  };

  // Build flat + threaded comments
  const topLevel = video.comments.filter(c => !c.parentId);
  const repliesFor = (id: string) => video.comments.filter(c => c.parentId === id);

  const summary: ReactionSummary = reactionSummary || { fire: 0, laugh: 0, skull: 0, heart: 0, eyes: 0 };

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
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-5 z-10" onClick={(e) => e.stopPropagation()}>
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
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={`p-3 rounded-full transition-all ${showReactions ? 'bg-pink-600' : 'bg-zinc-800/80 hover:bg-zinc-700'}`}
            >
              <span className="text-xl leading-none">😂</span>
            </button>
            <span className="text-xs font-bold drop-shadow-md">
              {Object.values(summary).reduce((a, b) => a + b, 0) || 'React'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button onClick={() => onShare(video)} className="p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-all">
              <ShareIcon className="w-7 h-7" />
            </button>
            <span className="text-xs font-bold drop-shadow-md">Share</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleFullscreen} className="p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-all">
              <FullscreenIcon className="w-7 h-7" />
            </button>
            <span className="text-xs font-bold drop-shadow-md">Full</span>
          </div>

          <div className="flex flex-col items-center gap-1 pt-2">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="p-3 rounded-full bg-red-900/40 hover:bg-red-900 transition-all group"
              title="Report this video"
            >
              <ReportIcon className="w-7 h-7 text-red-500 group-hover:text-red-400" />
            </button>
            <span className="text-[8px] font-black text-red-500 drop-shadow-md">REPORT</span>
          </div>
        </div>

        {/* Reaction popover */}
        {showReactions && (
          <div
            className="absolute bottom-24 right-2 z-20 bg-zinc-800/95 backdrop-blur rounded-2xl p-2 flex gap-1 shadow-2xl border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            {REACTIONS.map(r => (
              <button
                key={r.type}
                onClick={() => { onReact(video.id, r.type); setShowReactions(false); }}
                className={`text-2xl p-2 rounded-xl transition-transform hover:scale-125 ${userReactions.includes(r.type) ? 'bg-pink-600/40 ring-1 ring-pink-400' : 'hover:bg-zinc-700'}`}
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => onOpenProfile(video.userId)} className="flex items-center gap-2">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}`} className="w-8 h-8 rounded-full border border-purple-500 bg-zinc-800" alt="" />
                <span className="font-bold text-sm hover:underline">@{video.username}</span>
              </button>
            </div>
            <h3 className="text-lg font-bold mb-1">{video.title}</h3>
            <p className="text-zinc-300 text-sm line-clamp-2">{video.description}</p>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="p-4 bg-zinc-900 max-h-[400px] overflow-y-auto border-t border-zinc-800 animate-in slide-in-from-bottom duration-300">
          <div className="space-y-4 mb-4">
            {topLevel.length > 0 ? (
              topLevel.map(c => (
                <div key={c.id} className="animate-in fade-in duration-300">
                  <div className="flex gap-3 items-start">
                    <img
                      src={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`}
                      className="w-8 h-8 rounded-full shrink-0 border border-zinc-800 object-cover bg-zinc-800"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-black text-zinc-400 block mb-0.5 uppercase tracking-tighter">@{c.username}</span>
                      <p className="text-sm text-zinc-200 leading-tight break-words">{c.text}</p>
                      {user && (
                        <button
                          onClick={() => setReplyTo({ id: c.id, username: c.username })}
                          className="text-[10px] text-zinc-500 hover:text-purple-400 mt-1 font-bold uppercase tracking-widest"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Replies */}
                  <div className="ml-11 mt-3 space-y-3 border-l border-zinc-800 pl-3">
                    {repliesFor(c.id).map(r => (
                      <div key={r.id} className="flex gap-2 items-start">
                        <img
                          src={r.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.username}`}
                          className="w-6 h-6 rounded-full shrink-0 border border-zinc-800 object-cover bg-zinc-800"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-black text-zinc-500 block mb-0.5 uppercase tracking-tighter">@{r.username}</span>
                          <p className="text-xs text-zinc-300 leading-tight break-words">{r.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">Be the first to comment!</p>
            )}
          </div>
          {user && (
            <div className="flex gap-2 sticky bottom-0 bg-zinc-900 pt-2 border-t border-zinc-800/50">
              {replyTo && (
                <span className="text-[10px] text-purple-400 self-center font-bold">
                  → @{replyTo.username}
                  <button onClick={() => setReplyTo(null)} className="ml-1 text-zinc-500">✕</button>
                </span>
              )}
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyTo ? 'Write a reply...' : 'Say something...'}
                className="flex-1 bg-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                onKeyPress={(e) => e.key === 'Enter' && handlePostComment()}
                disabled={isAiProcessing}
              />
              <button
                onClick={handlePostComment}
                className="bg-purple-600 p-2.5 rounded-xl hover:bg-purple-500 transition-colors disabled:opacity-50"
                disabled={!commentText.trim() || isAiProcessing}
              >
                {isAiProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <SendIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {isReportModalOpen && (
        <ReportModal
          onClose={() => setIsReportModalOpen(false)}
          contentTitle={`Video: ${video.title} (by @${video.username})`}
          category="video_content"
          reporter={user?.username || 'Anonymous'}
        />
      )}
    </div>
  );
};

const TripIcon = ({ className, active }: { className: string, active: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3L12 7L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="5" y="9" width="11" height="10" rx="1" fill={active ? 'white' : 'transparent'} fillOpacity={active ? '0.2' : '0'} stroke="currentColor" strokeWidth="1.5" />
    {active && <path d="M10.5 14C10.5 14 11 13 12 13C13 13 13.5 14 13.5 14M9 11C9 11 10 10 12 10C14 10 15 11 15 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" />}
    <circle cx="18.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="18.5" cy="16.5" r="1" fill="currentColor" />
  </svg>
);

const ChatIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const ShareIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
const SendIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const FullscreenIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>;
const ReportIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

export default VideoCard;
