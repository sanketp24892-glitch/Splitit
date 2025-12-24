
import React, { useState, useMemo, useEffect } from 'react';
import LZString from 'lz-string';
import { Participant, Expense, Settlement, Balance, SplitEvent } from './types.ts';
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
  const [events, setEvents] = useState<Record<string, SplitEvent>>({});
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState('');
  
  // App states scoped to the active event
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'copied'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEventId, setShareEventId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const CATEGORY_MAP: Record<string, Expense['category']> = {
    'F': 'Food', 'T': 'Transport', 'L': 'Lodging', 'E': 'Entertainment', 'P': 'Payment', 'O': 'Other'
  };

  const getAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`;

  // Persistence & Shared Link Loading
  useEffect(() => {
    const loadInitialData = () => {
      const savedEvents = localStorage.getItem('splitit_multi_events');
      let currentEvents: Record<string, SplitEvent> = savedEvents ? JSON.parse(savedEvents) : {};

      // Handle shared hash
      const hash = window.location.hash.substring(1);
      if (hash) {
        try {
          const decompressed = LZString.decompressFromEncodedURIComponent(hash);
          if (decompressed) {
            const parsed = JSON.parse(decompressed);
            if (Array.isArray(parsed.p) && Array.isArray(parsed.e)) {
              const sharedId = `shared-${Date.now()}`;
              const reconstructed: SplitEvent = {
                id: sharedId,
                name: parsed.n || 'Shared Event',
                participants: parsed.p.map((name: string, idx: number) => ({
                  id: `p-${idx}`,
                  name: name,
                  avatar: getAvatar(name)
                })),
                expenses: parsed.e.map((e: any, idx: number) => ({
                  id: `e-${idx}`,
                  description: e.d,
                  amount: e.a,
                  payerId: `p-${e.p}`,
                  participantIds: e.s.map((sIdx: number) => `p-${sIdx}`),
                  date: e.t * 1000,
                  category: CATEGORY_MAP[e.c] || 'Other'
                })),
                createdAt: Date.now()
              };
              currentEvents[sharedId] = reconstructed;
              setCurrentEventId(sharedId);
              // Clean URL
              window.history.replaceState(null, "", window.location.pathname);
            }
          }
        } catch (e) {
          console.error("Failed to parse shared link data", e);
        }
      }
      
      setEvents(currentEvents);
      setIsInitialized(true);
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('splitit_multi_events', JSON.stringify(events));
    }
  }, [events, isInitialized]);

  // Active event helper
  const activeEvent = currentEventId ? events[currentEventId] : null;

  // Derived data for active event
  const { balances, settlements, totalSpent, categoryData, memberSpendingData } = useMemo(() => {
    if (!activeEvent) return { balances: [], settlements: [], totalSpent: 0, categoryData: [], memberSpendingData: [] };
    
    const bals = calculateBalances(activeEvent.participants, activeEvent.expenses);
    const setts = calculateSettlements([...bals]);
    const total = activeEvent.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);

    const counts: Record<string, number> = {};
    activeEvent.expenses.filter(e => e.category !== 'Payment').forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + e.amount;
    });
    const catData = Object.entries(counts).map(([name, value]) => ({ name, value }));

    const spending: Record<string, number> = {};
    activeEvent.participants.forEach(p => spending[p.name] = 0);
    activeEvent.expenses.filter(e => e.category !== 'Payment').forEach(e => {
      const p = activeEvent.participants.find(part => part.id === e.payerId);
      if (p) spending[p.name] += e.amount;
    });
    const memData = Object.entries(spending).map(([name, value]) => ({ name, value }));

    return { 
      balances: bals, 
      settlements: setts, 
      totalSpent: total, 
      categoryData: catData, 
      memberSpendingData: memData 
    };
  }, [activeEvent]);

  // Actions
  const createEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const id = crypto.randomUUID();
    const newEv: SplitEvent = {
      id,
      name: newEventName.trim(),
      participants: [],
      expenses: [],
      createdAt: Date.now()
    };
    setEvents(prev => ({ ...prev, [id]: newEv }));
    setNewEventName('');
    setCurrentEventId(id);
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Delete this event forever?")) {
      const newEvents = { ...events };
      delete newEvents[id];
      setEvents(newEvents);
      if (currentEventId === id) setCurrentEventId(null);
    }
  };

  const updateActiveEvent = (updates: Partial<SplitEvent>) => {
    if (!currentEventId) return;
    setEvents(prev => ({
      ...prev,
      [currentEventId]: { ...prev[currentEventId], ...updates }
    }));
  };

  const addParticipant = (name: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      participants: [...activeEvent.participants, { id: crypto.randomUUID(), name, avatar: getAvatar(name) }]
    });
  };

  const removeParticipant = (id: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      participants: activeEvent.participants.filter(p => p.id !== id),
      expenses: activeEvent.expenses.filter(e => e.payerId !== id && !e.participantIds.includes(id))
    });
  };

  const addExpense = (newExp: Omit<Expense, 'id'>) => {
    if (!activeEvent) return;
    updateActiveEvent({
      expenses: [{ ...newExp, id: crypto.randomUUID() }, ...activeEvent.expenses]
    });
  };

  const removeExpense = (id: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      expenses: activeEvent.expenses.filter(e => e.id !== id)
    });
    if (selectedExpense?.id === id) setSelectedExpense(null);
  };

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    if (!activeEvent) return;
    const fromP = activeEvent.participants.find(p => p.id === fromId)?.name;
    const toP = activeEvent.participants.find(p => p.id === toId)?.name;
    addExpense({
      description: `Settlement: ${fromP} paid ${toP}`,
      amount: amount, payerId: fromId, participantIds: [toId], category: 'Payment', date: Date.now()
    });
  };

  // Sharing Helpers
  const getFullShareUrl = (eventId: string) => {
    const targetEvent = events[eventId];
    const pMap = new Map();
    targetEvent.participants.forEach((p, idx) => pMap.set(p.id, idx));

    const payload = {
      n: targetEvent.name,
      p: targetEvent.participants.map(p => p.name),
      e: targetEvent.expenses.map(e => ({
        d: e.description,
        a: e.amount,
        p: pMap.get(e.payerId),
        s: e.participantIds.map(id => pMap.get(id)),
        t: Math.floor(e.date / 1000),
        c: e.category[0]
      }))
    };
    
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    return `${window.location.origin}${window.location.pathname}#${compressed}`;
  };

  const getShortUrl = async (eventId: string) => {
    const longUrl = getFullShareUrl(eventId);
    try {
      setShareStatus('loading');
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
      if (res.ok) {
        const short = await res.text();
        setShareStatus('idle');
        return short;
      }
    } catch (e) {
      console.warn("Shortening failed", e);
    }
    setShareStatus('idle');
    return longUrl;
  };

  const openShareModal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShareEventId(id);
    setShowShareModal(true);
  };

  const handleShareWhatsApp = async () => {
    if (!shareEventId) return;
    const url = await getShortUrl(shareEventId);
    const ev = events[shareEventId];
    const bals = calculateBalances(ev.participants, ev.expenses);
    const setts = calculateSettlements([...bals]);
    const settlementText = setts.length === 0 ? "All settled! ✅" : setts.map(s => `💸 *${ev.participants.find(p=>p.id===s.from)?.name}* owes *${ev.participants.find(p=>p.id===s.to)?.name}*: ₹${s.amount.toFixed(2)}`).join('\n');
    const text = `💰 *SplitIt: ${ev.name}*\n\n*Settlements:*\n${settlementText}\n\n🔗 View & Settle:\n${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = async () => {
    if (!shareEventId) return;
    const url = await getShortUrl(shareEventId);
    navigator.clipboard.writeText(url).then(() => {
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    });
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Dashboard Render
  if (!currentEventId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-100 p-6 sm:p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#4f46e5] rounded-xl flex items-center justify-center text-white text-2xl"><i className="fa-solid fa-receipt"></i></div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tight">SplitIt</h1>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-full">Dashboard</span>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-16 space-y-12">
          {/* Create Event Section */}
          <section className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl shadow-indigo-50/50 border border-slate-100 text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-slate-800">New Group Session</h2>
              <p className="text-slate-400 font-medium">Split bills instantly for trips, parties, or dinners.</p>
            </div>
            
            <form onSubmit={createEvent} className="max-w-md mx-auto relative group">
              <input 
                type="text" 
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="Enter event name... e.g. Goa 2024"
                className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-[#4f46e5] focus:bg-white text-lg font-bold transition-all outline-none pr-36 shadow-inner"
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-[#4f46e5] text-white px-8 rounded-2xl font-black text-sm hover:bg-[#4338ca] transition-all shadow-lg active:scale-95"
              >
                START
              </button>
            </form>
          </section>

          {/* Existing Events Grid */}
          {Object.values(events).length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Your Active Events</h3>
                <span className="text-xs font-bold text-[#4f46e5]">{Object.values(events).length} Saved</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Explicitly cast Object.values(events) and type parameters to fix 'unknown' type errors */}
                {(Object.values(events) as SplitEvent[]).sort((a: SplitEvent, b: SplitEvent) => b.createdAt - a.createdAt).map((ev: SplitEvent) => {
                  const evTotal = ev.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => setCurrentEventId(ev.id)}
                      className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#4f46e5]/20 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between min-h-[220px]"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-10 bg-[#eef2ff] text-[#4f46e5] rounded-xl flex items-center justify-center text-lg font-black group-hover:bg-[#4f46e5] group-hover:text-white transition-colors">
                            {ev.name.charAt(0)}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => openShareModal(e, ev.id)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-[#4f46e5] flex items-center justify-center transition-colors"><i className="fa-solid fa-share-nodes text-xs"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i className="fa-solid fa-trash text-xs"></i></button>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-slate-800 line-clamp-1">{ev.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{new Date(ev.createdAt).toLocaleDateString()} • {ev.participants.length} People</p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-50 flex items-end justify-between">
                         <div>
                            <span className="block text-[8px] font-black text-slate-300 uppercase tracking-widest">Spent</span>
                            <span className="text-xl font-black text-slate-800">₹{evTotal.toFixed(0)}</span>
                         </div>
                         <i className="fa-solid fa-chevron-right text-slate-200 group-hover:translate-x-1 group-hover:text-[#4f46e5] transition-all"></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  // Active Event View
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentEventId(null)}
              className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[#1e293b] truncate">{activeEvent.name}</h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.1em] uppercase">SplitIt Management</p>
            </div>
          </div>
          <nav className="flex bg-[#f1f5f9] p-1 rounded-xl shrink-0">
            <button onClick={() => setActiveTab('expenses')} className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'expenses' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Overview</button>
            <button onClick={() => setActiveTab('settlement')} className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'settlement' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Settlement</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Quick Summary Row */}
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex gap-8">
            <div><span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Total Spent</span><p className="text-lg font-black">₹{totalSpent.toFixed(0)}</p></div>
            <div><span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Squad</span><p className="text-lg font-black">{activeEvent.participants.length}</p></div>
          </div>
          <button 
            onClick={(e) => openShareModal(e, activeEvent.id)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-indigo-100"
          >
            <i className="fa-solid fa-share-nodes"></i>
            Share Dues
          </button>
        </div>

        {activeTab === 'expenses' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3"><ParticipantManager participants={activeEvent.participants} onAdd={addParticipant} onRemove={removeParticipant} /></div>
            <div className="lg:col-span-5 space-y-4">
              <div className="flex justify-between items-center"><h2 className="text-lg font-bold flex items-center gap-2"><i className="fa-solid fa-list-ul text-[#4f46e5]"></i>Recent Activity</h2><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{activeEvent.expenses.length} Records</span></div>
              <div className="min-h-[400px] bg-white border border-slate-100 rounded-3xl p-4 overflow-y-auto max-h-[600px] scrollbar-hide">
                {activeEvent.expenses.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center text-slate-300"><i className="fa-solid fa-receipt text-3xl mb-2"></i><p className="text-sm font-bold">No expenses yet</p></div> : 
                  activeEvent.expenses.sort((a,b) => b.date - a.date).map(e => (
                    <div key={e.id} onClick={() => setSelectedExpense(e)} className={`p-4 mb-3 rounded-xl border transition-all cursor-pointer ${e.category === 'Payment' ? 'bg-slate-50 border-slate-100 italic' : 'bg-white border-slate-50 hover:border-[#4f46e5]'}`}>
                      <div className="flex justify-between items-center"><div className="min-w-0"><p className="font-bold text-slate-800 truncate">{e.description}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{activeEvent.participants.find(p=>p.id===e.payerId)?.name} • {new Date(e.date).toLocaleDateString()}</p></div><div className="text-right shrink-0"><p className="font-bold text-slate-800">₹{e.amount.toFixed(2)}</p><p className="text-[8px] text-slate-300 font-bold uppercase">{e.category}</p></div></div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="lg:col-span-4"><ExpenseForm participants={activeEvent.participants} onAdd={addExpense} /></div>
          </div>
        ) : (
          <SettlementView participants={activeEvent.participants} balances={balances} settlements={settlements} totalSpent={totalSpent} onSettle={handleSettle} />
        )}
      </main>

      {/* Shared Modals */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800">Share "{events[shareEventId!]?.name}"</h3><button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button></div>
            <div className="p-8 grid grid-cols-2 gap-4 relative">
              {shareStatus === 'loading' && <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center gap-2"><i className="fa-solid fa-spinner animate-spin text-[#4f46e5] text-2xl"></i><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Processing...</span></div>}
              <button onClick={handleShareWhatsApp} className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-green-50 hover:bg-green-100 transition-colors"><div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white"><i className="fa-brands fa-whatsapp text-2xl"></i></div><span className="text-xs font-bold text-green-700">WhatsApp</span></button>
              <button onClick={handleCopyLink} className={`flex flex-col items-center gap-2 p-6 rounded-3xl transition-colors ${shareStatus === 'copied' ? 'bg-indigo-100' : 'bg-slate-50'}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${shareStatus === 'copied' ? 'bg-indigo-600' : 'bg-slate-700'}`}><i className={`fa-solid ${shareStatus === 'copied' ? 'fa-check' : 'fa-link'} text-xl`}></i></div><span className="text-xs font-bold text-slate-700">{shareStatus === 'copied' ? 'Copied!' : 'Copy Link'}</span></button>
            </div>
            <div className="p-6 bg-slate-50 rounded-b-[2.5rem] text-center"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Data remains synced offline</p></div>
          </div>
        </div>
      )}

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center"><h3 className="text-xl font-bold">Expense Detail</h3><button onClick={() => setSelectedExpense(null)} className="text-slate-400 hover:text-slate-800"><i className="fa-solid fa-xmark"></i></button></div>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-50"><span>Description</span><span className="font-bold text-lg">{selectedExpense.description}</span></div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-50"><span>Amount</span><span className="font-black text-2xl text-[#4f46e5]">₹{selectedExpense.amount}</span></div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-50"><span>Who Paid</span><span className="font-bold">{activeEvent.participants.find(p=>p.id===selectedExpense.payerId)?.name}</span></div>
            </div>
            <button onClick={() => removeExpense(selectedExpense.id)} className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-trash-can"></i>Delete Transaction</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
