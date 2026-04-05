
import React, { useState, useRef, useEffect } from 'react';
import { generateFunnyCaption, moderateContent } from '../services/geminiService';
import { User, Video } from '../types';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (newVideo: Omit<Video, 'id' | 'createdAt' | 'trips' | 'comments'>, file?: File) => void;
  user: User;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, user }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleAiCaption = async () => {
    if (!description) return;
    setIsGeneratingAi(true);
    const aiTitle = await generateFunnyCaption(description);
    setTitle(aiTitle);
    setIsGeneratingAi(false);
  };

  const handleUpload = async () => {
    if (!title || !description || !previewUrl || !file) return;
    setIsUploading(true);
    setSafetyError(null);

    // AI Safety Check
    const safetyResult = await moderateContent(`${title} ${description}`, 'video_meta');
    if (!safetyResult.safe) {
      setSafetyError(`Safety Alert: ${safetyResult.reason}`);
      setIsUploading(false);
      return;
    }

    // Simulated upload progress
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }
    
    onUpload({
      userId: user.id,
      username: user.username,
      title,
      description,
      videoUrl: '', // Will be set by server
      thumbnailUrl: '', // Will be set by server
    }, file);
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-4xl rounded-[40px] overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh]">
        <div className="md:w-1/2 bg-black flex flex-col items-center justify-center min-h-[300px]">
          {!file ? (
            <label className="cursor-pointer text-center p-12">
              <span className="bungee text-xl text-white">CHOOSE VIDEO</span>
              <input type="file" className="hidden" accept="video/*" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
            </label>
          ) : (
            <video src={previewUrl || ''} className="w-full h-full object-cover" controls />
          )}
        </div>
        <div className="md:w-1/2 p-8 bg-zinc-900 overflow-y-auto">
          <h3 className="bungee text-2xl mb-8 uppercase tracking-widest bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">POST A TRIP</h3>
          <div className="space-y-6">
            {safetyError && (
              <div className="bg-red-500/10 border border-red-500 p-3 rounded-xl text-red-500 text-xs font-bold animate-pulse">
                {safetyError}
              </div>
            )}
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-4 px-5 h-28 focus:outline-none"
              placeholder="Describe the trip..."
            />
            <div className="flex gap-2">
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl py-4 px-5 focus:outline-none"
                placeholder="Title"
              />
              <button onClick={handleAiCaption} className="bg-white text-black px-4 rounded-2xl font-black text-[10px] uppercase disabled:opacity-50" disabled={isGeneratingAi}>
                {isGeneratingAi ? '...' : 'AI Title'}
              </button>
            </div>
          </div>
          <button 
            onClick={handleUpload} 
            disabled={isUploading || !file || !title || !description}
            className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl mt-8 shadow-xl disabled:opacity-50"
          >
            {isUploading ? `UPLOADING ${uploadProgress}%` : 'GO LIVE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
