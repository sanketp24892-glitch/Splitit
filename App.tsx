
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

  const addParticipant = (name: string) => {
    const newP: Participant = {
      id: crypto.randomUUID(),
      name,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`
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

  const { balances, settlements, totalSpent } = useMemo(() => {
    const bals = calculateBalances(participants, expenses);
    return {
      balances: bals,
      settlements: calculateSettlements([...bals]),
      totalSpent: expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0)
    };
  }, [participants, expenses]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#4f46e5] rounded-md flex items-center justify-center text-white text-lg">
                <i className="fa-solid fa-wallet"></i>
              </div>
              <h1 className="text-2xl font-bold text-[#1e293b] tracking-tight">
                SplitIt
              </h1>
            </div>
            <p className="text-[10px] font-bold text-slate-400 tracking-[0.1em] mt-0.5">
              good times in, awkward math out.
            </p>
          </div>
          
          <nav className="flex bg-[#f1f5f9] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'expenses' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'settlement' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Settlement
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {activeTab === 'expenses' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* The Squad */}
            <div className="lg:col-span-3">
              <ParticipantManager participants={participants} onAdd={addParticipant} onRemove={removeParticipant} />
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[#1e293b]">
                  <i className="fa-solid fa-list-ul text-[#4f46e5]"></i>
                  <h2 className="text-xl font-bold">Recent Activity</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  {expenses.length} Records
                </span>
              </div>
              
              <div className="min-h-[400px] bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                {expenses.length === 0 ? (
                  <>
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                      <i className="fa-solid fa-receipt text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-bold text-[#1e293b]">Clean slate!</h3>
                    <p className="text-sm text-slate-400 max-w-[200px] mt-2">
                      Add an expense or scan a receipt to start splitting.
                    </p>
                  </>
                ) : (
                  <div className="w-full space-y-4 text-left self-start">
                    {expenses.sort((a, b) => b.date - a.date).map(e => (
                      <div 
                        key={e.id} 
                        onClick={() => setSelectedExpense(e)}
                        className="p-4 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-[#1e293b]">{e.description}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">
                              {participants.find(p => p.id === e.payerId)?.name} • {new Date(e.date).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-bold text-[#1e293b]">₹{e.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Record */}
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
          />
        )}
      </main>

      {/* Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1e293b]">Expense Detail</h3>
              <button onClick={() => setSelectedExpense(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Description</span>
                <span className="font-bold">{selectedExpense.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Amount</span>
                <span className="font-bold text-xl text-[#4f46e5]">₹{selectedExpense.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Who Paid</span>
                <span className="font-bold">{participants.find(p => p.id === selectedExpense.payerId)?.name}</span>
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <button 
                  onClick={() => removeExpense(selectedExpense.id)}
                  className="w-full py-3 text-sm font-bold text-red-500 bg-red-50 rounded-xl hover:bg-red-100"
                >
                  Delete Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;