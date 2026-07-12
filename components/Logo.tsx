
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", showText = true }) => {
  return (
    <div className={`flex items-center gap-3 group cursor-pointer ${className}`}>
      <div className="relative">
        {/* Shadow Glitch Effect */}
        <div className="absolute inset-0 translate-x-1 translate-y-1 bg-pink-500 rounded-lg blur-sm opacity-50 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform"></div>
        
        {/* Main TV Icon */}
        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 filter drop-shadow-lg">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#A855F7' }} />
              <stop offset="100%" style={{ stopColor: '#EC4899' }} />
            </linearGradient>
          </defs>
          
          {/* Antennas */}
          <line x1="30" y1="10" x2="50" y2="30" stroke="url(#logoGrad)" strokeWidth="6" strokeLinecap="round" />
          <line x1="70" y1="10" x2="50" y2="30" stroke="url(#logoGrad)" strokeWidth="6" strokeLinecap="round" />
          
          {/* TV Body with 'Melt' effect at the bottom */}
          <path 
            d="M10,35 Q10,30 15,30 L85,30 Q90,30 90,35 L90,75 Q90,85 80,85 L70,85 Q65,95 60,85 L40,85 Q35,95 30,85 L20,85 Q10,85 10,75 Z" 
            fill="url(#logoGrad)" 
          />
          
          {/* Screen Area */}
          <rect x="20" y="40" width="50" height="35" rx="4" fill="black" fillOpacity="0.4" />
          
          {/* Play Button */}
          <path d="M40,48 L55,57.5 L40,67 Z" fill="white" />
          
          {/* Dial Dots */}
          <circle cx="80" cy="45" r="3" fill="white" />
          <circle cx="80" cy="55" r="3" fill="white" />
        </svg>
      </div>
      
      {showText && (
        <span className="bungee text-2xl tracking-tighter leading-none select-none bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent group-hover:skew-x-3 transition-transform">
          TRIPPIN'<br/><span className="text-xl tracking-[0.2em] text-white">TV</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
