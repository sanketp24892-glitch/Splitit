
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
      // Reset form
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <i className="fa-solid fa-receipt text-indigo-600"></i>
          Add Expense
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            isScanning 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          {isScanning ? (
            <><i className="fa-solid fa-spinner animate-spin"></i> Analyzing...</>
          ) : (
            <><i className="fa-solid fa-camera"></i> Scan Receipt</>
          )}
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="What was it for?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as any)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Lodging">Lodging</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Who paid?</label>
          <select
            required
            value={payerId}
            onChange={e => setPayerId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="" disabled>Select payer</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-semibold text-slate-700">Split among</label>
            <button
              type="button"
              onClick={handleAll}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Select All
            </button>
          </div>
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {participants.length === 0 && <span className="text-xs text-slate-400">Add participants first</span>}
            {participants.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleParticipant(p.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  selectedParticipants.includes(p.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-plus"></i>
          Add Expense
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
