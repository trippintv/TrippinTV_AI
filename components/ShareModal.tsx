import React from 'react';
import { Video } from '../types';

interface ShareModalProps {
  video: Video;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ video, onClose }) => {
  const shareUrl = `${window.location.origin}/v/${video.id}`;
  const shareText = `Check out "${video.title}" by @${video.username} on Trippin' TV!`;

  const platforms = [
    { name: 'Copy Link', color: 'bg-zinc-700', icon: '🔗', action: () => navigator.clipboard?.writeText(shareUrl).then(() => alert('Link copied!')) },
    { name: 'WhatsApp', color: 'bg-green-600', icon: '💬', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`) },
    { name: 'Twitter', color: 'bg-black', icon: '𝕏', action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`) },
    { name: 'Facebook', color: 'bg-blue-600', icon: '📘', action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`) },
    { name: 'Instagram', color: 'bg-gradient-to-br from-purple-600 to-pink-500', icon: '📷', action: () => { navigator.clipboard?.writeText(shareUrl); alert('Link copied! Paste it in your Instagram story or DM.') } },
    { name: 'TikTok', color: 'bg-black', icon: '🎵', action: () => { navigator.clipboard?.writeText(shareUrl); alert('Link copied! Paste it in your TikTok bio or DM.') } },
    { name: 'SMS', color: 'bg-green-500', icon: '✉️', action: () => window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + shareUrl)}`) },
    { name: 'More', color: 'bg-zinc-600', icon: '•••', action: () => { if (navigator.share) navigator.share({ title: video.title, text: shareText, url: shareUrl }).catch(() => {}); } },
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 border border-zinc-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bungee text-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">SHARE</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="bg-zinc-800/60 rounded-2xl p-3 mb-5 flex items-center gap-3">
          <img src={video.thumbnailUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}`} className="w-14 h-14 rounded-xl object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{video.title}</p>
            <p className="text-xs text-zinc-500 truncate">@{video.username} · {(video.trips || 0).toLocaleString()} trips</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {platforms.map(p => (
            <button key={p.name} onClick={p.action} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-14 h-14 ${p.color} rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                {p.icon}
              </div>
              <span className="text-[10px] text-zinc-400 group-hover:text-white transition-colors">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
