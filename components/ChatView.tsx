import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import ReportModal from './ReportModal';
import { supabase } from '../src/lib/supabaseClient';
import { apiFetch } from '../src/lib/api';
import { timeAgo } from '../src/lib/timeAgo';
import { useToast } from './Toast';

interface ChatViewProps {
  currentUser: User;
  allUsers: User[];
}

interface Conversation {
  user: User;
  lastMessage: Message;
  unreadCount: number;
}

const ChatView: React.FC<ChatViewProps> = ({ currentUser, allUsers }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'explore'>('recent');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const { showToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.senderId !== currentUser.id && msg.receiverId !== currentUser.id) return;

        if (
          selectedUser &&
          (msg.senderId === selectedUser.id || (msg.senderId === currentUser.id && msg.receiverId === selectedUser.id))
        ) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser, currentUser.id]);

  const fetchConversations = async () => {
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/conversations/${currentUser.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentUser.id]);

  useEffect(() => {
    if (selectedUser) {
      const fetchMessages = async () => {
        const token = await getToken();
        const res = await apiFetch(`/api/messages/${currentUser.id}/${selectedUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setMessages(data.messages || []);
        setHasMoreMessages(data.hasMore);
      };
      fetchMessages();

      const markRead = async () => {
        const t = await getToken();
        await apiFetch('/api/messages/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
          body: JSON.stringify({ senderId: selectedUser.id }),
        });
        fetchConversations();
      };
      markRead().catch(console.error);
    }
  }, [selectedUser, currentUser.id]);

  const loadMoreMessages = async () => {
    if (!selectedUser || loadingMoreMessages || !hasMoreMessages || messages.length === 0) return;
    setLoadingMoreMessages(true);
    try {
      const token = await getToken();
      const oldest = messages[0];
      const res = await apiFetch(`/api/messages/${currentUser.id}/${selectedUser.id}?before=${oldest.createdAt}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(prev => [...(data.messages || []), ...prev]);
      setHasMoreMessages(data.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const token = await getToken();
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          text: newMessage
        })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(`Safety Alert: ${err.error}`, 'error');
      } else {
        setNewMessage('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const [friends, setFriends] = useState<User[]>([]);

  const fetchFriends = async () => {
    try {
      const token = await getToken();
      const res = await apiFetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [currentUser.id]);

  const chatPartners = friends;

  return (
    <div className="flex h-[calc(100vh-120px)] max-w-6xl mx-auto bg-zinc-900/50 rounded-[40px] border border-zinc-800/50 overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="w-1/3 border-r border-zinc-800 flex flex-col bg-zinc-900/80">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="bungee text-2xl tracking-tighter bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">CHAT</h2>
          <div className="flex gap-4 mt-4">
            <button 
              onClick={() => setActiveTab('recent')}
              className={`text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all ${activeTab === 'recent' ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Recent
            </button>
            <button 
              onClick={() => setActiveTab('explore')}
              className={`text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all ${activeTab === 'explore' ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Friends
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'recent' ? (
            conversations.length > 0 ? (
              conversations.map(({ user, lastMessage, unreadCount }) => (
                <div 
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-all border-b border-zinc-800/20 ${selectedUser?.id === user.id ? 'bg-zinc-800 shadow-inner' : 'hover:bg-zinc-800/30'}`}
                >
                  <div className="relative">
                    <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-zinc-800" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold truncate text-sm">@{user.username}</p>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-2">{timeAgo(lastMessage.createdAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{lastMessage.text}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center flex-shrink-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-zinc-600">
                <p className="text-xs uppercase font-black tracking-widest">No recent chats</p>
              </div>
            )
          ) : (
            chatPartners.length > 0 ? (
              chatPartners.map(user => (
                <div 
                  key={user.id}
                  onClick={() => { setSelectedUser(user); setActiveTab('recent'); }}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-all border-b border-zinc-800/20 ${selectedUser?.id === user.id ? 'bg-zinc-800 shadow-inner' : 'hover:bg-zinc-800/30'}`}
                >
                  <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-zinc-800" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">@{user.username}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tap to message</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-zinc-600">
                <p className="text-xs uppercase font-black tracking-widest">No friends yet</p>
                <p className="text-[10px] mt-2 text-zinc-700">Add friends from the Friends tab to start chatting.</p>
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-black/40 relative">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <img src={selectedUser.avatar} className="w-10 h-10 rounded-full border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]" alt="" />
                <div>
                  <p className="bungee text-sm tracking-tighter">@{selectedUser.username}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="text-red-500/60 hover:text-red-400 font-black text-[9px] uppercase tracking-widest bg-red-500/5 px-4 py-2 rounded-full border border-red-500/10 transition-all hover:bg-red-500/10"
              >
                Report
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {hasMoreMessages && (
                <div className="text-center py-2">
                  <button
                    onClick={loadMoreMessages}
                    disabled={loadingMoreMessages}
                    className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors"
                  >
                    {loadingMoreMessages ? 'Loading...' : 'Load older messages'}
                  </button>
                </div>
              )}
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[70%]">
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg ${
                      msg.senderId === currentUser.id 
                        ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-tr-none border border-white/10' 
                        : 'bg-zinc-800/80 text-zinc-200 rounded-tl-none border border-zinc-700/50'
                    }`}>
                      {msg.text}
                    </div>
                    <p className={`text-[9px] text-zinc-600 mt-0.5 ${msg.senderId === currentUser.id ? 'text-right' : 'text-left'}`}>
                      {timeAgo(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30">
              <div className="flex gap-2 items-center bg-zinc-800/50 p-2 rounded-2xl border border-zinc-700/30">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none px-3 py-2 text-sm focus:outline-none placeholder:text-zinc-600"
                  disabled={isSending}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="bg-purple-600 hover:bg-purple-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-purple-900/20 disabled:opacity-20"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {isReportModalOpen && (
              <ReportModal 
                onClose={() => setIsReportModalOpen(false)}
                contentTitle={`Chat User: @${selectedUser.username}`}
                category="user_chat"
                reporter={`@${currentUser.username}`}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)]">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700/30">
              <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="bungee text-xl opacity-30 tracking-widest">SELECT A VIBE</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatView;
