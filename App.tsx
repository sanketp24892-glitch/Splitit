import React, { useState, useMemo, useEffect } from 'react';
import { Participant, Expense, Settlement, Balance } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';

const App: React.FC = () => {
  const [eventName, setEventName] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  // URL Sharing & Persistence
  useEffect(() => {
    const loadData = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        try {
          const decodedData = decodeURIComponent(atob(hash));
          const parsed = JSON.parse(decodedData);
          if (Array.isArray(parsed.participants) && Array.isArray(parsed.expenses)) {
            setParticipants(parsed.participants);
            setExpenses(parsed.expenses);
            setEventName(parsed.eventName || '');
            // Clear hash to prevent accidental re-loads over local changes
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }
        } catch (e) {
          console.error("Failed to parse shared link data", e);
        }
      }

      const savedParticipants = localStorage.getItem('splitit_participants');
      const savedExpenses = localStorage.getItem('splitit_expenses');
      const savedEventName = localStorage.getItem('splitit_eventname');
      if (savedParticipants) setParticipants(JSON.parse(savedParticipants));
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedEventName) setEventName(savedEventName);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (participants.length > 0 || expenses.length > 0 || eventName) {
      localStorage.setItem('splitit_participants', JSON.stringify(participants));
      localStorage.setItem('splitit_expenses', JSON.stringify(expenses));
      localStorage.setItem('splitit_eventname', eventName);
    }
  }, [participants, expenses, eventName]);

  const handleNewEvent = () => {
    if (window.confirm("Are you sure you want to start a new event? This will clear all current data.")) {
      setEventName('');
      setParticipants([]);
      setExpenses([]);
      localStorage.removeItem('splitit_participants');
      localStorage.removeItem('splitit_expenses');
      localStorage.removeItem('splitit_eventname');
    }
  };

  const handleShare = () => {
    try {
      const dataString = JSON.stringify({ participants, expenses, eventName });
      const encodedData = btoa(encodeURIComponent(dataString));
      const shareUrl = `${window.location.origin}${window.location.pathname}#${encodedData}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 3000);
      });
    } catch (e) {
      console.error("Failed to generate share link", e);
      alert("Could not generate share link. Try with less data.");
    }
  };

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

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    const fromP = participants.find(p => p.id === fromId);
    const toP = participants.find(p => p.id === toId);
    
    addExpense({
      description: `Settlement: ${fromP?.name || 'Debtor'} paid ${toP?.name || 'Creditor'}`,
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
      totalSpent: expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0)
    };
  }, [participants, expenses]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.filter(e => e.category !== 'Payment').forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + e.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const memberSpendingData = useMemo(() => {
    const spending: Record<string, number> = {};
    participants.forEach(p => spending[p.name] = 0);
    expenses.filter(e => e.category !== 'Payment').forEach(e => {
      const p = participants.find(part => part.id === e.payerId);
      if (p) spending[p.name] += e.amount;
    });
    return Object.entries(spending).map(([name, value]) => ({ name, value }));
  }, [expenses, participants]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#4f46e5] rounded-md flex items-center justify-center text-white text-lg shrink-0">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1e293b] tracking-tight truncate">
                SplitIt
              </h1>
            </div>
            {/* Tagline forced to 2 lines for full visibility on all screens */}
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-[0.05em] sm:tracking-[0.1em] mt-0.5 leading-tight">
              good times in,<br /> awkward math out.
            </p>
          </div>
          
          <nav className="flex bg-[#f1f5f9] p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-2.5 sm:px-6 py-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${
                activeTab === 'expenses' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-2.5 sm:px-6 py-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${
                activeTab === 'settlement' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Settlement
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Event Header & Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Event Name</label>
            <input 
              type="text" 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Goa Trip 2024, Birthday Party"
              className="text-lg sm:text-xl font-bold text-[#1e293b] bg-transparent border-none focus:ring-0 placeholder:text-slate-300 w-full"
            />
          </div>
          <div className="flex flex-row gap-2 sm:gap-4 shrink-0">
            <button
              onClick={handleNewEvent}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <i className="fa-solid fa-plus"></i>
              New Event
            </button>
            <button
              onClick={handleShare}
              className={`flex-[2] sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all border ${
                shareStatus === 'copied' 
                ? 'bg-green-50 border-green-200 text-green-600' 
                : 'bg-[#4f46e5] border-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-indigo-100'
              }`}
            >
              <i className={`fa-solid ${shareStatus === 'copied' ? 'fa-check' : 'fa-share-nodes'}`}></i>
              {shareStatus === 'copied' ? 'Link Copied!' : 'Share with Squad'}
            </button>
          </div>
        </div>

        {activeTab === 'expenses' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
              {/* The Squad */}
              <div className="lg:col-span-3">
                <ParticipantManager participants={participants} onAdd={addParticipant} onRemove={removeParticipant} />
              </div>

              {/* Recent Activity */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[#1e293b]">
                    <i className="fa-solid fa-list-ul text-[#4f46e5]"></i>
                    <h2 className="text-lg sm:text-xl font-bold">Recent Activity</h2>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    {expenses.length} Records
                  </span>
                </div>
                
                <div className="min-h-[300px] sm:min-h-[400px] bg-white border-2 border-dashed border-slate-200 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center text-center overflow-y-auto max-h-[500px] sm:max-h-[600px]">
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
                    <div className="w-full space-y-3 text-left self-start">
                      {expenses.sort((a, b) => b.date - a.date).map(e => (
                        <div 
                          key={e.id} 
                          onClick={() => setSelectedExpense(e)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            e.category === 'Payment' 
                            ? 'bg-slate-50 border-slate-100 italic opacity-80' 
                            : 'bg-white border-slate-100 hover:border-[#4f46e5] hover:shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[#1e293b] truncate text-sm sm:text-base">{e.description}</p>
                              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold mt-1 truncate">
                                {participants.find(p => p.id === e.payerId)?.name} • {new Date(e.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-bold text-sm sm:text-base ${e.category === 'Payment' ? 'text-slate-400' : 'text-[#1e293b]'}`}>₹{e.amount.toFixed(2)}</p>
                              <p className="text-[8px] sm:text-[9px] font-bold text-slate-300 uppercase">{e.category}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Form */}
              <div className="lg:col-span-4">
                <ExpenseForm participants={participants} onAdd={addExpense} />
              </div>
            </div>

            {/* Analytics Section */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 pt-8 border-t border-slate-200">
                {/* Category Chart */}
                <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6 text-[#1e293b]">
                    <i className="fa-solid fa-chart-pie text-[#4f46e5]"></i>
                    <h2 className="text-base sm:text-lg font-bold">Spending by Category</h2>
                  </div>
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                           formatter={(value: number) => `₹${value.toFixed(2)}`}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Member Chart */}
                <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6 text-[#1e293b]">
                    <i className="fa-solid fa-chart-column text-[#4f46e5]"></i>
                    <h2 className="text-base sm:text-lg font-bold">Spending by Member</h2>
                  </div>
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberSpendingData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip 
                           cursor={{ fill: '#f8fafc' }}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                           formatter={(value: number) => `₹${value.toFixed(2)}`}
                        />
                        <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
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
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1e293b]">Expense Detail</h3>
              <button onClick={() => setSelectedExpense(null)} className="text-slate-400 hover:text-slate-600 p-2">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Description</span>
                <span className="font-bold text-[#1e293b]">{selectedExpense.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Amount</span>
                <span className="font-bold text-xl text-[#4f46e5]">₹{selectedExpense.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Category</span>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase text-slate-500">{selectedExpense.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Who Paid</span>
                <span className="font-bold text-[#1e293b]">{participants.find(p => p.id === selectedExpense.payerId)?.name}</span>
              </div>
              <div className="space-y-2">
                <span className="text-slate-400 text-sm">Split Among</span>
                <div className="flex flex-wrap gap-2">
                  {selectedExpense.participantIds.map(id => (
                    <span key={id} className="text-xs font-semibold bg-[#eef2ff] text-[#4f46e5] px-2 py-1 rounded-md">
                      {participants.find(p => p.id === id)?.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-50 flex flex-col gap-2">
                <button 
                  onClick={() => removeExpense(selectedExpense.id)}
                  className="w-full py-4 text-sm font-bold text-red-500 bg-red-50 rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-trash-can"></i>
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