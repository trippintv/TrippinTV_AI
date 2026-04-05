
import React, { useState } from 'react';
import { addSafetyReport } from '../services/SafetyService';

interface ReportModalProps {
  onClose: () => void;
  contentTitle: string;
  category: string;
  reporter?: string;
}

const ReportModal: React.FC<ReportModalProps> = ({ onClose, contentTitle, category, reporter }) => {
  const [reason, setReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setIsSending(true);
    
    try {
      await addSafetyReport({
        type: 'USER_MANUAL',
        category,
        content: contentTitle,
        reason: reason.trim(),
        reporter
      });
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      alert("Failed to submit report");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        {!isSubmitted ? (
          <>
            <h3 className="bungee text-2xl text-white mb-2 uppercase">REPORT ACTIVITY</h3>
            <p className="text-zinc-400 text-sm mb-6 uppercase tracking-widest font-bold">Reporting: {contentTitle}</p>
            
            <div className="space-y-4">
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you reporting this?..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-sm text-white h-32 focus:outline-none focus:ring-1 focus:ring-red-500"
                disabled={isSending}
              />
              
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={handleSubmit}
                  disabled={!reason.trim() || isSending}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isSending ? 'SENDING...' : 'SUBMIT REPORT'}
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 text-center animate-in fade-in duration-500">
            <h3 className="bungee text-xl text-white mb-2">REPORT RECEIVED</h3>
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Thank you for keeping Trippin' TV safe!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
