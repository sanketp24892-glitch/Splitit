
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
    <div className="space-y-12">
      <div className="space-y-8">
        <h2 className="text-4xl font-black tracking-tighter uppercase border-b-8 border-zinc-950 pb-4">Squad</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="group relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter member name..."
              className="w-full px-8 py-6 rounded-3xl bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-sm font-bold uppercase tracking-widest placeholder:text-zinc-300"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-zinc-950 text-white px-8 py-6 rounded-3xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-800 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            Add to Squad
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {participants.length === 0 ? (
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest text-center py-4">Squad list is empty</p>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group bg-white p-5 rounded-[2rem] border-2 border-zinc-100 hover:border-zinc-950 transition-all">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 border-2 border-zinc-100 flex items-center justify-center overflow-hidden group-hover:border-zinc-950 transition-colors">
                  <img src={p.avatar} alt={p.name} className="w-10 h-10 grayscale opacity-80 group-hover:opacity-100 transition-all" />
                </div>
                <span className="font-black text-xs uppercase tracking-[0.2em] text-zinc-800">{p.name}</span>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="w-10 h-10 flex items-center justify-center text-zinc-200 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;
