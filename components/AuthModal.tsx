
import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { User } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (username: string) => void;
  onGoogleLogin: (userData: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLogin, onGoogleLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      if (!res.ok) throw new Error("Google auth failed");
      const userData = await res.json();
      onGoogleLogin(userData);
    } catch (err) {
      alert("Google Login Failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[32px] p-8 shadow-2xl overflow-hidden">
        {/* Aesthetic decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/20 blur-3xl -z-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-600/20 blur-3xl -z-10 rounded-full"></div>

        <div className="flex flex-col items-center text-center mb-8">
          <h2 className="bungee text-3xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
            {isLogin ? 'WELCOME BACK' : 'JOIN THE CREW'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {isLogin ? 'Ready to see who\'s trippin\' today?' : 'Start uploading and win weekly prizes!'}
          </p>
        </div>

        {/* Google Login Button */}
        <div className="flex justify-center mb-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => alert('Login Failed')}
            theme="filled_black"
            shape="pill"
            text={isLogin ? 'signin_with' : 'signup_with'}
          />
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-zinc-800 w-full"></div>
          <span className="bg-zinc-900 px-4 text-zinc-500 text-[10px] font-bold uppercase tracking-widest absolute">OR</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-4 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="CoolTripper99"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-4 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-600/20 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-zinc-800 text-center">
          <p className="text-zinc-500 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-purple-400 font-bold hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
