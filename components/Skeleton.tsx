import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="bg-zinc-900 rounded-3xl overflow-hidden w-full max-w-[420px] border border-zinc-800 animate-fade-in-up">
    <div className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-full" />
        <div className="flex-1">
          <div className="skeleton h-3 w-24 mb-2" />
          <div className="skeleton h-2 w-16" />
        </div>
      </div>
      <div className="skeleton h-3 w-full mb-2" />
      <div className="skeleton h-3 w-3/4" />
    </div>
    <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-6">
      <div className="skeleton h-4 w-12" />
      <div className="skeleton h-4 w-12" />
      <div className="skeleton h-4 w-12" />
    </div>
  </div>
);

export const SkeletonFeed: React.FC = () => (
  <div className="flex flex-col items-center gap-8 py-4">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
);

export const SkeletonPost: React.FC = () => (
  <div className="bg-zinc-900 rounded-3xl overflow-hidden w-full max-w-[420px] border border-zinc-800 animate-fade-in-up">
    <div className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-full" />
        <div className="flex-1">
          <div className="skeleton h-3 w-24 mb-2" />
          <div className="skeleton h-2 w-12" />
        </div>
      </div>
      <div className="skeleton h-4 w-48 mb-3" />
      <div className="skeleton h-3 w-full mb-1.5" />
      <div className="skeleton h-3 w-full mb-1.5" />
      <div className="skeleton h-3 w-2/3" />
    </div>
    <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-6">
      <div className="skeleton h-4 w-12" />
      <div className="skeleton h-4 w-12" />
      <div className="skeleton h-4 w-12" />
    </div>
  </div>
);

export const SkeletonProfile: React.FC = () => (
  <div className="max-w-2xl mx-auto pb-10">
    <div className="flex items-center gap-6 mb-8">
      <div className="skeleton w-24 h-24 rounded-full" />
      <div className="flex-1">
        <div className="skeleton h-5 w-32 mb-3" />
        <div className="skeleton h-3 w-48 mb-2" />
        <div className="skeleton h-3 w-36" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
);
