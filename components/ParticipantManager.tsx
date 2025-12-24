
import React, { useState } from 'react';
import { Participant } from '../types.ts';

interface Props {
  participants: Participant[];
  onAdd: (name: string, upiId?: string) => void;
  onRemove: (id: string) => void;
}

const ParticipantManager: React.FC<Props> = ({ participants, onAdd, onRemove }) => {
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), upiId.trim() || undefined);
      setName('');
      setUpiId('');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full">
      <div className="flex items-center gap-2 text-[#1e293b] mb-6">
        <i className="fa-solid fa-users text-[#4f46e5]"></i>
        <h2 className="text-lg sm:text-xl font-bold">The Squad</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Add Member</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul, Priya"
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">UPI ID (Optional)</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. rahul@okaxis"
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[#4f46e5] text-white px-5 py-4 rounded-xl font-bold text-sm hover:bg-[#4338ca] transition-all shadow-md active:scale-[0.98]"
        >
          Add to Squad
        </button>
      </form>

      <div className="mt-8 space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-hide">
        {participants.length === 0 ? (
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center py-6">
            NO MEMBERS YET
          </p>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-xl bg-slate-100 shadow-sm shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1e293b] truncate">{p.name}</p>
                  {p.upiId && <p className="text-[9px] text-slate-400 font-bold truncate">{p.upiId}</p>}
                </div>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-300 hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all p-2 shrink-0"
              >
                <i className="fa-solid fa-circle-xmark text-base"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;
