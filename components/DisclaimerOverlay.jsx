
import React from 'react';

const DisclaimerOverlay = ({ onAgree }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-[40px] p-10 text-center">
        <h2 className="bungee text-3xl mb-8 uppercase tracking-widest">THE CODE OF CONDUCT</h2>
        <div className="text-zinc-400 space-y-4 text-sm mb-8 text-left bg-zinc-800 p-6 rounded-2xl border border-zinc-700">
          <p>1. No harassment or bullying.</p>
          <p>2. No dangerous stunts resulting in serious injury.</p>
          <p>3. Privacy matters. Consent is key.</p>
          <p>4. Weekly prizes are real. One account per tripper.</p>
        </div>
        <button 
          onClick={onAgree}
          className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-purple-600/20"
        >
          I AGREE & UNDERSTAND
        </button>
      </div>
    </div>
  );
};

export default DisclaimerOverlay;
