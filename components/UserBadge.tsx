import React, { useState, useEffect } from 'react';
import { UserLevel } from '../types';
import { apiFetch } from '../src/lib/api';

interface UserBadgeProps {
  userId: string;
  compact?: boolean;
}

const UserBadge: React.FC<UserBadgeProps> = ({ userId, compact = false }) => {
  const [level, setLevel] = useState<UserLevel | null>(null);

  useEffect(() => {
    apiFetch(`/api/users/${userId}/level`).then(r => r.json()).then(setLevel).catch(() => {});
  }, [userId]);

  if (!level) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-600/15 border border-purple-600/30 rounded-full px-2 py-0.5">
        {level.badges[0] && <span>{level.badges[0]}</span>}
        <span>Lv.{level.level}</span>
      </span>
    );
  }

  return (
    <div className="bg-zinc-800/40 rounded-2xl border border-zinc-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {level.badges.map((b, i) => <span key={i} className="text-lg">{b}</span>)}
          <div>
            <p className="text-xs font-black text-purple-300">LEVEL {level.level}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{level.name}</p>
          </div>
        </div>
        <span className="text-xs text-zinc-500">{level.xp.toLocaleString()} XP</span>
      </div>
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(level.progress * 100, 2)}%` }}
        />
      </div>
      {level.level < 10 && (
        <p className="text-[9px] text-zinc-600 mt-1 text-right">
          {(level.nextLevelXp - level.xp).toLocaleString()} XP to next level
        </p>
      )}
    </div>
  );
};

export default UserBadge;
