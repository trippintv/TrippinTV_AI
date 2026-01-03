
import React, { useState, useEffect, useMemo } from 'react';
import { Video } from '../types';

interface LeaderboardProps {
  videos: Video[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ videos }) => {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      // Target is next Sunday at midnight
      const nextSunday = new Date();
      nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
      nextSunday.setHours(23, 59, 59, 999);
      
      const diff = nextSunday.getTime() - now.getTime();
      if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
      
      return {
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60),
      };
    };

    const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
    setTimeLeft(calculateTime());
    return () => clearInterval(timer);
  }, []);

  const rankings = useMemo(() => {
    const userStats: Record<string, { trips: number; username: string }> = {};
    videos.forEach(v => {
      if (!userStats[v.userId]) {
        userStats[v.userId] = { trips: 0, username: v.username };
      }
      userStats[v.userId].trips += v.trips;
    });
    return Object.entries(userStats)
      .sort(([, a], [, b]) => b.trips - a.trips)
      .slice(0, 10);
  }, [videos]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h2 className="bungee text-4xl md:text-5xl bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-4">
          WEEKLY LEGENDS
        </h2>
        <p className="text-zinc-400 text-lg mb-8">Who's currently trippin' the hardest?</p>
        
        <div className="flex justify-center gap-4">
          {[
            { label: 'DAYS', val: timeLeft.d },
            { label: 'HRS', val: timeLeft.h },
            { label: 'MINS', val: timeLeft.m },
            { label: 'SECS', val: timeLeft.s }
          ].map((item) => (
            <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-20 shadow-xl">
              <span className="block text-2xl font-black text-white leading-none">{String(item.val).padStart(2, '0')}</span>
              <span className="text-[10px] font-bold text-zinc-500 mt-1 uppercase">{item.label}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-8 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-6 py-2 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-sm font-black text-green-400 tracking-widest uppercase">NEXT PRIZE: $500.00</span>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl">
        {rankings.map(([userId, stats], index) => (
          <div 
            key={userId} 
            className={`flex items-center justify-between p-6 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 transition-colors ${index < 3 ? 'bg-zinc-800/20' : ''}`}
          >
            <div className="flex items-center gap-6">
              <span className={`bungee text-2xl w-8 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-orange-500' : 'text-zinc-600'}`}>
                {index + 1}
              </span>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stats.username}`} className="w-12 h-12 rounded-full border-2 border-zinc-700" alt="" />
                  {index === 0 && <span className="absolute -top-2 -right-2 text-xl">👑</span>}
                </div>
                <div>
                  <h3 className="font-bold text-lg">@{stats.username}</h3>
                  <p className="text-zinc-500 text-xs uppercase font-bold tracking-tighter">Professional Tripper</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-purple-500">{stats.trips.toLocaleString()}</span>
              <span className="block text-[10px] text-zinc-500 uppercase font-bold">TRIPS</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
