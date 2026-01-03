
import React, { useState } from 'react';

const AuthModal = ({ onClose, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[32px] p-8">
        <h2 className="bungee text-3xl text-center mb-8 uppercase tracking-widest bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          {isLogin ? 'WELCOME BACK' : 'JOIN THE CREW'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" 
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-4 focus:outline-none focus:border-purple-500 transition-colors"
            placeholder="Username"
          />
          <button type="submit" className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl">
            {isLogin ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-sm text-zinc-500 mt-4 underline">
          {isLogin ? "Need an account?" : "Have an account?"}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
