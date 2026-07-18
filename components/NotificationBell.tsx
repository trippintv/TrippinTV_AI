import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '../types';
import { supabase } from '../src/lib/supabaseClient';

interface NotificationBellProps {
  onOpen: () => void; // open full notifications view
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onOpen }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        setUnread(data.unread);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      const token = await getToken();
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative p-2 rounded-full hover:bg-zinc-800 transition-colors"
        title="Notifications"
      >
        <svg className="w-6 h-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-black text-white flex items-center justify-center border border-black animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[70]">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="font-black text-sm">Notifications</span>
            <button onClick={onOpen} className="text-[10px] text-purple-400 font-bold uppercase tracking-widest hover:underline">See all</button>
          </div>
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-zinc-600 text-xs">No notifications yet</p>
          ) : (
            notifications.slice(0, 10).map(n => (
              <div key={n.id} className={`p-3 border-b border-zinc-800/50 text-sm ${n.read ? 'text-zinc-400' : 'text-white bg-zinc-800/30'}`}>
                {n.text}
                <p className="text-[10px] text-zinc-600 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
