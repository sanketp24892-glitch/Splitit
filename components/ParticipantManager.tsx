
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
        <i className="fa-solid fa-users text-indigo-600"></i>
        The Squad
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member Name"
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
        />
        <div className="relative">
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="UPI ID (optional, e.g. name@upi)"
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm pr-10"
          />
          <i className="fa-solid fa-qrcode absolute right-3 top-2.5 text-slate-300"></i>
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm shadow-md shadow-indigo-100"
        >
          Add to Squad
        </button>
      </form>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {participants.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No members yet</p>
          </div>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group bg-slate-50 p-3 rounded-xl border border-transparent hover:border-slate-200 transition-all">
              <div className="flex items-center gap-3">
                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200" />
                <div>
                  <div className="font-bold text-slate-700 text-sm">{p.name}</div>
                  {p.upiId && (
                    <div className="text-[10px] text-slate-400 font-mono">{p.upiId}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                title="Remove Member"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;
