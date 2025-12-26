
import React, { useState } from 'react';
import { Participant } from '../types.ts';
import * as db from '../services/supabaseService.ts';

interface Props {
  participants: Participant[];
  onAdd: (name: string, upiId?: string) => Promise<void>;
  onRemove: (id: string) => void;
}

const ParticipantManager: React.FC<Props> = ({ participants, onAdd, onRemove }) => {
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUpi, setEditUpi] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName && !isAdding) {
      setIsAdding(true);
      try {
        await onAdd(trimmedName, upiId.trim() || undefined);
        setName('');
        setUpiId('');
      } catch (err) {
        console.error("Submit error:", err);
      } finally {
        setIsAdding(false);
      }
    }
  };

  const startEditing = (p: Participant) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditUpi(p.upiId || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await db.updateParticipant(editingId, { name: editName.trim(), upiId: editUpi.trim() || undefined });
      setEditingId(null);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1">
        <div className="flex items-center gap-2 text-[#1e293b] mb-6 justify-center lg:justify-start">
          <i className="fa-solid fa-users text-[#4f46e5]"></i>
          <h2 className="text-lg font-bold tracking-tight">The Squad</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Member Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. rahul, priya"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">UPI ID (Optional)</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. rahul@okaxis"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:outline-none focus:border-[#4f46e5] focus:bg-white transition-all placeholder:text-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={isAdding || !name.trim()}
            className="w-full bg-[#4f46e5] text-white px-5 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-[#4338ca] transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAdding ? <><i className="fa-solid fa-spinner animate-spin"></i> ADDING...</> : "Add to Squad"}
          </button>
        </form>

        <div className="mt-8 space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-hide">
          {participants.length === 0 ? (
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] text-center py-10">
              SQUAD IS EMPTY
            </p>
          ) : (
            participants.map(p => (
              <div key={p.id} className="flex items-center justify-between group p-3 rounded-2xl bg-white border border-slate-50 hover:bg-slate-50 hover:border-slate-100 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-xl bg-slate-100 shadow-sm shrink-0" />
                  
                  {editingId === p.id ? (
                    <div className="flex flex-col gap-1 flex-1 pr-2">
                      <input 
                        className="text-xs font-bold border-b border-indigo-200 outline-none bg-transparent lowercase"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                      <input 
                        className="text-[8px] border-b border-indigo-100 outline-none bg-transparent text-slate-400"
                        value={editUpi}
                        onChange={e => setEditUpi(e.target.value)}
                        placeholder="UPI ID"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="font-black text-sm text-[#1e293b] truncate leading-tight lowercase tracking-tight">{p.name}</p>
                      {p.upiId && <p className="text-[9px] text-slate-400 font-bold truncate tracking-tight">{p.upiId}</p>}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  {editingId === p.id ? (
                    <>
                      <button onClick={saveEdit} className="text-green-500 p-2 hover:bg-green-50 rounded-lg transition-colors">
                        <i className="fa-solid fa-check"></i>
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(p)} className="text-slate-300 hover:text-indigo-500 p-2 transition-colors">
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => onRemove(p.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                        <i className="fa-solid fa-circle-xmark text-lg"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-1">
        <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight">
          Less maths. More memories.
        </p>
        <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">
          Try Splitit → <span className="underline">www.splitits.in</span>
        </p>
      </div>
    </div>
  );
};

export default ParticipantManager;
