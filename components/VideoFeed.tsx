
import React, { useState, useEffect } from 'react';
import { Video, User, Comment, ReactionType, ReactionSummary } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import VideoCard from './VideoCard';

interface VideoFeedProps {
  videos: Video[];
  onVote: (videoId: string) => void;
  onComment: (videoId: string, comment: Comment, parentId?: string) => void;
  onReact: (videoId: string, type: ReactionType) => void;
  onOpenProfile: (userId: string) => void;
  onShare: (video: Video) => void;
  user: User | null;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  videos,
  onVote,
  onComment,
  onReact,
  onOpenProfile,
  onShare,
  user,
}) => {
  const [showNotice, setShowNotice] = useState(true);
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  const [followingVideos, setFollowingVideos] = useState<Video[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionSummary>>({});
  const [userReactions, setUserReactions] = useState<Record<string, ReactionType[]>>({});
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('trippin_vote_notice_dismissed');
    if (dismissed) setShowNotice(false);
  }, []);

  const dismissNotice = () => {
    setShowNotice(false);
    localStorage.setItem('trippin_vote_notice_dismissed', 'true');
  };

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadReactions = async (list: Video[]) => {
    try {
      const token = await getToken();
      const results = await Promise.all(
        list.map(async (v) => {
          const [sumRes, myRes] = await Promise.all([
            fetch(`/api/videos/${v.id}/reactions`),
            user ? fetch(`/api/videos/${v.id}/react`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null),
          ]);
          const summary = await sumRes.json();
          let mine: ReactionType[] = [];
          if (myRes && myRes.ok) {
            const r = await myRes.json();
            mine = r.userReactions || [];
          }
          return { id: v.id, summary, mine };
        })
      );
      const sumMap: Record<string, ReactionSummary> = {};
      const mineMap: Record<string, ReactionType[]> = {};
      results.forEach(r => { sumMap[r.id] = r.summary; mineMap[r.id] = r.mine; });
      setReactions(sumMap);
      setUserReactions(mineMap);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (videos.length) loadReactions(videos);
  }, [videos]);

  useEffect(() => {
    if (tab === 'following' && user) {
      setLoadingFollowing(true);
      (async () => {
        try {
          const token = await getToken();
          const res = await fetch('/api/feed/following', { headers: { 'Authorization': `Bearer ${token}` } });
          const data = await res.json();
          setFollowingVideos(data);
          loadReactions(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingFollowing(false);
        }
      })();
    }
  }, [tab, user]);

  const displayed = tab === 'following' ? followingVideos : videos;

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* Tab switcher */}
      {user && (
        <div className="w-full max-w-[420px] flex gap-2 bg-zinc-900/60 rounded-full p-1 border border-zinc-800">
          <button
            onClick={() => setTab('foryou')}
            className={`flex-1 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'foryou' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            For You
          </button>
          <button
            onClick={() => setTab('following')}
            className={`flex-1 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'following' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Following
          </button>
        </div>
      )}

      {showNotice && tab === 'foryou' && (
        <div className="w-full max-w-[420px] bg-zinc-900 border-2 border-dashed border-purple-500/50 rounded-3xl p-6 relative overflow-hidden group animate-in fade-in slide-in-from-top duration-500">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-600/10 blur-2xl rounded-full group-hover:bg-purple-600/20 transition-all"></div>
          <button onClick={dismissNotice} className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors">
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
            </div>
          </div>
        </div>
      )}

      {tab === 'following' && loadingFollowing && <p className="text-zinc-500 text-sm">Loading...</p>}

      {tab === 'following' && !loadingFollowing && followingVideos.length === 0 && (
        <div className="text-center py-20 max-w-[420px]">
          <p className="text-zinc-400">Your Following feed is empty.</p>
          <p className="text-zinc-600 text-sm mt-2">Follow or add friends to see their trips here!</p>
        </div>
      )}

      {displayed.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onVote={onVote}
          onComment={onComment}
          onReact={onReact}
          onOpenProfile={onOpenProfile}
          onShare={onShare}
          user={user}
          reactionSummary={reactions[video.id]}
          userReactions={userReactions[video.id] || []}
        />
      ))}

      {tab === 'foryou' && videos.length === 0 && (
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
