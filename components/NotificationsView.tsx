import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import { supabase } from '../src/lib/supabaseClient';

const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const load = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } });
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

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h2 className="bungee text-2xl tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-6">NOTIFICATIONS</h2>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-20">No notifications yet</p>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-2xl border ${n.read ? 'bg-zinc-900/40 border-zinc-800' : 'bg-purple-600/10 border-purple-500/30'}`}>
              <p className="text-sm text-zinc-200">{n.text}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
