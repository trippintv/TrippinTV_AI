import React, { useState } from 'react';
import { Post, User, Comment } from '../types';
import { moderateContent } from '../services/geminiService';
import ReportModal from './ReportModal';

interface PostCardProps {
  post: Post;
  onComment: (postId: string, comment: Comment, parentId?: string) => void;
  user: User | null;
  onOpenProfile: (userId: string) => void;
  onShare: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onComment,
  user,
  onOpenProfile,
  onShare,
}) => {
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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
      onComment(post.id, newComment, replyTo?.id);
      setCommentText('');
      setReplyTo(null);
    } else {
      alert(`Safety Alert: Comment blocked. ${result.reason}`);
    }
    setIsAiProcessing(false);
  };

  const topLevel = post.comments.filter((c) => !c.parentId);
  const repliesFor = (id: string) => post.comments.filter((c) => c.parentId === id);

  return (
    <div className="bg-zinc-900 rounded-3xl overflow-hidden w-full max-w-[420px] shadow-2xl border border-zinc-800 relative animate-in fade-in slide-in-from-bottom duration-300">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => onOpenProfile(post.userId)} className="flex items-center gap-2">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}`}
              className="w-10 h-10 rounded-full border border-purple-500 bg-zinc-800"
              alt=""
            />
            <div className="text-left">
              <span className="font-bold text-sm hover:underline block">@{post.username}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Post</span>
            </div>
          </button>
          {post.category && (
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
              {post.category}
            </span>
          )}
        </div>

        {post.title && <h3 className="text-lg font-bold mb-1.5">{post.title}</h3>}
        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap break-words">{post.text}</p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-6 px-5 py-3 border-t border-zinc-800 text-zinc-400">
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 transition-colors ${showComments ? 'text-purple-400' : 'hover:text-white'}`}
        >
          <ChatIcon className="w-5 h-5" />
          <span className="text-xs font-bold">{post.comments.length}</span>
        </button>
        <button onClick={() => onShare(post)} className="flex items-center gap-2 hover:text-white transition-colors">
          <ShareIcon className="w-5 h-5" />
          <span className="text-xs font-bold">Share</span>
        </button>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="ml-auto flex items-center gap-1 text-red-500 hover:text-red-400 transition-colors"
          title="Report this post"
        >
          <ReportIcon className="w-5 h-5" />
        </button>
      </div>

      {showComments && (
        <div className="p-4 bg-zinc-900 max-h-[400px] overflow-y-auto border-t border-zinc-800 animate-in slide-in-from-bottom duration-300">
          <div className="space-y-4 mb-4">
            {topLevel.length > 0 ? (
              topLevel.map((c) => (
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
                  <div className="ml-11 mt-3 space-y-3 border-l border-zinc-800 pl-3">
                    {repliesFor(c.id).map((r) => (
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
          contentTitle={`Post by @${post.username}`}
          category="user"
          reporter={user?.username || 'Anonymous'}
        />
      )}
    </div>
  );
};

const ChatIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const ShareIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
const SendIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
const ReportIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default PostCard;
