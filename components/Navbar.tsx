
import React from 'react';
import { User, ViewType } from '../types';
import Logo from './Logo';

interface NavbarProps {
  user: User | null;
  onAuthClick: () => void;
  onUploadClick: () => void;
  onViewChange: (view: ViewType) => void;
  currentView: ViewType;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onAuthClick, onUploadClick, onViewChange, currentView, onLogout }) => {
  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 md:px-8 py-3 flex justify-between items-center">
      <div 
        className="flex items-center cursor-pointer" 
        onClick={() => onViewChange('feed')}
      >
        <Logo className="w-10 h-10 md:w-12 md:h-12" />
      </div>

      <div className="hidden lg:flex flex-1 max-w-md mx-8">
        <div className="relative w-full group">
          <input 
            type="text" 
            placeholder="Search wild trips..." 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 px-10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 text-sm transition-all"
          />
          <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-purple-500 transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => onViewChange('leaderboard')}
          className={`hidden md:block px-4 py-2 rounded-full text-sm font-bold tracking-tight transition-all hover:scale-105 ${currentView === 'leaderboard' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
        >
          Leaderboard
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            {/* Points Display */}
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full shadow-inner group hover:border-yellow-500/50 transition-colors cursor-help" title="Your Trippin' Points">
              <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-black font-black animate-pulse">★</div>
              <span className="text-white font-black text-xs tabular-nums">{user.points.toLocaleString()}</span>
            </div>

            <button 
              onClick={onUploadClick}
              className="hidden md:flex items-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-white px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
            >
              <PlusIcon className="w-4 h-4 text-purple-500" />
              Upload
            </button>
            <div className="group relative">
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 cursor-pointer transition-transform hover:rotate-6">
                <img 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-9 h-9 rounded-full border-2 border-black"
                  onClick={() => onViewChange('profile')}
                />
              </div>
              <div className="absolute right-0 top-12 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all translate-y-2 group-hover:translate-y-0">
                <div className="px-4 py-2 border-b border-zinc-800 mb-2">
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Signed in as</p>
                  <p className="text-sm font-bold">@{user.username}</p>
                </div>
                <button onClick={() => onViewChange('profile')} className="w-full text-left px-4 py-2 hover:bg-zinc-800 rounded-xl text-sm transition-colors flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> View Profile
                </button>
                <button onClick={onLogout} className="w-full text-left px-4 py-2 hover:bg-red-500/10 rounded-xl text-sm text-red-400 transition-colors flex items-center gap-2 mt-1">
                  <LogoutIcon className="w-4 h-4" /> Log Out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={onAuthClick}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white px-6 py-2.5 rounded-full text-sm font-black tracking-widest transition-all hover:scale-105 shadow-lg shadow-purple-600/20 active:scale-95"
          >
            LOG IN
          </button>
        )}
      </div>
    </nav>
  );
};

const SearchIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const PlusIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const LogoutIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;

export default Navbar;
