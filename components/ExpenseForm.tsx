
import React, { useState, useRef, useEffect } from 'react';
import { Participant, Expense } from '../types.ts';
import { parseReceipt } from '../services/geminiService.ts';

interface Props {
  participants: Participant[];
  onAdd: (expense: Omit<Expense, 'id'>) => void;
  onUpdate?: (id: string, expense: Partial<Expense>) => void;
  editingExpense?: Expense | null;
  onCancelEdit?: () => void;
}

const ExpenseForm: React.FC<Props> = ({ participants, onAdd, onUpdate, editingExpense, onCancelEdit }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Other');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmount(editingExpense.amount.toString());
      setPayerId(editingExpense.payerId);
      setCategory(editingExpense.category);
      setDate(new Date(editingExpense.date).toISOString().split('T')[0]);
      setSelectedParticipants(editingExpense.participantIds);
    }
  }, [editingExpense]);

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
      if (editingExpense && onUpdate) {
        onUpdate(editingExpense.id, {
          description,
          amount: parseFloat(amount),
          payerId,
          participantIds: selectedParticipants,
          category,
          date: new Date(date).getTime()
        });
      } else {
        onAdd({
          description,
          amount: parseFloat(amount),
          payerId,
          participantIds: selectedParticipants,
          category,
          date: new Date(date).getTime()
        });
      }
      
      if (!editingExpense) {
        setDescription('');
        setAmount('');
        setSelectedParticipants([]);
        setDate(new Date().toISOString().split('T')[0]);
      } else if (onCancelEdit) {
        onCancelEdit();
        setDescription('');
        setAmount('');
        setSelectedParticipants([]);
        setDate(new Date().toISOString().split('T')[0]);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6 sm:mb-8">
        <div className="flex items-center gap-2 text-[#1e293b]">
          <i className="fa-solid fa-receipt text-[#4f46e5]"></i>
          <h2 className="text-lg sm:text-xl font-bold">{editingExpense ? "Edit Transaction" : "Transactions"}</h2>
        </div>
        {!editingExpense && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-bold text-[#4f46e5] bg-[#eef2ff] hover:bg-[#e0e7ff] transition-all uppercase tracking-wider whitespace-nowrap"
          >
            {isScanning ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-camera"></i>}
            <span>SCAN RECEIPT</span>
          </button>
        )}
        {editingExpense && onCancelEdit && (
          <button
            onClick={onCancelEdit}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600"
          >
            CANCEL EDIT
          </button>
        )}
        <input type="file" accept="image/*" ref={fileInputRef} onChange={async (e) => {
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
        }} className="hidden" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">DESCRIPTION</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-4 py-3.5 sm:py-4 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-sm placeholder:text-slate-300 transition-all"
            placeholder="e.g. Starbucks, Movie Night"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">AMOUNT</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3.5 sm:py-4 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-sm transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">DATE</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3.5 sm:py-4 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-sm transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">CATEGORY</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-4 py-3.5 sm:py-4 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Lodging">Lodging</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">WHO PAID?</label>
            <select
              required
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="w-full px-4 py-3.5 sm:py-4 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="" disabled>Select payer</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPLIT AMONG</label>
            <button type="button" onClick={handleAll} className="text-[10px] font-bold text-[#4f46e5] uppercase">TOGGLE ALL</button>
          </div>
          <div className="flex flex-wrap gap-2 p-3 min-h-[60px] bg-slate-50 rounded-2xl border border-slate-100">
            {participants.length === 0 ? (
              <p className="text-[9px] text-slate-400 italic w-full text-center py-2">No members yet</p>
            ) : (
              participants.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleParticipant(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedParticipants.includes(p.id)
                      ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200'
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
          className="w-full bg-[#4f46e5] text-white py-4 sm:py-5 rounded-2xl font-bold text-sm shadow-md hover:bg-[#4338ca] transition-all active:scale-[0.98] mt-2"
        >
          {editingExpense ? "Update Transaction" : "Record Transaction"}
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
