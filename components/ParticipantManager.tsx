
import React, { useState } from 'react';
import { Participant } from '../types.ts';

interface Props {
  participants: Participant[];
  onAdd: (name: string, upiId?: string) => Promise<void>;
  onRemove: (id: string) => void;
}

const ParticipantManager: React.FC<Props> = ({ participants, onAdd, onRemove }) => {
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !isAdding) {
      setIsAdding(true);
      try {
        await onAdd(name.trim(), upiId.trim() || undefined);
        setName('');
        setUpiId('');
      } finally {
        setIsAdding(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 text-[#1e293b] mb-6 justify-center lg:justify-start">
        <i className="fa-solid fa-users text-[#4f46e5]"></i>
        <h2 className="text-lg font-bold">The Squad</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Member Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul, Priya"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">UPI ID (Optional)</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. rahul@okaxis"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
        <button
          type="submit"
          disabled={isAdding}
          className="w-full bg-[#4f46e5] text-white px-5 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-[#4338ca] transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          {isAdding ? <i className="fa-solid fa-spinner animate-spin"></i> : "Add to Squad"}
        </button>
      </form>

      <div className="mt-8 space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-hide">
        {participants.length === 0 ? (
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] text-center py-10">
            SQUAD IS EMPTY
          </p>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-xl bg-slate-100 shadow-sm shrink-0" />
                <div className="min-w-0">
                  <p className="font-black text-sm text-[#1e293b] truncate leading-tight">{p.name}</p>
                  {p.upiId && <p className="text-[9px] text-slate-400 font-bold truncate tracking-tight">{p.upiId}</p>}
                </div>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-300 hover:text-red-500 p-2 shrink-0 transition-colors"
              >
                <i className="fa-solid fa-circle-xmark text-lg"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;
