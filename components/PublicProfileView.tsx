import React, { useState, useEffect, useCallback } from 'react';
import { User, Video, PublicProfile } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import VideoCard from './VideoCard';
import { Comment, ReactionType, ReactionSummary } from '../types';

interface PublicProfileViewProps {
  userId: string;
  currentUser: User | null;
  onVote: (videoId: string) => void;
  onComment: (videoId: string, comment: Comment, parentId?: string) => void;
  onReact: (videoId: string, type: ReactionType) => void;
  onOpenProfile: (userId: string) => void;
  onShare: (video: Video) => void;
}

const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  userId,
  currentUser,
  onVote,
  onComment,
  onReact,
  onOpenProfile,
  onShare,
}) => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'friends' | 'incoming' | 'outgoing'>('none');
  const [followStatus, setFollowStatus] = useState<{ following: boolean }>({ following: false });
  const [busy, setBusy] = useState(false);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadProfile = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/users/${userId}/public`, token ? { headers: { 'Authorization': `Bearer ${token}` } } : {});
      if (res.ok) setProfile(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadRelations = useCallback(async () => {
    if (!currentUser || currentUser.id === userId) return;
    const token = await getToken();
    try {
      const [fs, fl] = await Promise.all([
        fetch(`/api/friends/status/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch(`/api/follow/status/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setFriendStatus(fs.status);
      setFollowStatus(fl);
    } catch (err) {
      console.error(err);
    }
  }, [currentUser, userId]);

  useEffect(() => {
    loadProfile();
    loadRelations();
  }, [loadProfile, loadRelations]);

  const act = async (url: string, method: string, body?: any) => {
    setBusy(true);
    try {
      const token = await getToken();
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      loadRelations();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-zinc-500">Loading profile...</div>;
  }
  if (!profile) {
    return <div className="text-center py-20 text-zinc-500">User not found</div>;
  }

  const isSelf = currentUser?.id === userId;
  const u = profile.user;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="bg-zinc-900/60 rounded-[32px] border border-zinc-800 p-6 mb-6 flex flex-col sm:flex-row items-center gap-5">
        <img src={u.avatar} className="w-24 h-24 rounded-full border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]" alt="" />
        <div className="text-center sm:text-left flex-1">
          <h2 className="bungee text-2xl tracking-tighter">@{u.username}</h2>
          <p className="text-zinc-400 text-sm mt-1">{u.bio || 'No bio yet.'}</p>
          <div className="flex gap-4 mt-3 justify-center sm:justify-start text-xs text-zinc-500">
            <span><b className="text-white">{profile.followerCount}</b> followers</span>
            <span><b className="text-white">{profile.followingCount}</b> following</span>
            <span><b className="text-white">{u.points}</b> pts</span>
          </div>
        </div>
        {!isSelf && currentUser && (
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            {friendStatus === 'friends' ? (
              <span className="px-5 py-2.5 rounded-full bg-green-600/20 text-green-400 text-sm font-black text-center border border-green-600/30">Friends ✓</span>
            ) : friendStatus === 'outgoing' ? (
              <span className="px-5 py-2.5 rounded-full bg-zinc-800 text-zinc-400 text-sm font-black text-center">Request sent</span>
            ) : friendStatus === 'incoming' ? (
              <div className="flex gap-2">
                <button onClick={() => act('/api/friends/accept', 'POST', { senderId: userId })} disabled={busy} className="flex-1 px-4 py-2.5 rounded-full bg-purple-600 text-white text-sm font-black">Accept</button>
                <button onClick={() => act('/api/friends/reject', 'POST', { senderId: userId })} disabled={busy} className="px-3 py-2.5 rounded-full bg-zinc-800 text-sm">✕</button>
              </div>
            ) : (
              <button onClick={() => act('/api/friends/request', 'POST', { receiverId: userId })} disabled={busy} className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-black">Add Friend</button>
            )}
            <button
              onClick={() => followStatus.following ? act(`/api/follow/${userId}`, 'DELETE') : act(`/api/follow/${userId}`, 'POST')}
              disabled={busy}
              className={`px-5 py-2.5 rounded-full text-sm font-black transition-all ${followStatus.following ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-pink-600 hover:bg-pink-500 text-white'}`}
            >
              {followStatus.following ? 'Following' : 'Follow'}
            </button>
          </div>
        )}
      </div>

      <h3 className="bungee text-lg tracking-tighter text-zinc-300 mb-4 px-1">TRIPS BY @{u.username}</h3>
      <div className="flex flex-col items-center gap-8">
        {profile.videos.length === 0 ? (
          <p className="text-zinc-600 text-sm">No trips uploaded yet.</p>
        ) : (
          profile.videos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onVote={onVote}
              onComment={onComment}
              onReact={onReact}
              onOpenProfile={onOpenProfile}
              onShare={onShare}
              user={currentUser}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PublicProfileView;
