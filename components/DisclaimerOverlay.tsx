
import React from 'react';

interface DisclaimerOverlayProps {
  onAgree: () => void;
}

const DisclaimerOverlay: React.FC<DisclaimerOverlayProps> = ({ onAgree }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-[40px] p-10 text-center shadow-[0_0_100px_rgba(147,51,234,0.15)]">
        <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce shadow-lg shadow-purple-600/50">
          <ShieldIcon className="w-10 h-10" />
        </div>
        
        <h2 className="bungee text-3xl mb-4">THE CODE OF CONDUCT</h2>
        
        <div className="text-zinc-400 space-y-4 text-sm mb-8 text-left bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700">
          <p className="flex gap-3">
            <span className="text-purple-500 font-black">1.</span>
            No harassment or bullying. We're here for laughs, not hate.
          </p>
          <p className="flex gap-3">
            <span className="text-purple-500 font-black">2.</span>
            No dangerous stunts that result in serious injury or death.
          </p>
          <p className="flex gap-3">
            <span className="text-purple-500 font-black">3.</span>
            Privacy matters. Do not upload sensitive or non-consensual content.
          </p>
          <p className="flex gap-3">
            <span className="text-purple-500 font-black">4.</span>
            The prizes are real. One account per person. Any cheating = Ban.
          </p>
          <p className="mt-4 italic text-zinc-500 text-xs">
            By clicking agree, you acknowledge that you are responsible for the content you upload and hold Trippin' TV harmless for any legal actions arising from your posts.
          </p>
        </div>

        <button 
          onClick={onAgree}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-2xl text-lg transition-transform active:scale-[0.97] shadow-xl shadow-purple-600/20"
        >
          I AGREE & UNDERSTAND
        </button>
      </div>
      </div>
    </div>
  );
};

const ShieldIcon = ({className}: {className:string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;

export default DisclaimerOverlay;
