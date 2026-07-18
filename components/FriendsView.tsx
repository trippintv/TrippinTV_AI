import React, { useState, useEffect, useCallback } from 'react';
import { User, FriendsData, FriendRequest } from '../types';
import { supabase } from '../src/lib/supabaseClient';

interface FriendsViewProps {
  currentUser: User;
}

const FriendsView: React.FC<FriendsViewProps> = ({ currentUser }) => {
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadFriends = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setSearchResults(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async (receiverId: string) => {
    setBusyId(receiverId);
    try {
      const token = await getToken();
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        showToast('Friend request sent!');
        setSearchResults([]);
        setSearchQuery('');
        loadFriends();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const acceptRequest = async (senderId: string) => {
    setBusyId(senderId);
    try {
      const token = await getToken();
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ senderId }),
      });
      if (res.ok) { showToast('You are now friends!'); loadFriends(); }
      else showToast('Could not accept request');
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const rejectRequest = async (senderId: string) => {
    setBusyId(senderId);
    try {
      const token = await getToken();
      const res = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ senderId }),
      });
      if (res.ok) { showToast('Request rejected'); loadFriends(); }
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const removeFriend = async (friendId: string) => {
    setBusyId(friendId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) { showToast('Friend removed'); loadFriends(); }
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto relative">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Friend Requests */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-zinc-900/60 rounded-[28px] border border-zinc-800 p-5">
            <h3 className="bungee text-lg tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
              REQUESTS {data.incoming.length > 0 && <span className="text-pink-500">({data.incoming.length})</span>}
            </h3>
            {data.incoming.length === 0 ? (
              <p className="text-xs text-zinc-600 uppercase tracking-widest font-black">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {data.incoming.map((req: FriendRequest) => (
                  <div key={req.id} className="flex items-center gap-3">
                    <img src={req.sender?.avatar || currentUser.avatar} className="w-10 h-10 rounded-full border border-zinc-700" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{req.sender?.username}</p>
                    </div>
                    <button
                      onClick={() => acceptRequest(req.senderId)}
                      disabled={busyId === req.senderId}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectRequest(req.senderId)}
                      disabled={busyId === req.senderId}
                      className="text-zinc-400 hover:text-red-400 text-xs font-black px-2 py-1.5 transition-all disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Friends */}
          <div className="bg-zinc-900/60 rounded-[28px] border border-zinc-800 p-5">
            <h3 className="bungee text-lg tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
              ADD FRIENDS
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search @username..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-2.5 px-4 text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
            <div className="mt-3 space-y-2">
              {isSearching && <p className="text-xs text-zinc-500">Searching...</p>}
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <img src={u.avatar} className="w-9 h-9 rounded-full border border-zinc-700" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    disabled={busyId === u.id}
                    className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-black px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              ))}
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <p className="text-xs text-zinc-600">No users found</p>
              )}
            </div>
            {data.outgoing.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">Sent</p>
                {data.outgoing.map((req: FriendRequest) => (
                  <p key={req.id} className="text-xs text-zinc-400">@{req.receiver?.username} · pending</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Friends List */}
        <div className="md:col-span-2">
          <div className="bg-zinc-900/60 rounded-[28px] border border-zinc-800 p-6">
            <h3 className="bungee text-2xl tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-6">
              YOUR CREW ({data.friends.length})
            </h3>
            {data.friends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-600 text-sm uppercase tracking-widest font-black">No friends yet</p>
                <p className="text-zinc-700 text-xs mt-2">Search above to add your first trippin' buddy!</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {data.friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 bg-zinc-800/40 rounded-2xl p-3 border border-zinc-800">
                    <img src={f.avatar} className="w-12 h-12 rounded-full border-2 border-purple-500/30" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-sm">@{f.username}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{f.points} pts</p>
                    </div>
                    <button
                      onClick={() => removeFriend(f.id)}
                      disabled={busyId === f.id}
                      className="text-zinc-500 hover:text-red-400 text-xs font-black px-2 transition-all disabled:opacity-40"
                      title="Remove friend"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsView;
