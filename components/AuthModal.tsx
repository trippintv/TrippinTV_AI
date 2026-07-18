
import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../src/lib/supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Bypass email confirmation dependency: confirm the user server-side
        // so login works immediately (email delivery may be rate-limited).
        try {
          await fetch('/api/auth/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
        } catch {
          // non-fatal; fall back to email confirmation if admin confirm fails
        }
        if (data.session) {
          onAuthSuccess();
        } else {
          alert('Account created! You can now log in.');
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      alert(err.message || 'Google Login Failed');
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
          <button 
            onClick={handleGoogleLogin}
            disabled={isProcessing}
            className="flex items-center gap-3 bg-white text-black font-bold py-3 px-6 rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
          </button>
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-zinc-800 w-full"></div>
          <span className="bg-zinc-900 px-4 text-zinc-500 text-[10px] font-bold uppercase tracking-widest absolute">OR</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-4 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="tripper@example.com"
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
