
import React, { useState, useRef } from 'react';
import { Participant, Expense } from '../types.ts';
import { parseReceipt } from '../services/geminiService.ts';

interface Props {
  participants: Participant[];
  onAdd: (expense: Omit<Expense, 'id'>) => void;
}

const ExpenseForm: React.FC<Props> = ({ participants, onAdd }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Other');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAll = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description && amount && payerId && selectedParticipants.length > 0) {
      onAdd({
        description,
        amount: parseFloat(amount),
        payerId,
        participantIds: selectedParticipants,
        category,
        date: new Date(date).getTime()
      });
      setDescription('');
      setAmount('');
      setSelectedParticipants([]);
      setDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const data = await parseReceipt(base64);
      if (data) {
        setDescription(data.description);
        setAmount(data.amount.toString());
        setCategory(data.category);
      }
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-12 sticky top-32">
      <div className="flex justify-between items-baseline border-b-8 border-zinc-950 pb-6 mb-2">
        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">Add Expenses</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className={`flex items-center gap-3 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
            isScanning 
            ? 'bg-zinc-100 text-zinc-400'
            : 'bg-zinc-100 hover:bg-zinc-950 hover:text-white'
          }`}
        >
          {isScanning ? <i className="fa-solid fa-sync animate-spin"></i> : <i className="fa-solid fa-camera"></i>}
          <span>{isScanning ? "Processing" : "Scan Receipt"}</span>
        </button>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Description</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-8 py-6 rounded-[2rem] bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-sm font-bold uppercase tracking-widest"
            placeholder="COFFEE, DINNER, GAS..."
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Amount</label>
            <div className="relative">
              <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-zinc-950 text-lg">₹</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-14 pr-8 py-6 rounded-[2rem] bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-lg font-black tracking-tighter"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-8 py-6 rounded-[2rem] bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-xs font-bold uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-8 py-6 rounded-[2rem] bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-[10px] font-bold uppercase tracking-widest appearance-none"
            >
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Lodging">Lodging</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Paid By</label>
            <select
              required
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="w-full px-8 py-6 rounded-[2rem] bg-zinc-100 border-2 border-transparent focus:bg-white focus:border-zinc-950 outline-none transition-all text-[10px] font-bold uppercase tracking-widest appearance-none"
            >
              <option value="" disabled>Select Payer</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Split Among</label>
            <button type="button" onClick={handleAll} className="text-[10px] font-black text-zinc-950 underline decoration-2 underline-offset-4 uppercase tracking-widest">Select All</button>
          </div>
          <div className="flex flex-wrap gap-2.5 p-6 bg-zinc-50 rounded-[2.5rem] border-2 border-zinc-100">
            {participants.length === 0 ? (
              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest w-full text-center">No squad members added</p>
            ) : (
              participants.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleParticipant(p.id)}
                  className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedParticipants.includes(p.id)
                      ? 'bg-zinc-950 text-white shadow-xl scale-105'
                      : 'bg-white text-zinc-400 border border-zinc-100 hover:border-zinc-300'
                  }`}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-zinc-950 text-white py-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
        >
          <i className="fa-solid fa-check-double"></i>
          Record Transaction
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
