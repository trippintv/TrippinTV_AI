
import React, { useState, useRef, useEffect } from 'react';
import { generateFunnyCaption } from '../services/geminiService';

const UploadModal = ({ onClose, onUpload, user }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

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
    if (!title || !description || !previewUrl) return;
    setIsUploading(true);
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }
    onUpload({
      userId: user.id,
      username: user.username,
      title,
      description,
      videoUrl: previewUrl,
      thumbnailUrl: 'https://picsum.photos/seed/new/400/600',
    });
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
              <input type="file" className="hidden" accept="video/*" onChange={(e) => setFile(e.target.files[0])} />
            </label>
          ) : (
            <video src={previewUrl} className="w-full h-full object-cover" controls />
          )}
        </div>
        <div className="md:w-1/2 p-8 bg-zinc-900 overflow-y-auto">
          <h3 className="bungee text-2xl mb-8 uppercase tracking-widest bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">POST A TRIP</h3>
          <div className="space-y-6">
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
              <button onClick={handleAiCaption} className="bg-white text-black px-4 rounded-2xl font-black text-[10px] uppercase">AI Title</button>
            </div>
          </div>
          <button 
            onClick={handleUpload} 
            disabled={isUploading}
            className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl mt-8 shadow-xl"
          >
            {isUploading ? `UPLOADING ${uploadProgress}%` : 'GO LIVE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
