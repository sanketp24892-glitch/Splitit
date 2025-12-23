
import React, { useState } from 'react';
import { Participant } from '../types';

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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <i className="fa-solid fa-users text-indigo-600"></i>
        The Squad
      </h2>
      
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name..."
          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </form>

      <div className="space-y-3">
        {participants.length === 0 ? (
          <p className="text-slate-400 text-center py-4">No members yet.</p>
        ) : (
          participants.map(p => (
            <div key={p.id} className="flex items-center justify-between group bg-slate-50 p-3 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200" />
                <span className="font-medium text-slate-700">{p.name}</span>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantManager;
