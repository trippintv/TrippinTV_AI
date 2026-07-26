import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { apiFetch } from '../src/lib/api';

interface NotificationsViewProps {
  onNavigate?: (view: string, userId?: string) => void;
}

const NOTIF_ICON: Record<string, string> = {
  friend_request: '🔔',
  friend_accepted: '✅',
  video_vote: '🔥',
  new_follow: '❤️',
  comment: '💬',
  message: '✉️',
};

const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const load = async () => {
    try {
      const token = await getToken();
      const res = await apiFetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    try {
      const token = await getToken();
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const markSingleRead = async (n: Notification) => {
    if (n.read) return;
    try {
      const token = await getToken();
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClick = (n: Notification) => {
    markSingleRead(n);
    if (!onNavigate) return;
    if (n.type === 'friend_request' || n.type === 'friend_accepted' || n.type === 'new_follow') {
      if (n.actorId) onNavigate('user', n.actorId);
    } else if (n.type === 'video_vote') {
      onNavigate('feed');
    } else if (n.type === 'comment' && n.entityId) {
      onNavigate('feed');
    } else if (n.type === 'message') {
      onNavigate('chat');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="bungee text-2xl tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">NOTIFICATIONS</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-zinc-400 font-bold uppercase tracking-widest hover:text-white transition-colors">
            Mark all read
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-20">No notifications yet</p>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left p-4 rounded-2xl border transition-colors hover:bg-zinc-800/50 ${n.read ? 'bg-zinc-900/40 border-zinc-800' : 'bg-purple-600/10 border-purple-500/30'}`}
            >
              <div className="flex items-start gap-3">
                {n.actor?.avatar ? (
                  <img src={n.actor.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="text-xl flex-shrink-0">{NOTIF_ICON[n.type] || '🔔'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200">{n.text}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.read && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full flex-shrink-0 mt-1" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
