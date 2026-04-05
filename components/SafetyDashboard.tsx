import React, { useState, useEffect } from 'react';
import { getSafetyReports, clearSafetyReports, SafetyReport } from '../services/SafetyService';

const SafetyDashboard: React.FC = () => {
  const [reports, setReports] = useState<SafetyReport[]>([]);

  const fetchReports = async () => {
    const data = await getSafetyReports();
    setReports(data);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleClear = async () => {
    await clearSafetyReports();
    setReports([]);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="bungee text-3xl text-white">SAFETY COMMAND</h2>
          <p className="text-zinc-500 text-sm mt-1 uppercase font-bold tracking-widest">AI Bots & Manual Community Reports</p>
        </div>
        <button 
          onClick={handleClear}
          className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700"
        >
          Clear Logs
        </button>
      </div>

      <div className="space-y-4">
        {reports.length > 0 ? (
          reports.map((report, i) => (
            <div key={i} className={`bg-zinc-900 border ${report.type === 'AI_AUTO' ? 'border-red-500/20' : 'border-yellow-500/20'} p-6 rounded-[32px] animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <span className={`${report.type === 'AI_AUTO' ? 'bg-red-500' : 'bg-yellow-500 text-black'} text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>
                    {report.type}
                  </span>
                  <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    {report.category}
                  </span>
                </div>
                <span className="text-zinc-500 text-[10px] font-bold">
                  {new Date(report.timestamp).toLocaleString()}
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-white text-sm font-bold mb-1 uppercase tracking-tighter">Content / Target:</p>
                <p className="text-zinc-400 text-sm italic">"{report.content}"</p>
              </div>

              <div className={`p-4 rounded-2xl border ${report.type === 'AI_AUTO' ? 'bg-red-500/5 border-red-500/10' : 'bg-yellow-500/5 border-yellow-500/10'}`}>
                <p className={`${report.type === 'AI_AUTO' ? 'text-red-400' : 'text-yellow-400'} text-[10px] font-black uppercase mb-1 tracking-widest`}>
                  {report.type === 'AI_AUTO' ? 'AI Reason for removal:' : `User Report Reason (by ${report.reporter}):`}
                </p>
                <p className="text-zinc-200 text-sm">{report.reason}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-zinc-900 rounded-[40px] border border-dashed border-zinc-800">
            <p className="text-zinc-500 font-black uppercase tracking-widest">System Clear</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyDashboard;
