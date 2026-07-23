import React, { useState } from 'react';
import { User } from '../types';
import { moderateContent } from '../services/geminiService';

interface PostComposerProps {
  onClose: () => void;
  onPost: (post: { title?: string; text: string; category?: string }) => void;
  user: User;
}

const CATEGORIES = ['Rant', 'Story', 'Question', 'Meme', 'News', 'Other'];

const PostComposer: React.FC<PostComposerProps> = ({ onClose, onPost, user }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  const handlePost = async () => {
    if (!text.trim()) return;
    setIsPosting(true);
    setSafetyError(null);

    const safetyResult = await moderateContent(text, 'video_meta');
    if (!safetyResult.safe) {
      setSafetyError(`Safety Alert: ${safetyResult.reason}`);
      setIsPosting(false);
      return;
    }

    onPost({
      title: title.trim() || undefined,
      text: text.trim(),
      category: category || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-3xl w-full max-w-[420px] p-5 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="bungee text-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            NEW POST
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
            className="w-10 h-10 rounded-full border border-purple-500 bg-zinc-800"
            alt=""
          />
          <span className="font-bold text-sm">@{user.username}</span>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-zinc-800 rounded-xl py-2.5 px-4 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's the trippin' story?"
          rows={5}
          className="w-full bg-zinc-800 rounded-xl py-2.5 px-4 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
        />

        <div className="flex flex-wrap gap-2 mt-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? '' : c)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                category === c
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {safetyError && (
          <p className="text-red-400 text-xs mt-3 font-bold">{safetyError}</p>
        )}

        <button
          onClick={handlePost}
          disabled={!text.trim() || isPosting}
          className="w-full mt-4 bg-purple-600 py-3 rounded-xl font-bold hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPosting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
};

const CloseIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default PostComposer;
