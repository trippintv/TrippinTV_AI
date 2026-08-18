import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { apiFetch } from '../src/lib/api';
import VideoCard from './VideoCard';
import { Comment, ReactionType, ReactionSummary } from '../types';

interface ExploreViewProps {
  onVote: (videoId: string) => void;
  onComment: (videoId: string, comment: Comment, parentId?: string) => void;
  onReact: (videoId: string, type: ReactionType) => void;
  onOpenProfile: (userId: string) => void;
  onShare: (video: Video) => void;
  user: any;
  onOpenUsername?: (username: string) => void;
  onSelectTopic?: (tag: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🌍' },
  { id: 'funny', label: 'Funny', emoji: '😂' },
  { id: 'pets', label: 'Pets', emoji: '🐱' },
  { id: 'stunts', label: 'Stunts', emoji: '🔥' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
];

const ExploreView: React.FC<ExploreViewProps> = ({ onVote, onComment, onReact, onOpenProfile, onShare, user, onOpenUsername, onSelectTopic }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [activeCategory]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const tag = activeCategory === 'all' ? '' : activeCategory;
      const res = await apiFetch(`/api/videos${tag ? `?tag=${tag}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="bungee text-2xl tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4 text-center">
        EXPLORE
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-white border border-zinc-800'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col items-center gap-8 py-10">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-full max-w-lg">
              <div className="skeleton rounded-[28px] h-[500px]" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-zinc-500 text-sm">No videos in this category yet</p>
          <p className="text-zinc-600 text-xs mt-1">Be the first to post one!</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          {videos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onVote={onVote}
              onComment={onComment}
              onReact={onReact}
              onOpenProfile={onOpenProfile}
              onShare={onShare}
              user={user}
              onOpenUsername={onOpenUsername}
              onSelectTopic={onSelectTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExploreView;
