
import React, { useState, useMemo, useEffect } from 'react';
import { Participant, Expense, Settlement, Balance } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';

const App: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');

  // Persistence
  useEffect(() => {
    const savedParticipants = localStorage.getItem('splitit_participants');
    const savedExpenses = localStorage.getItem('splitit_expenses');
    if (savedParticipants) setParticipants(JSON.parse(savedParticipants));
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
  }, []);

  useEffect(() => {
    localStorage.setItem('splitit_participants', JSON.stringify(participants));
    localStorage.setItem('splitit_expenses', JSON.stringify(expenses));
  }, [participants, expenses]);

  const addParticipant = (name: string, upiId?: string) => {
    const newP: Participant = {
      id: crypto.randomUUID(),
      name,
      upiId,
      avatar: `https://picsum.photos/seed/${name}/100/100`
    };
    setParticipants([...participants, newP]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
    setExpenses(expenses.filter(e => e.payerId !== id && !e.participantIds.includes(id)));
  };

  const addExpense = (newExp: Omit<Expense, 'id'>) => {
    const exp: Expense = {
      ...newExp,
      id: crypto.randomUUID()
    };
    setExpenses([exp, ...expenses]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    const fromName = participants.find(p => p.id === fromId)?.name || 'Someone';
    const toName = participants.find(p => p.id === toId)?.name || 'Someone';
    
    addExpense({
      description: `Settlement: ${fromName} paid ${toName}`,
      amount: amount,
      payerId: fromId,
      participantIds: [toId],
      category: 'Payment',
      date: Date.now()
    });
  };

  const { balances, settlements, totalSpent } = useMemo(() => {
    const bals = calculateBalances(participants, expenses);
    return {
      balances: bals,
      settlements: calculateSettlements([...bals]),
      totalSpent: expenses.reduce((acc, curr) => acc + curr.amount, 0)
    };
  }, [participants, expenses]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Food': return 'fa-utensils';
      case 'Transport': return 'fa-car';
      case 'Lodging': return 'fa-hotel';
      case 'Entertainment': return 'fa-ticket';
      case 'Payment': return 'fa-handshake';
      default: return 'fa-ellipsis';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <i className="fa-solid fa-divide text-sm"></i>
              </div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">SplitIt<span className="text-indigo-600">AI</span></h1>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Good times in, awkward math out.</p>
          </div>
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'settlement' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Settlement
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {activeTab === 'expenses' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: People */}
            <div className="lg:col-span-3">
              <ParticipantManager
                participants={participants}
                onAdd={addParticipant}
                onRemove={removeParticipant}
              />
            </div>

            {/* Middle: Expenses Feed */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                  <i className="fa-solid fa-list-ul text-indigo-600"></i>
                  Recent Activity
                </h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full">
                  {expenses.length} Records
                </span>
              </div>
              
              {expenses.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <i className="fa-solid fa-receipt text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">Clean slate!</h3>
                  <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Add an expense or scan a receipt to start splitting.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.sort((a, b) => b.date - a.date).map(e => (
                    <div key={e.id} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 group relative transition-all hover:border-indigo-200 ${e.category === 'Payment' ? 'bg-indigo-50/30' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 ${e.category === 'Payment' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'} rounded-xl flex items-center justify-center border border-indigo-100 shrink-0`}>
                            <i className={`fa-solid ${getCategoryIcon(e.category)} text-xl`}></i>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 leading-tight">{e.description}</h4>
                            <p className="text-xs font-semibold text-slate-400 mb-2">
                              {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} • Paid by {participants.find(p => p.id === e.payerId)?.name}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {e.participantIds.map(pId => (
                                <span key={pId} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter border border-slate-200">
                                  {participants.find(p => p.id === pId)?.name.substring(0, 3)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-black ${e.category === 'Payment' ? 'text-indigo-600' : 'text-slate-900'}`}>₹{e.amount.toFixed(2)}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.category}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeExpense(e.id)}
                        className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Add Form */}
            <div className="lg:col-span-4">
              <ExpenseForm
                participants={participants}
                onAdd={addExpense}
              />
            </div>
          </div>
        ) : (
          <SettlementView
            participants={participants}
            balances={balances}
            settlements={settlements}
            totalSpent={totalSpent}
            onSettle={handleSettle}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-3">Good times in, awkward math out.</p>
          <div className="flex items-center justify-center gap-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest">
            <span>SplitIt AI</span>
            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
            <span>Powered by Gemini</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
