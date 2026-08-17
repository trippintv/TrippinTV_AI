import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { apiFetch } from '../src/lib/api';

interface SearchOverlayProps {
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSelectVideo: (videoId: string) => void;
  allUsers: User[];
  currentUser: User | null;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ onClose, onOpenProfile, allUsers, currentUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.replace('@', '');
        const token = currentUser ? await (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          return session?.access_token ?? null;
        })() : null;
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`, token ? { headers: { 'Authorization': `Bearer ${token}` } } : {});
        if (res.ok) {
          setResults(await res.json());
        } else {
          const fallback = allUsers.filter(u => u.username.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
          setResults(fallback);
        }
      } catch (err) {
        const fallback = allUsers.filter(u => u.username.toLowerCase().includes(query.replace('@', '').toLowerCase())).slice(0, 10);
        setResults(fallback);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, allUsers, currentUser]);

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
          placeholder="Search @username..."
          className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:border-purple-500 text-white placeholder:text-zinc-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-zinc-500 text-sm text-center py-8">Searching...</p>}
        {!loading && query && results.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">No results for "{query}"</p>
        )}
        {!loading && !query && (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">Type a username to find people</p>
            <p className="text-zinc-700 text-xs mt-2">Try searching for @nickname or display name</p>
          </div>
        )}
        {results.map(user => (
          <button
            key={user.id}
            onClick={() => { onOpenProfile(user.id); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30"
          >
            <img src={user.avatar} className="w-11 h-11 rounded-full border border-zinc-700" alt="" />
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-bold truncate">@{user.username}</p>
              {user.bio && <p className="text-xs text-zinc-500 truncate">{user.bio}</p>}
            </div>
            <p className="text-[10px] text-zinc-500 shrink-0">{user.points.toLocaleString()} pts</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchOverlay;
