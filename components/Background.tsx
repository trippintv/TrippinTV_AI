
import React from 'react';

// Fixed, understated background: soft purple/pink ambient glows plus a large
// ghosted TV-mascot watermark. Purely decorative, never intercepts pointer events.
const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Ambient glows */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(circle at 18% 10%, rgba(168,85,247,0.14), transparent 55%)',
            'radial-gradient(circle at 85% 90%, rgba(236,72,153,0.12), transparent 55%)',
            'radial-gradient(circle at 72% 8%, rgba(99,102,241,0.08), transparent 50%)',
            'radial-gradient(circle at 25% 92%, rgba(168,85,247,0.07), transparent 50%)',
          ].join(','),
        }}
      />

      {/* Ghost mascot watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <GhostTV className="w-[48vw] h-auto md:w-[340px] opacity-[0.05]" />
      </div>
    </div>
  );
};

const GhostTV = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="bgLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <line x1="30" y1="10" x2="50" y2="30" stroke="url(#bgLogoGrad)" strokeWidth="6" strokeLinecap="round" />
    <line x1="70" y1="10" x2="50" y2="30" stroke="url(#bgLogoGrad)" strokeWidth="6" strokeLinecap="round" />
    <path d="M10,35 Q10,30 15,30 L85,30 Q90,30 90,35 L90,75 Q90,85 80,85 L70,85 Q65,95 60,85 L40,85 Q35,95 30,85 L20,85 Q10,85 10,75 Z" fill="url(#bgLogoGrad)" />
    <rect x="20" y="40" width="50" height="35" rx="4" fill="black" fillOpacity="0.4" />
    <path d="M40,48 L55,57.5 L40,67 Z" fill="white" />
    <circle cx="80" cy="45" r="3" fill="white" />
    <circle cx="80" cy="55" r="3" fill="white" />
  </svg>
);

export default Background;
