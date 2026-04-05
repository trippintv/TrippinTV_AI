import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import ReportModal from './ReportModal';
import { io, Socket } from 'socket.io-client';

interface ChatViewProps {
  currentUser: User;
  allUsers: User[];
}

interface Conversation {
  user: User;
  lastMessage: Message;
}

const ChatView: React.FC<ChatViewProps> = ({ currentUser, allUsers }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'explore'>('recent');
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket setup
  useEffect(() => {
    const socket = io(window.location.origin.replace('3000', '3001')); // Assuming 3001 for server
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', currentUser.id);
    });

    socket.on('message', (msg: Message) => {
      // If we're currently chatting with the sender (or we are the sender), add to messages
      if (
        (selectedUser && (msg.senderId === selectedUser.id || (msg.senderId === currentUser.id && msg.receiverId === selectedUser.id)))
      ) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // Refresh conversations list to update "last message"
      fetchConversations();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedUser, currentUser.id]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/conversations/${currentUser.id}`);
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
        const res = await fetch(`/api/messages/${currentUser.id}/${selectedUser.id}`);
        setMessages(await res.json());
      };
      fetchMessages();
    }
  }, [selectedUser, currentUser.id]);

  const handleSendMessage = async () => {
    if (!selectedUser || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: selectedUser.id,
          text: newMessage
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Safety Alert: ${err.error}`);
      } else {
        setNewMessage('');
        // No need to manually add to messages as socket will handle it
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const chatPartners = allUsers.filter(u => u.id !== currentUser.id);

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
              People
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'recent' ? (
            conversations.length > 0 ? (
              conversations.map(({ user, lastMessage }) => (
                <div 
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-all border-b border-zinc-800/20 ${selectedUser?.id === user.id ? 'bg-zinc-800 shadow-inner' : 'hover:bg-zinc-800/30'}`}
                >
                  <div className="relative">
                    <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-zinc-800" alt="" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">@{user.username}</p>
                    <p className="text-xs text-zinc-500 truncate">{lastMessage.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-zinc-600">
                <p className="text-xs uppercase font-black tracking-widest">No recent chats</p>
              </div>
            )
          ) : (
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
                  <p className="text-[8px] text-green-500 font-black uppercase tracking-widest">Active Now</p>
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
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg ${
                    msg.senderId === currentUser.id 
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-tr-none border border-white/10' 
                      : 'bg-zinc-800/80 text-zinc-200 rounded-tl-none border border-zinc-700/50'
                  }`}>
                    {msg.text}
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
