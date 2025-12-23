
import React, { useState } from 'react';
import { Participant } from '../types.ts';

interface Props {
  participants: Participant[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

const ParticipantManager: React.FC<Props> = ({ participants, onAdd, onRemove }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full">
      <div className="flex items-center gap-2 text-[#1e293b] mb-6">
        <i className="fa-solid fa-users text-[#4f46e5]"></i>
        <h2 className="text-xl font-bold">The Squad</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member Name"
          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-[#4f46e5] transition-colors placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="w-full bg-[#4f46e5] text-white px-5 py-4 rounded-xl font-bold text-sm hover:bg-[#4338ca] transition-all shadow-md active:scale-[0.98]"
        >
          Add to Squad
        </button>
      </form>

      <div className="mt-10 space-y-4">
        {participants.length === 0 ? (
          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest text-center py-4">
            NO MEMBERS YET
          </p>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-lg bg-slate-100" />
                <div>
                  <p className="font-bold text-sm text-[#1e293b]">{p.name}</p>
                </div>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;