
import React, { useState, useEffect, useMemo } from 'react';

const Leaderboard = ({ videos }) => {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
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
    const userStats = {};
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
        <div className="flex justify-center gap-4">
          {[
            { label: 'DAYS', val: timeLeft.d },
            { label: 'HRS', val: timeLeft.h },
            { label: 'MINS', val: timeLeft.m },
            { label: 'SECS', val: timeLeft.s }
          ].map((item) => (
            <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-20">
              <span className="block text-2xl font-black text-white">{String(item.val).padStart(2, '0')}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-zinc-900 rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl">
        {rankings.map(([userId, stats], index) => (
          <div key={userId} className="flex items-center justify-between p-6 border-b border-zinc-800 last:border-0">
            <div className="flex items-center gap-6">
              <span className="bungee text-2xl w-8 text-center text-zinc-600">{index + 1}</span>
              <div className="flex items-center gap-4">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stats.username}`} className="w-12 h-12 rounded-full" alt="" />
                <h3 className="font-bold text-lg">@{stats.username}</h3>
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
