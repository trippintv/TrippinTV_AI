
import React, { useRef } from 'react';
import { User, Video } from '../types';

interface ProfileViewProps {
  user: User;
  videos: Video[];
  onUpdateUser: (updates: Partial<User>) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, videos, onUpdateUser }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalTrips = videos.reduce((acc, v) => acc + v.trips, 0);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("Image too big! Keep it under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateUser({ avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row items-center gap-8 mb-12 bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[80px] -z-10"></div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-md opacity-30 animate-pulse"></div>
          <div 
            className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-purple-500 shadow-xl relative z-10 overflow-hidden cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <img 
              src={user.avatar} 
              className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              alt={user.username} 
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col">
              <CameraIcon className="w-8 h-8 text-white mb-1" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Change</span>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleAvatarChange} 
          />
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <h2 className="bungee text-3xl md:text-4xl">@{user.username}</h2>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
            >
              Update Photo
            </button>
          </div>
          
          <div className="flex justify-center md:justify-start gap-8 mb-6">
            <div className="text-center md:text-left">
              <span className="block text-2xl font-black text-white">{videos.length}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Uploads</span>
            </div>
            <div className="text-center md:text-left">
              <span className="block text-2xl font-black text-white">{totalTrips.toLocaleString()}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total Trips</span>
            </div>
            <div className="text-center md:text-left group cursor-help" title="Collect points by voting, uploading, and commenting!">
              <div className="flex items-center gap-1.5 justify-center md:justify-start mb-[-2px]">
                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full flex items-center justify-center text-[6px] text-black font-black">★</div>
                <span className="block text-2xl font-black text-yellow-500 tabular-nums">{user.points.toLocaleString()}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Win Points</span>
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm max-w-md">
            I'm here to find the wildest trips on the internet. Follow me for daily madness! 🔥
          </p>
        </div>
      </div>

      {/* Play Store Promo */}
      <div className="mb-12 bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-800 p-6 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#A855F7_0%,transparent_50%)]"></div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-black p-3 rounded-2xl border border-zinc-700">
             <PlayStoreIcon className="w-10 h-10" />
          </div>
          <div>
            <h4 className="bungee text-lg">TRIPPIN' TV ON THE GO</h4>
            <p className="text-zinc-400 text-xs">Download for Android to get real-time notifications when your trips trend!</p>
          </div>
        </div>
        
        <button className="bg-white text-black font-black px-8 py-3 rounded-full text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors relative z-10 whitespace-nowrap shadow-xl">
          GET IT ON PLAY STORE
        </button>
      </div>

      {/* Grid of User's Videos */}
      <h3 className="bungee text-xl mb-6 flex items-center gap-3">
        MY TRIPS
        <div className="h-[2px] flex-1 bg-zinc-800"></div>
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {videos.map(v => (
          <div key={v.id} className="group relative aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer">
            <img src={v.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={v.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-4">
              <div className="translate-y-4 group-hover:translate-y-0 transition-transform">
                <span className="text-xs font-black text-white bg-purple-600 px-2 py-1 rounded mb-1 inline-block">{v.trips.toLocaleString()} TRIPS</span>
                <span className="text-[10px] text-zinc-300 line-clamp-2 uppercase font-bold tracking-tighter leading-tight">{v.title}</span>
              </div>
            </div>
          </div>
        ))}
        
        {videos.length === 0 && (
          <div className="col-span-full py-20 text-center bg-zinc-900 rounded-3xl border border-dashed border-zinc-800">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusIcon className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-zinc-500 mb-4 font-medium uppercase tracking-widest text-sm">No trips yet...</p>
            <button className="bg-purple-600 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-purple-600/20">Start Trippin'</button>
          </div>
        )}
      </div>
    </div>
  );
};

const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const CameraIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const PlayStoreIcon = ({className}: {className:string}) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.59363 2.11272C3.41446 2.29188 3.31348 2.53488 3.31348 2.78822V21.2117C3.31348 2.46506 3.41446 2.70806 3.59363 2.88722L12.9801 12L3.59363 2.11272Z" fill="#2196F3"/>
    <path d="M16.1417 8.8385L3.59363 2.11272L12.9801 12L16.1417 8.8385Z" fill="#4CAF50"/>
    <path d="M16.1417 15.1615L12.9801 12L3.59363 21.8872L16.1417 15.1615Z" fill="#F44336"/>
    <path d="M20.4064 11.1128L16.1417 8.8385L12.9801 12L16.1417 15.1615L20.4064 12.8872C20.7766 12.6901 21.0066 12.3082 21.0066 11.9064C21.0066 11.5046 20.7766 11.1227 20.4064 10.9256L20.4064 11.1128Z" fill="#FFC107"/>
  </svg>
);

export default ProfileView;
