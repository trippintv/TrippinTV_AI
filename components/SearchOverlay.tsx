import React, { useState, useEffect, useRef } from 'react';
import { User, Video } from '../types';
import { apiFetch } from '../src/lib/api';
import { timeAgo } from '../src/lib/timeAgo';

interface SearchOverlayProps {
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSelectVideo: (videoId: string) => void;
  allUsers: User[];
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ onClose, onOpenProfile, allUsers }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ users: User[] }>({ users: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults({ users: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase().replace('@', '');
        const matched = allUsers.filter(u =>
          u.username.toLowerCase().includes(q)
        ).slice(0, 10);
        setResults({ users: matched });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, allUsers]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in-up">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <button onClick={onClose} className="text-zinc-400 hover:text-white p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users..."
          className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-full py-2 px-4 text-sm focus:outline-none focus:border-purple-500 text-white placeholder:text-zinc-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-zinc-500 text-sm text-center py-8">Searching...</p>}
        {!loading && query && results.users.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">No results for "{query}"</p>
        )}
        {results.users.map(user => (
          <button
            key={user.id}
            onClick={() => { onOpenProfile(user.id); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30"
          >
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-zinc-700" alt="" />
            <div className="text-left">
              <p className="text-sm font-bold">@{user.username}</p>
              <p className="text-[10px] text-zinc-500">{user.points.toLocaleString()} points</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchOverlay;
