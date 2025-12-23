
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
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Persistence and Sharing via URL
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      try {
        const decoded = JSON.parse(atob(hash));
        if (decoded.participants && decoded.expenses) {
          setParticipants(decoded.participants);
          setExpenses(decoded.expenses);
          window.location.hash = ""; 
          return;
        }
      } catch (e) {
        console.error("Failed to parse shared link", e);
      }
    }

    const savedParticipants = localStorage.getItem('splitit_participants');
    const savedExpenses = localStorage.getItem('splitit_expenses');
    if (savedParticipants) setParticipants(JSON.parse(savedParticipants));
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
  }, []);

  useEffect(() => {
    localStorage.setItem('splitit_participants', JSON.stringify(participants));
    localStorage.setItem('splitit_expenses', JSON.stringify(expenses));
  }, [participants, expenses]);

  const handleShare = () => {
    const data = btoa(JSON.stringify({ participants, expenses }));
    const shareUrl = `${window.location.origin}${window.location.pathname}#${data}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Shareable link copied to clipboard! Send this to your squad.");
  };

  const addParticipant = (name: string) => {
    const newP: Participant = {
      id: crypto.randomUUID(),
      name,
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${name}&backgroundColor=000000`
    };
    setParticipants([...participants, newP]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
    setExpenses(expenses.filter(e => e.payerId !== id && !e.participantIds.includes(id)));
  };

  const addExpense = (newExp: Omit<Expense, 'id'>) => {
    const exp: Expense = { ...newExp, id: crypto.randomUUID() };
    setExpenses([exp, ...expenses]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
    if (selectedExpense?.id === id) setSelectedExpense(null);
  };

  const handleSettleIndividual = (expense: Expense) => {
    const payer = participants.find(p => p.id === expense.payerId);
    if (!payer) return;

    const perPerson = expense.amount / expense.participantIds.length;
    
    expense.participantIds.forEach(pId => {
      if (pId === expense.payerId) return;
      const borrower = participants.find(p => p.id === pId);
      if (!borrower) return;

      addExpense({
        description: `Settled: ${borrower.name} for ${expense.description}`,
        amount: perPerson,
        payerId: pId,
        participantIds: [expense.payerId],
        category: 'Payment',
        date: Date.now()
      });
    });
    setSelectedExpense(null);
  };

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    const fromName = participants.find(p => p.id === fromId)?.name || 'Someone';
    const toName = participants.find(p => p.id === toId)?.name || 'Someone';
    addExpense({
      description: `Settlement: ${fromName} to ${toName}`,
      amount,
      payerId: fromId,
      participantIds: [toId],
      category: 'Payment',
      date: Date.now()
    });
  };

  const updateParticipantUpi = (id: string, upiId: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, upiId } : p));
  };

  const { balances, settlements, totalSpent } = useMemo(() => {
    const bals = calculateBalances(participants, expenses);
    return {
      balances: bals,
      settlements: calculateSettlements([...bals]),
      totalSpent: expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0)
    };
  }, [participants, expenses]);

  return (
    <div className="min-h-screen bg-white text-zinc-950 flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
      {/* Dynamic Background Element */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-200 via-zinc-950 to-zinc-200 z-50"></div>

      {/* Header */}
      <header className="bg-zinc-950 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-zinc-950" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17M2 12L12 17L22 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter leading-none">
                split<span className="text-zinc-500">It</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600 mt-1">Smart Ledger</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleShare}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-white hover:text-zinc-950 border border-zinc-800 transition-all text-xs font-bold uppercase tracking-widest"
            >
              <i className="fa-solid fa-share-nodes group-hover:scale-110 transition-transform"></i>
              <span>Share</span>
            </button>
            <nav className="flex bg-zinc-900 p-1.5 rounded-full border border-zinc-800 shadow-inner">
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'expenses' ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('settlement')}
                className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'settlement' ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Settle
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-16">
        {activeTab === 'expenses' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            {/* Squad Sidebar */}
            <div className="lg:col-span-3">
              <ParticipantManager participants={participants} onAdd={addParticipant} onRemove={removeParticipant} />
            </div>

            {/* Transactions Feed */}
            <div className="lg:col-span-5 space-y-10">
              <div className="flex justify-between items-baseline border-b-8 border-zinc-950 pb-6 mb-2">
                <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">Transactions</h2>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black bg-zinc-100 px-4 py-1.5 rounded-full border-2 border-zinc-950">
                    {expenses.length} TOTAL
                  </span>
                </div>
              </div>
              
              <div className="space-y-6">
                {expenses.length === 0 ? (
                  <div className="py-32 text-center border-4 border-dashed border-zinc-100 rounded-[3rem]">
                    <i className="fa-solid fa-box-open text-5xl text-zinc-100 mb-6 block"></i>
                    <p className="text-zinc-300 font-bold text-sm uppercase tracking-[0.3em]">No transactions found</p>
                  </div>
                ) : (
                  expenses.sort((a, b) => b.date - a.date).map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => setSelectedExpense(e)}
                      className={`group relative overflow-hidden cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${
                        e.category === 'Payment' 
                        ? 'bg-zinc-50 border-transparent' 
                        : 'bg-white border-zinc-100 hover:border-zinc-950 hover:shadow-[30px_30px_60px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2'
                      }`}
                    >
                      {/* Interactive background shine on hover */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-zinc-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-2">
                          <h4 className="font-black text-2xl tracking-tighter group-hover:text-zinc-950 transition-colors">{e.description}</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 group-hover:bg-zinc-100 px-2 py-0.5 rounded transition-colors">
                              {new Date(e.date).toLocaleDateString()}
                            </span>
                            <span className="w-1.5 h-1.5 bg-zinc-200 rounded-full"></span>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              {participants.find(p => p.id === e.payerId)?.name || 'Guest'} paid
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-black tracking-tighter ${e.category === 'Payment' ? 'text-zinc-300' : 'text-zinc-950'}`}>
                            ₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mt-1">
                            {e.participantIds.length} Split
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Expense Form Sidebar */}
            <div className="lg:col-span-4">
              <ExpenseForm participants={participants} onAdd={addExpense} />
            </div>
          </div>
        ) : (
          <SettlementView
            participants={participants}
            balances={balances}
            settlements={settlements}
            totalSpent={totalSpent}
            onSettle={handleSettle}
            onUpdateUpi={updateParticipantUpi}
          />
        )}
      </main>

      {/* Modern Transaction Detail Sheet */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/95 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] max-w-xl w-full overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.1)] animate-in zoom-in-95 duration-300">
            <div className="bg-zinc-950 p-12 text-white relative">
              <div className="absolute top-8 right-8">
                <button 
                  onClick={() => setSelectedExpense(null)} 
                  className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-white hover:text-zinc-950 rounded-full transition-all"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              
              <div className="space-y-4">
                <span className="inline-block px-3 py-1 bg-zinc-800 text-[10px] font-bold uppercase tracking-[0.3em] rounded-full">Transaction Analysis</span>
                <h3 className="text-5xl font-black tracking-tighter leading-tight">{selectedExpense.description}</h3>
              </div>
            </div>

            <div className="p-12 space-y-12">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Value</p>
                  <p className="text-5xl font-black tracking-tighter">₹{selectedExpense.amount.toFixed(2)}</p>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Primary Payer</p>
                  <p className="text-2xl font-bold tracking-tight">{participants.find(p => p.id === selectedExpense.payerId)?.name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Squad Involvement</p>
                <div className="flex flex-wrap gap-3">
                  {selectedExpense.participantIds.map(pId => (
                    <div key={pId} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold text-xs uppercase tracking-wider">
                      <div className="w-2 h-2 bg-zinc-950 rounded-full"></div>
                      {participants.find(p => p.id === pId)?.name || 'Guest'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedExpense.category !== 'Payment' && (
                  <button 
                    onClick={() => handleSettleIndividual(selectedExpense)}
                    className="group bg-zinc-950 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
                  >
                    <i className="fa-solid fa-bolt-lightning group-hover:animate-pulse"></i>
                    Settle this transaction
                  </button>
                )}
                <button 
                  onClick={() => removeExpense(selectedExpense.id)}
                  className="bg-zinc-100 text-zinc-400 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  Remove Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-zinc-50 border-t border-zinc-100 py-20 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
          <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center mb-8 shadow-xl">
             <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17M2 12L12 17L22 12" />
              </svg>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h4 className="text-xl font-black uppercase tracking-[0.4em] text-zinc-950">splitIt</h4>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.8em]">© 2025 ALL RIGHTS RESERVED</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
