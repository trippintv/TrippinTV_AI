
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { apiFetch } from '../src/lib/api';
import { showRewardedAd } from '../src/lib/admob';

interface VideoGeneratorProps {
  user: User;
  onClose: () => void;
  onVideoCreated: (video: any) => void;
  getToken: () => Promise<string | null>;
}

const PROMPT_IDEAS = [
  "Epic drone shot over neon-lit Tokyo at night, cyberpunk style",
  "Slow motion wolf howling at a blood moon on a mountain cliff",
  "Underwater coral reef with bioluminescent jellyfish, dreamy",
  "Time-lapse of northern lights over frozen lake, ultra HD",
  "Motorcycle ride through a desert canyon at golden hour",
  "Astronaut floating in space with Earth reflecting in visor",
  "Street food vendor in Bangkok at night, cinematic lighting",
  "Surfer riding a massive wave at sunset, barrel view",
];

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ user, onClose, onVideoCreated, getToken }) => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'polling' | 'preview' | 'error'>('idle');
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (user.credits < 5) {
      setErrorMsg('Not enough credits. You need 5 credits to generate a video.');
      setStatus('error');
      return;
    }

    setStatus('generating');
    setErrorMsg('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await apiFetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setPredictionId(data.predictionId);
      setStatus('polling');
      pollGeneration(data.predictionId);
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const pollGeneration = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiFetch(`/api/generate-video/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.status === 'succeeded') {
          if (pollRef.current) clearInterval(pollRef.current);
          const url = Array.isArray(data.videoUrl) ? data.videoUrl[0] : data.videoUrl;
          setVideoUrl(url);
          setTitle(prompt.slice(0, 80));
          setDescription(prompt);
          setStatus('preview');
        } else if (data.status === 'failed' || data.status === 'canceled') {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMsg(data.error || 'Generation failed. Credits refunded.');
          setStatus('error');
          if (data.credits !== undefined) {
            // Update local user credits
            user.credits = data.credits;
          }
        }
        // else still polling
      } catch {
        // keep polling on transient errors
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!videoUrl || !title.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await apiFetch('/api/videos/from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoUrl,
          title: title.trim(),
          description: description.trim() || prompt.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }

      const video = await res.json();
      onVideoCreated(video);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const pickIdea = () => {
    const idea = PROMPT_IDEAS[Math.floor(Math.random() * PROMPT_IDEAS.length)];
    setPrompt(idea);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h3 className="bungee text-xl uppercase tracking-widest bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              AI VIDEO GENERATOR
            </h3>
            <p className="text-zinc-500 text-xs mt-1">
              Type a prompt → Get a video → Submit to contest
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1">
              {user.credits} credits
            </span>
            <button
              onClick={async () => {
                const earned = await showRewardedAd();
                if (earned) {
                  const token = await getToken();
                  if (token) {
                    const cr = await apiFetch('/api/credits/earn', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ action: 'ad' }),
                    });
                    if (cr.ok) {
                      const { credits } = await cr.json();
                      user.credits = credits;
                      window.location.reload(); // refresh user state
                    }
                  }
                }
              }}
              className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1 hover:bg-green-500/20 transition-colors"
            >
              🎬 Watch Ad +5
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl font-bold">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {status === 'idle' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  Describe your video
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A cinematic drone shot over misty mountains at sunrise with golden light..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-4 px-5 h-32 focus:outline-none focus:border-purple-500 text-sm text-white placeholder:text-zinc-600 resize-none"
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-zinc-600">{prompt.length}/500</span>
                  <button
                    onClick={pickIdea}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-widest"
                  >
                    Random idea
                  </button>
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500">
                  <span className="text-white font-bold">Cost:</span> 5 credits per generation
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Earn credits by voting (+1), commenting (+2), posting (+3), daily login (+5)
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || user.credits < 5}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-4 rounded-2xl shadow-xl disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-purple-500/20 transition-shadow text-sm uppercase tracking-widest"
              >
                {user.credits < 5 ? 'NOT ENOUGH CREDITS' : 'GENERATE VIDEO (5 credits)'}
              </button>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex flex-col items-center py-12 space-y-6">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Starting generation...</p>
                <p className="text-xs text-zinc-500 mt-1">This takes 1-3 minutes</p>
              </div>
            </div>
          )}

          {status === 'polling' && (
            <div className="flex flex-col items-center py-12 space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-400">AI</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">Generating your video...</p>
                <p className="text-xs text-zinc-500 mt-1">This usually takes 1-3 minutes. Don't close this.</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {status === 'preview' && (
            <div className="space-y-6">
              <div className="rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[400px] mx-auto">
                <video
                  src={videoUrl || ''}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  loop
                />
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-5 focus:outline-none focus:border-purple-500 text-sm"
                  placeholder="Title for your video"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 px-5 h-20 focus:outline-none focus:border-purple-500 text-sm resize-none"
                  placeholder="Description (optional)"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStatus('idle'); setVideoUrl(null); setPredictionId(null); }}
                  className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-2xl text-sm hover:bg-zinc-700 transition-colors"
                >
                  REGENERATE
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || submitting}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-4 rounded-2xl shadow-xl disabled:opacity-50 text-sm uppercase tracking-widest"
                >
                  {submitting ? 'SUBMITTING...' : 'SUBMIT TO CONTEST'}
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-12 space-y-6">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">!</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-red-400">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStatus('idle'); setErrorMsg(''); }}
                className="bg-zinc-800 text-white font-bold py-3 px-8 rounded-2xl text-sm hover:bg-zinc-700 transition-colors"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
